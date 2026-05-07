const express = require("express");
const request = require("supertest");
const { registerChatHandlers } = require("../../internal/handlers/chat_handler");

describe("chat handler unit", () => {
  function makeApp(overrides = {}) {
    const app = express();
    app.use(express.json());
    const deps = {
      chatService: {
        createRoom: jest.fn(),
        joinRoom: jest.fn(),
        leaveRoom: jest.fn(),
        addMessage: jest.fn().mockResolvedValue({
          id: "m1",
          roomId: "r1",
          userId: "u1",
          content: "hello",
        }),
        getMessages: jest.fn(),
        editMessage: jest.fn(),
        deleteMessage: jest.fn(),
        listRooms: jest.fn().mockResolvedValue([]),
      },
      metricsService: {
        incMessages: jest.fn(),
        register: { contentType: "text/plain", metrics: jest.fn().mockResolvedValue("") },
        getMetricsSummary: jest.fn().mockReturnValue({}),
      },
      brokerService: { publishMessageCreated: jest.fn().mockResolvedValue(true) },
      wsBroadcast: jest.fn(),
      ...overrides,
    };
    registerChatHandlers(app, deps);
    return { app, deps };
  }

  test("message creation publishes broker event", async () => {
    const { app, deps } = makeApp();
    const res = await request(app).post("/rooms/r1/messages").send({ userId: "u1", content: "hello" });
    expect(res.status).toBe(200);
    expect(deps.brokerService.publishMessageCreated).toHaveBeenCalledTimes(1);
    expect(deps.metricsService.incMessages).toHaveBeenCalledTimes(1);
  });

  test("join validation rejects empty userId", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/rooms/r1/join").send({});
    expect(res.status).toBe(400);
  });

  test("leave validation rejects empty userId", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/rooms/r1/leave").send({});
    expect(res.status).toBe(400);
  });
});

describe("broker publish function", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("publish returns false when channel is not connected", async () => {
    const broker = require("../../internal/services/broker_service");
    await expect(broker.publishMessageCreated({ messageId: "m1" })).resolves.toBe(false);
  });

  test("connectBroker creates durable exchange", async () => {
    const mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockReturnValue(true),
      waitForConfirms: jest.fn().mockResolvedValue(undefined),
    };
    const mockConn = { createConfirmChannel: jest.fn().mockResolvedValue(mockChannel) };
    jest.doMock("amqplib", () => ({ connect: jest.fn().mockResolvedValue(mockConn) }));

    const broker = require("../../internal/services/broker_service");
    await broker.connectBroker();
    expect(mockChannel.assertExchange).toHaveBeenCalledWith("chat.events", "topic", { durable: true });
  });
});
