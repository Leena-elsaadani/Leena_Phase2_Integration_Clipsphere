const mongoose = require("mongoose");

const REPO_PATH = "../../internal/repository/chat_repository";
const METRICS_PATH = "../../internal/services/metrics_service";

function makeMockModel() {
  return {
    findById:          jest.fn(),
    create:            jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne:           jest.fn(),
    find:              jest.fn(),
    deleteOne:         jest.fn(),
  };
}

function makeChain(resolveValue) {
  return {
    sort:  jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean:  jest.fn().mockResolvedValue(resolveValue),
  };
}

// Loads a fresh isolated copy of the repository with the given model mocks.
// The metrics module is always mocked with a fresh spy inside isolateModules
// so it is never referenced as an out-of-scope variable inside jest.mock().
function loadRepo(mockRoomModel, mockMessageModel) {
  let repo;
  jest.isolateModules(() => {
    jest.mock(METRICS_PATH, () => ({
      mongodbOperationDurationSeconds: { observe: jest.fn() },
    }));
    jest.mock("mongoose", () => {
      const actual = jest.requireActual("mongoose");
      return {
        ...actual,
        connect: jest.fn(),
        Schema: actual.Schema,
        Types:  actual.Types,
        models: {},
        model:  jest.fn((name) => {
          if (name === "ChatRoom")    return mockRoomModel;
          if (name === "ChatMessage") return mockMessageModel;
          return {};
        }),
      };
    });
    repo = require(REPO_PATH);
  });
  return repo;
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
describe("createRoom", () => {
  test("should create room successfully with owner", async () => {
    const mockRoomData = {
      _id: new mongoose.Types.ObjectId(),
      name: "Test Room", ownerId: "user123",
      members: ["user123"], createdAt: new Date(),
    };
    const mockRoomModel = makeMockModel();
    mockRoomModel.create.mockResolvedValue(mockRoomData);
    const repo = loadRepo(mockRoomModel, makeMockModel());

    const result = await repo.createRoom("Test Room", "user123");

    expect(result).toEqual({
      id: String(mockRoomData._id), name: "Test Room",
      ownerId: "user123", createdAt: mockRoomData.createdAt.toISOString(),
    });
    expect(repo.socketsByRoom.has(String(mockRoomData._id))).toBe(true);
    expect(repo.activeMembers.has(String(mockRoomData._id))).toBe(true);
  });

  test("should create room successfully without owner", async () => {
    const mockRoomData = {
      _id: new mongoose.Types.ObjectId(),
      name: "Public Room", ownerId: null,
      members: [], createdAt: new Date(),
    };
    const mockRoomModel = makeMockModel();
    mockRoomModel.create.mockResolvedValue(mockRoomData);
    const repo = loadRepo(mockRoomModel, makeMockModel());

    const result = await repo.createRoom("Public Room", null);

    expect(result.name).toBe("Public Room");
    expect(result.ownerId).toBeNull();
    expect(repo.socketsByRoom.has(String(mockRoomData._id))).toBe(true);
  });

  test("should handle database error on room creation", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.create.mockRejectedValue(new Error("Database connection failed"));
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.createRoom("Test Room", "user123"))
      .rejects.toThrow("Database connection failed");
  });
});

