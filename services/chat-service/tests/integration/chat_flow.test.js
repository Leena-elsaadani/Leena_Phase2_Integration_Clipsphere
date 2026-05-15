const request = require("supertest");
const WebSocket = require("ws");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

const { createApp } = require("../../internal/config/app");
const { attachWebSocket, broadcastToRoom } = require("../../internal/socket/socket_server");
const chatRepository = require("../../internal/repository/chat_repository");
const brokerService = require("../../internal/services/broker_service");

jest.mock("../../internal/services/broker_service", () => ({
  connectBroker: jest.fn().mockResolvedValue(),
  publishMessageCreated: jest.fn().mockResolvedValue(true),
  publishUserPresence: jest.fn().mockResolvedValue(true),
}));

// ── helpers ────────────────────────────────────────────────────────────────

function openWS(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function closeWS(ws) {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) return resolve();
    ws.once("close", resolve);
    ws.close();
  });
}

function waitForMessage(ws, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No WS message received within ${timeoutMs}ms`)),
      timeoutMs
    );
    ws.once("message", (data) => {
      clearTimeout(timer);
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(e); }
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── suite ──────────────────────────────────────────────────────────────────

describe("Chat Service Integration Tests", () => {
  let app;
  let server;
  let wss;
  let mongoServer;
  const testUserId = "test-user-123";
  let testRoomId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URL = mongoServer.getUri();
    process.env.RABBITMQ_URL = "amqp://localhost:5672";

    await chatRepository.connectMongo();
    await brokerService.connectBroker();

    // Pass the real broadcastToRoom so the handler actually sends WS messages
    app = createApp(broadcastToRoom);

    await new Promise((resolve) => {
      server = app.listen(3003, "0.0.0.0", resolve);
    });

    // attachWebSocket must return wss — ensure socket_server.js has "return wss"
    wss = attachWebSocket(server, 3003);
  }, 120000);

  afterAll(async () => {
    if (wss) {
      wss.clients.forEach((c) => c.terminate());
      await new Promise((resolve) => wss.close(resolve));
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 120000);

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    // Only clear activeMembers — do NOT clear socketsByRoom (live WS handles)
    chatRepository.activeMembers.clear();
    jest.clearAllMocks();
  });

  // ── A. Send Message Flow ──────────────────────────────────────────────────

  describe("A. Send Message Flow", () => {

    test("Create chat room", async () => {
      const response = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "Test Room" });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe("Test Room");
      expect(response.body.ownerId).toBe(testUserId);
      expect(response.body).toHaveProperty("createdAt");

      testRoomId = response.body.id;
    });

    test("Connect WebSocket clients and join room", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "WebSocket Test Room" });

      const roomId = room.id;

      const client1 = await openWS(`ws://localhost:3003/ws?roomId=${roomId}&userId=${testUserId}`);
      const client2 = await openWS(`ws://localhost:3003/ws?roomId=${roomId}&userId=user-456`);
      await sleep(100);

      const joinResponse = await request(app)
        .post(`/rooms/${roomId}/join`)
        .set("x-user-id", "user-456");

      expect(joinResponse.status).toBe(200);
      expect(joinResponse.body.message).toBe("joined");

      expect(chatRepository.activeMembers.has(roomId)).toBe(true);
      expect(chatRepository.activeMembers.get(roomId).has(testUserId)).toBe(true);
      expect(chatRepository.activeMembers.get(roomId).has("user-456")).toBe(true);

      await closeWS(client1);
      await closeWS(client2);
    });

    test("Send message through API and verify broadcast", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "Message Test Room" });

      const roomId = room.id;

      // Connect — registers ws into socketsByRoom server-side
      const wsClient = await openWS(
        `ws://localhost:3003/ws?roomId=${roomId}&userId=${testUserId}`
      );
      // Give server connection handler time to finish
      await sleep(100);

      // Arm listener BEFORE the HTTP send
      const msgPromise = waitForMessage(wsClient);

      const sendResponse = await request(app)
        .post(`/rooms/${roomId}/messages`)
        .set("x-user-id", testUserId)
        .send({ content: "Hello, World!" });

      expect(sendResponse.status).toBe(201);
      expect(sendResponse.body).toHaveProperty("id");
      expect(sendResponse.body.roomId).toBe(roomId);
      expect(sendResponse.body.userId).toBe(testUserId);
      expect(sendResponse.body.content).toBe("Hello, World!");
      expect(sendResponse.body).toHaveProperty("createdAt");
      expect(sendResponse.body).toHaveProperty("updatedAt");

      const broadcastMessage = await msgPromise;
      expect(broadcastMessage.event).toBe("message.created");
      expect(broadcastMessage.data).toHaveProperty("id");
      expect(broadcastMessage.data.content).toBe("Hello, World!");
      expect(broadcastMessage.data.userId).toBe(testUserId);

      await closeWS(wsClient);
    }, 20000);

    test("Verify message stored in MongoDB", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "MongoDB Test Room" });

      const sendResponse = await request(app)
        .post(`/rooms/${room.id}/messages`)
        .set("x-user-id", testUserId)
        .send({ content: "Test message for MongoDB" });

      expect(sendResponse.status).toBe(201);

      const Message = mongoose.model("ChatMessage");
      const stored = await Message.findById(sendResponse.body.id).lean();

      expect(stored).toBeTruthy();
      expect(String(stored.roomId)).toBe(room.id);
      expect(stored.userId).toBe(testUserId);
      expect(stored.content).toBe("Test message for MongoDB");
      expect(stored.createdAt).toBeInstanceOf(Date);
      expect(stored.updatedAt).toBeInstanceOf(Date);
    });

    test("Verify RabbitMQ publish called", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "RabbitMQ Test Room" });

      await request(app)
        .post(`/rooms/${room.id}/messages`)
        .set("x-user-id", testUserId)
        .send({ content: "Test RabbitMQ publish" });

      expect(brokerService.publishMessageCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.any(String),
          roomId: room.id,
          userId: testUserId,
          timestamp: expect.any(String),
        })
      );
    });

    test("Multiple clients receive broadcast", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "Multi-client Test Room" });

      const roomId = room.id;

      const [client1, client2, client3] = await Promise.all([
        openWS(`ws://localhost:3003/ws?roomId=${roomId}&userId=user-1`),
        openWS(`ws://localhost:3003/ws?roomId=${roomId}&userId=user-2`),
        openWS(`ws://localhost:3003/ws?roomId=${roomId}&userId=user-3`),
      ]);
      await sleep(150);

      // Arm all listeners BEFORE the send
      const msgPromises = [client1, client2, client3].map((c) => waitForMessage(c));

      await request(app)
        .post(`/rooms/${roomId}/messages`)
        .set("x-user-id", testUserId)
        .send({ content: "Broadcast to all clients" });

      const messages = await Promise.all(msgPromises);

      expect(messages).toHaveLength(3);
      messages.forEach((msg) => {
        expect(msg.event).toBe("message.created");
        expect(msg.data.content).toBe("Broadcast to all clients");
      });

      await Promise.all([closeWS(client1), closeWS(client2), closeWS(client3)]);
    }, 20000);
  });

  // ── B. Receive Message History Flow ───────────────────────────────────────

  describe("B. Receive Message History Flow", () => {

    test("Seed multiple messages and retrieve history", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "History Test Room" });

      const roomId = room.id;
      const contents = [
        "First message", "Second message", "Third message",
        "Fourth message", "Fifth message",
      ];

      for (const content of contents) {
        const res = await request(app)
          .post(`/rooms/${roomId}/messages`)
          .set("x-user-id", testUserId)
          .send({ content });
        expect(res.status).toBe(201);
      }

      const { body } = await request(app)
        .get(`/rooms/${roomId}/messages`)
        .set("x-user-id", testUserId);

      expect(body.messages).toHaveLength(5);
      expect(body.messages[0].content).toBe("First message");
      expect(body.messages[4].content).toBe("Fifth message");
      expect(body.nextCursor).toBeNull();

      body.messages.forEach((msg) => {
        expect(msg).toHaveProperty("id");
        expect(msg.roomId).toBe(roomId);
        expect(msg.userId).toBe(testUserId);
        expect(msg).toHaveProperty("content");
        expect(msg).toHaveProperty("createdAt");
        expect(msg).toHaveProperty("updatedAt");
      });
    });

    test("Pagination with cursor", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "Pagination Test Room" });

      const roomId = room.id;

      for (let i = 1; i <= 25; i++) {
        await request(app)
          .post(`/rooms/${roomId}/messages`)
          .set("x-user-id", testUserId)
          .send({ content: `Message ${i}` });
      }

      const p1 = (await request(app)
        .get(`/rooms/${roomId}/messages?limit=10`)
        .set("x-user-id", testUserId)).body;
      expect(p1.messages).toHaveLength(10);
      expect(p1.nextCursor).toBeTruthy();

      const p2 = (await request(app)
        .get(`/rooms/${roomId}/messages?limit=10&cursor=${p1.nextCursor}`)
        .set("x-user-id", testUserId)).body;
      expect(p2.messages).toHaveLength(10);
      expect(p2.nextCursor).toBeTruthy();

      const p3 = (await request(app)
        .get(`/rooms/${roomId}/messages?limit=10&cursor=${p2.nextCursor}`)
        .set("x-user-id", testUserId)).body;
      expect(p3.messages).toHaveLength(5);
      expect(p3.nextCursor).toBeNull();

      const all = [...p1.messages, ...p2.messages, ...p3.messages];
      expect(all).toHaveLength(25);

      // No duplicates across pages
      expect(new Set(all.map((m) => m.id)).size).toBe(25);

      // Each page sorted oldest-first
      for (const page of [p1.messages, p2.messages, p3.messages]) {
        for (let i = 1; i < page.length; i++) {
          expect(new Date(page[i].createdAt).getTime())
            .toBeGreaterThanOrEqual(new Date(page[i - 1].createdAt).getTime());
        }
      }
    });

    test("Pagination with custom limit", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "Custom Limit Test Room" });

      const roomId = room.id;

      for (let i = 1; i <= 15; i++) {
        await request(app)
          .post(`/rooms/${roomId}/messages`)
          .set("x-user-id", testUserId)
          .send({ content: `Message ${i}` });
      }

      const r1 = (await request(app)
        .get(`/rooms/${roomId}/messages?limit=5`)
        .set("x-user-id", testUserId)).body;
      expect(r1.messages).toHaveLength(5);
      expect(r1.nextCursor).toBeTruthy();

      const r2 = (await request(app)
        .get(`/rooms/${roomId}/messages?limit=100`)
        .set("x-user-id", testUserId)).body;
      expect(r2.messages).toHaveLength(15);
      expect(r2.nextCursor).toBeNull();
    });

    test("Message ordering verification", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "Ordering Test Room" });

      const roomId = room.id;

      for (let i = 0; i < 10; i++) {
        await request(app)
          .post(`/rooms/${roomId}/messages`)
          .set("x-user-id", testUserId)
          .send({ content: `Ordered message ${i}` });
        await sleep(15);
      }

      const { body } = await request(app)
        .get(`/rooms/${roomId}/messages`)
        .set("x-user-id", testUserId);

      expect(body.messages).toHaveLength(10);

      for (let i = 0; i < body.messages.length; i++) {
        expect(body.messages[i].content).toBe(`Ordered message ${i}`);
      }

      for (let i = 1; i < body.messages.length; i++) {
        expect(new Date(body.messages[i].createdAt).getTime())
          .toBeGreaterThan(new Date(body.messages[i - 1].createdAt).getTime());
      }
    });

    test("Empty room message history", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "Empty Room" });

      const { body } = await request(app)
        .get(`/rooms/${room.id}/messages`)
        .set("x-user-id", testUserId);

      expect(body.messages).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    test("Non-existent room message history", async () => {
      const fakeRoomId = new mongoose.Types.ObjectId().toString();

      const { body, status } = await request(app)
        .get(`/rooms/${fakeRoomId}/messages`)
        .set("x-user-id", testUserId);

      expect(status).toBe(404);
      expect(body.error).toBe("Room not found");
    });
  });

  // ── Additional Integration Tests ───────────────────────────────────────────

  describe("Additional Integration Tests", () => {

    test("List all rooms", async () => {
      await request(app).post("/rooms").set("x-user-id", testUserId).send({ name: "Room 1" });
      await request(app).post("/rooms").set("x-user-id", testUserId).send({ name: "Room 2" });
      await request(app).post("/rooms").set("x-user-id", testUserId).send({ name: "Room 3" });

      const { body, status } = await request(app)
        .get("/rooms")
        .set("x-user-id", testUserId);

      expect(status).toBe(200);
      expect(body.rooms).toHaveLength(3);
      expect(body.rooms[0]).toHaveProperty("id");
      expect(body.rooms[0]).toHaveProperty("name");
      expect(body.rooms[0]).toHaveProperty("createdAt");
    });

    test("Health check endpoint", async () => {
      const { body, status } = await request(app).get("/health");
      expect(status).toBe(200);
      expect(body).toEqual({ status: "ok" });
    });

    test("Edit message", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "Edit Test Room" });

      const { body: msg } = await request(app)
        .post(`/rooms/${room.id}/messages`)
        .set("x-user-id", testUserId)
        .send({ content: "Original message" });

      const { body: edited, status } = await request(app)
        .put(`/rooms/${room.id}/messages/${msg.id}`)
        .set("x-user-id", testUserId)
        .send({ content: "Edited message" });

      expect(status).toBe(200);
      expect(edited.content).toBe("Edited message");
      expect(edited.id).toBe(msg.id);
    });

    test("Delete message", async () => {
      const { body: room } = await request(app)
        .post("/rooms")
        .set("x-user-id", testUserId)
        .send({ name: "Delete Test Room" });

      const { body: msg } = await request(app)
        .post(`/rooms/${room.id}/messages`)
        .set("x-user-id", testUserId)
        .send({ content: "Message to delete" });

      const { status } = await request(app)
        .delete(`/rooms/${room.id}/messages/${msg.id}`)
        .set("x-user-id", testUserId);

      expect(status).toBe(204);

      const stored = await mongoose.model("ChatMessage").findById(msg.id).lean();
      expect(stored).toBeNull();
    });

    test("Unauthorized access without user ID", async () => {
      const { body, status } = await request(app)
        .post("/rooms")
        .send({ name: "Unauthorized Room" });

      expect(status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });
  });
});