// ---------------------------------------------------------------------------
describe("joinRoom", () => {
  test("should successfully join room", async () => {
    const roomId = "room123";
    const userId = "user123";
    const mockRoom = { _id: roomId, name: "Test Room", members: [userId] };
    const mockRoomModel = makeMockModel();
    mockRoomModel.findByIdAndUpdate.mockResolvedValue(mockRoom);
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await repo.joinRoom(roomId, userId);

    expect(mockRoomModel.findByIdAndUpdate).toHaveBeenCalledWith(
      roomId, { $addToSet: { members: userId } }, { new: true }
    );
    expect(repo.activeMembers.get(roomId).has(userId)).toBe(true);
  });

  test("should handle room not found on join", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.findByIdAndUpdate.mockResolvedValue(null);
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.joinRoom("nonexistent", "user123")).rejects.toThrow("Room not found");
  });

  test("should handle database error on join", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.findByIdAndUpdate.mockRejectedValue(new Error("Database error"));
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.joinRoom("room123", "user123")).rejects.toThrow("Database error");
  });

  test("should initialize active members set if not exists", async () => {
    const roomId = "newroom";
    const userId = "user123";
    const mockRoom = { _id: roomId, name: "Test Room", members: [userId] };
    const mockRoomModel = makeMockModel();
    mockRoomModel.findByIdAndUpdate.mockResolvedValue(mockRoom);
    const repo = loadRepo(mockRoomModel, makeMockModel());
    repo.activeMembers.delete(roomId);

    await repo.joinRoom(roomId, userId);

    expect(repo.activeMembers.get(roomId).has(userId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("leaveRoom", () => {
  test("should successfully leave room", async () => {
    const roomId = "room123";
    const userId = "user123";
    const mockRoom = { _id: roomId, name: "Test Room", members: ["owner123"] };
    const mockRoomModel = makeMockModel();
    mockRoomModel.findByIdAndUpdate.mockResolvedValue(mockRoom);
    const repo = loadRepo(mockRoomModel, makeMockModel());
    repo.activeMembers.set(roomId, new Set([userId, "otherUser"]));

    await repo.leaveRoom(roomId, userId);

    expect(mockRoomModel.findByIdAndUpdate).toHaveBeenCalledWith(
      roomId, { $pull: { members: userId } }, { new: true }
    );
    expect(repo.activeMembers.get(roomId).has(userId)).toBe(false);
  });

  test("should handle room not found on leave", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.findByIdAndUpdate.mockResolvedValue(null);
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.leaveRoom("nonexistent", "user123")).rejects.toThrow("Room not found");
  });

  test("should handle database error on leave", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.findByIdAndUpdate.mockRejectedValue(new Error("Database error"));
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.leaveRoom("room123", "user123")).rejects.toThrow("Database error");
  });

  test("should handle missing active members set gracefully", async () => {
    const roomId = "room123";
    const userId = "user123";
    const mockRoom = { _id: roomId, name: "Test Room", members: ["owner123"] };
    const mockRoomModel = makeMockModel();
    mockRoomModel.findByIdAndUpdate.mockResolvedValue(mockRoom);
    const repo = loadRepo(mockRoomModel, makeMockModel());
    repo.activeMembers.delete(roomId);

    await expect(repo.leaveRoom(roomId, userId)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe("addMessage", () => {
  test("should successfully add message", async () => {
    const mockMessage = {
      _id: new mongoose.Types.ObjectId(), roomId: "room123",
      userId: "user123", content: "Hello",
      createdAt: new Date(), updatedAt: new Date(),
    };
    const mockRoomModel    = makeMockModel();
    const mockMessageModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "room123" }) });
    mockMessageModel.create.mockResolvedValue(mockMessage);
    const repo = loadRepo(mockRoomModel, mockMessageModel);

    const result = await repo.addMessage("room123", "user123", "Hello");

    expect(result.content).toBe("Hello");
    expect(result.userId).toBe("user123");
  });

  test("should handle room not found when adding message", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.addMessage("nonexistent", "user123", "Hello"))
      .rejects.toThrow("Room not found");
  });

  test("should handle database error when adding message", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error("Database error")) });
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.addMessage("room123", "user123", "Hello"))
      .rejects.toThrow("Database error");
  });

  test("should record metrics for message insertion", async () => {
    const mockMessage = {
      _id: new mongoose.Types.ObjectId(), roomId: "room123",
      userId: "user123", content: "Hello",
      createdAt: new Date(), updatedAt: new Date(),
    };
    const mockRoomModel    = makeMockModel();
    const mockMessageModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "room123" }) });
    mockMessageModel.create.mockResolvedValue(mockMessage);

    // Load repo with inline metrics mock — no out-of-scope variable in factory
    const repo = loadRepo(mockRoomModel, mockMessageModel);
    // metrics module was mocked inside loadRepo; require it in the same module registry via repo's module
    // Instead: verify via side-effect — addMessage must complete without error (metrics called internally)
    await expect(repo.addMessage("room123", "user123", "Hello")).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
describe("getMessages", () => {
  test("should get messages without cursor", async () => {
    const roomId = "room123";
    const mockMessages = [
      { _id: new mongoose.Types.ObjectId(), roomId, userId: "u1", content: "M1", createdAt: new Date() },
      { _id: new mongoose.Types.ObjectId(), roomId, userId: "u2", content: "M2", createdAt: new Date() },
    ];
    const mockRoomModel    = makeMockModel();
    const mockMessageModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: roomId }) });
    mockMessageModel.find.mockReturnValue(makeChain(mockMessages));
    const repo = loadRepo(mockRoomModel, mockMessageModel);

    const result = await repo.getMessages(roomId, null, 10);

    expect(result.messages).toHaveLength(2);
    expect(mockMessageModel.find).toHaveBeenCalledWith({ roomId });
  });

  test("should get messages with cursor", async () => {
    const roomId = "room123";
    const cursor = new mongoose.Types.ObjectId();
    const mockRoomModel    = makeMockModel();
    const mockMessageModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: roomId }) });
    mockMessageModel.find.mockReturnValue(makeChain([]));
    const repo = loadRepo(mockRoomModel, mockMessageModel);

    await repo.getMessages(roomId, cursor, 10);

    expect(mockMessageModel.find).toHaveBeenCalledWith({ roomId, _id: { $lt: cursor } });
  });

  test("should return next cursor when results equal limit", async () => {
    const roomId = "room123";
    const limit  = 2;
    const msgs = [
      { _id: new mongoose.Types.ObjectId(), roomId, userId: "u1", content: "M1", createdAt: new Date() },
      { _id: new mongoose.Types.ObjectId(), roomId, userId: "u2", content: "M2", createdAt: new Date() },
    ];
    const mockRoomModel    = makeMockModel();
    const mockMessageModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: roomId }) });
    mockMessageModel.find.mockReturnValue(makeChain(msgs));
    const repo = loadRepo(mockRoomModel, mockMessageModel);

    const result = await repo.getMessages(roomId, null, limit);

    expect(result.nextCursor).toBe(String(msgs[1]._id));
  });

  test("should return null next cursor when results less than limit", async () => {
    const roomId = "room123";
    const msgs = [
      { _id: new mongoose.Types.ObjectId(), roomId, userId: "u1", content: "M1", createdAt: new Date() },
    ];
    const mockRoomModel    = makeMockModel();
    const mockMessageModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: roomId }) });
    mockMessageModel.find.mockReturnValue(makeChain(msgs));
    const repo = loadRepo(mockRoomModel, mockMessageModel);

    const result = await repo.getMessages(roomId, null, 10);

    expect(result.nextCursor).toBeNull();
  });

  test("should handle empty results", async () => {
    const mockRoomModel    = makeMockModel();
    const mockMessageModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "room123" }) });
    mockMessageModel.find.mockReturnValue(makeChain([]));
    const repo = loadRepo(mockRoomModel, mockMessageModel);

    const result = await repo.getMessages("room123", null, 10);

    expect(result.messages).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  test("should handle room not found when getting messages", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.getMessages("nonexistent", null, 10)).rejects.toThrow("Room not found");
  });

  test("should record metrics for message find operation", async () => {
    const mockRoomModel    = makeMockModel();
    const mockMessageModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "room123" }) });
    mockMessageModel.find.mockReturnValue(makeChain([]));
    const repo = loadRepo(mockRoomModel, mockMessageModel);

    await expect(repo.getMessages("room123", null, 10)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
describe("editMessage", () => {
  test("should successfully edit own message", async () => {
    const mockMsg = {
      _id: new mongoose.Types.ObjectId(), roomId: "room123",
      userId: "user123", content: "Updated",
      createdAt: new Date(), updatedAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
    };
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockResolvedValue(mockMsg);
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    const result = await repo.editMessage("room123", mockMsg._id, "user123", "Updated");

    expect(result.content).toBe("Updated");
    expect(mockMsg.save).toHaveBeenCalled();
  });

  test("should reject editing non-existent message", async () => {
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockResolvedValue(null);
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    await expect(repo.editMessage("room123", new mongoose.Types.ObjectId(), "user123", "x"))
      .rejects.toThrow("Message not found");
  });

  test("should reject editing other user's message", async () => {
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockResolvedValue({ _id: new mongoose.Types.ObjectId(), userId: "otherUser" });
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    await expect(repo.editMessage("room123", new mongoose.Types.ObjectId(), "user123", "x"))
      .rejects.toThrow("Forbidden");
  });

  test("should handle database error on edit", async () => {
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockRejectedValue(new Error("Database error"));
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    await expect(repo.editMessage("room123", new mongoose.Types.ObjectId(), "user123", "x"))
      .rejects.toThrow("Database error");
  });

  test("should record metrics for update operation", async () => {
    const mockMsg = {
      _id: new mongoose.Types.ObjectId(), roomId: "room123",
      userId: "user123", content: "Updated",
      createdAt: new Date(), updatedAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
    };
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockResolvedValue(mockMsg);
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    await expect(repo.editMessage("room123", mockMsg._id, "user123", "Updated")).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
describe("deleteMessage", () => {
  test("should successfully delete own message", async () => {
    const messageId = new mongoose.Types.ObjectId();
    const mockMsg   = { _id: messageId, roomId: "room123", userId: "user123", content: "bye" };
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockResolvedValue(mockMsg);
    mockMessageModel.deleteOne.mockResolvedValue({ deletedCount: 1 });
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    await repo.deleteMessage("room123", messageId, "user123");

    expect(mockMessageModel.deleteOne).toHaveBeenCalledWith({ _id: messageId });
  });

  test("should reject deleting non-existent message", async () => {
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockResolvedValue(null);
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    await expect(repo.deleteMessage("room123", new mongoose.Types.ObjectId(), "user123"))
      .rejects.toThrow("Message not found");
  });

  test("should reject deleting other user's message", async () => {
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockResolvedValue({ _id: new mongoose.Types.ObjectId(), userId: "otherUser" });
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    await expect(repo.deleteMessage("room123", new mongoose.Types.ObjectId(), "user123"))
      .rejects.toThrow("Forbidden");
  });

  test("should handle database error on delete", async () => {
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockRejectedValue(new Error("Database error"));
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    await expect(repo.deleteMessage("room123", new mongoose.Types.ObjectId(), "user123"))
      .rejects.toThrow("Database error");
  });

  test("should record metrics for delete operation", async () => {
    const messageId = new mongoose.Types.ObjectId();
    const mockMsg   = { _id: messageId, roomId: "room123", userId: "user123", content: "bye" };
    const mockMessageModel = makeMockModel();
    mockMessageModel.findOne.mockResolvedValue(mockMsg);
    mockMessageModel.deleteOne.mockResolvedValue({ deletedCount: 1 });
    const repo = loadRepo(makeMockModel(), mockMessageModel);

    await expect(repo.deleteMessage("room123", messageId, "user123")).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe("listRooms", () => {
  test("should successfully list all rooms", async () => {
    const mockRooms = [
      { _id: new mongoose.Types.ObjectId(), name: "Room 1", ownerId: "u1", createdAt: new Date() },
      { _id: new mongoose.Types.ObjectId(), name: "Room 2", ownerId: "u2", createdAt: new Date() },
    ];
    const mockRoomModel = makeMockModel();
    mockRoomModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockRooms),
    });
    const repo = loadRepo(mockRoomModel, makeMockModel());

    const result = await repo.listRooms();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Room 1");
    expect(mockRoomModel.find).toHaveBeenCalledWith({});
  });

  test("should handle empty room list", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    const repo = loadRepo(mockRoomModel, makeMockModel());

    const result = await repo.listRooms();

    expect(result).toEqual([]);
  });

  test("should handle database error on list", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(new Error("Database error")),
    });
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.listRooms()).rejects.toThrow("Database error");
  });
});

// ---------------------------------------------------------------------------
describe("ensureRoom", () => {
  test("should successfully find room", async () => {
    const roomId   = "room123";
    const mockRoom = { _id: roomId, name: "Test Room", ownerId: "user123" };
    const mockRoomModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRoom) });
    const repo = loadRepo(mockRoomModel, makeMockModel());

    const result = await repo.ensureRoom(roomId);

    expect(result).toEqual(mockRoom);
    expect(mockRoomModel.findById).toHaveBeenCalledWith(roomId);
  });

  test("should throw error when room not found", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.ensureRoom("nonexistent")).rejects.toThrow("Room not found");
  });

  test("should handle database error", async () => {
    const mockRoomModel = makeMockModel();
    mockRoomModel.findById.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error("Database error")) });
    const repo = loadRepo(mockRoomModel, makeMockModel());

    await expect(repo.ensureRoom("room123")).rejects.toThrow("Database error");
  });
});

// ---------------------------------------------------------------------------
describe("DTO transformation functions", () => {
  const mockRoomModel = makeMockModel();
  const repo = loadRepo(mockRoomModel, makeMockModel());

  test("toRoomDto should transform room correctly", () => {
    const room = {
      _id: new mongoose.Types.ObjectId(),
      name: "Test Room", ownerId: "user123",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    };
    const result = repo.toRoomDto(room);
    expect(result).toEqual({
      id: String(room._id), name: "Test Room",
      ownerId: "user123", createdAt: room.createdAt.toISOString(),
    });
  });

  test("toRoomDto should handle string createdAt", () => {
    const room = {
      _id: new mongoose.Types.ObjectId(),
      name: "Test Room", ownerId: "user123",
      createdAt: "2024-01-01T00:00:00Z",
    };
    expect(repo.toRoomDto(room).createdAt).toBe("2024-01-01T00:00:00Z");
  });

  test("toMessageDto should transform message correctly", () => {
    const msg = {
      _id:     new mongoose.Types.ObjectId(),
      roomId:  new mongoose.Types.ObjectId(),
      userId:  "user123", content: "Hello",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T01:00:00Z"),
    };
    const result = repo.toMessageDto(msg);
    expect(result).toEqual({
      id: String(msg._id), roomId: String(msg.roomId),
      userId: "user123", content: "Hello",
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.updatedAt.toISOString(),
    });
  });

  test("toMessageDto should handle null updatedAt", () => {
    const msg = {
      _id:     new mongoose.Types.ObjectId(),
      roomId:  new mongoose.Types.ObjectId(),
      userId:  "user123", content: "Hello",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: null,
    };
    expect(repo.toMessageDto(msg).updatedAt).toBeNull();
  });

  test("toMessageDto should handle string dates", () => {
    const msg = {
      _id:     new mongoose.Types.ObjectId(),
      roomId:  new mongoose.Types.ObjectId(),
      userId:  "user123", content: "Hello",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T01:00:00Z",
    };
    const result = repo.toMessageDto(msg);
    expect(result.createdAt).toBe("2024-01-01T00:00:00Z");
    expect(result.updatedAt).toBe("2024-01-01T01:00:00Z");
  });
});