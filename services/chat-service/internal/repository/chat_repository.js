const mongoose = require("mongoose");
const metrics = require("../services/metrics_service");

const socketsByRoom = new Map();
const activeMembers = new Map();

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerId: { type: String, default: null },
    members: { type: [String], default: [] },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

const messageSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

const Room = mongoose.models.ChatRoom || mongoose.model("ChatRoom", roomSchema);
const Message = mongoose.models.ChatMessage || mongoose.model("ChatMessage", messageSchema);

async function connectMongo() {
  const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017/chatdb";
  await mongoose.connect(mongoUrl);
}

async function ensureRoom(roomId) {
  const room = await Room.findById(roomId).lean();
  if (!room) throw new Error("Room not found");
  return room;
}

async function createRoom(name, ownerId) {
  const room = await Room.create({
    name,
    ownerId,
    members: ownerId ? [ownerId] : [],
  });
  socketsByRoom.set(String(room._id), new Set());
  activeMembers.set(String(room._id), new Set(ownerId ? [ownerId] : []));
  return toRoomDto(room);
}

async function joinRoom(roomId, userId) {
  const room = await Room.findByIdAndUpdate(roomId, { $addToSet: { members: userId } }, { new: true });
  if (!room) throw new Error("Room not found");
  if (!activeMembers.has(roomId)) activeMembers.set(roomId, new Set());
  activeMembers.get(roomId).add(userId);
}

async function leaveRoom(roomId, userId) {
  const room = await Room.findByIdAndUpdate(roomId, { $pull: { members: userId } }, { new: true });
  if (!room) throw new Error("Room not found");
  activeMembers.get(roomId)?.delete(userId);
}

async function addMessage(roomId, userId, content) {
  const t0 = Date.now();
  try {
    await ensureRoom(roomId);
    const msg = await Message.create({ roomId, userId, content });
    return toMessageDto(msg);
  } finally {
    metrics.mongodbOperationDurationSeconds.observe({ operation: "insert" }, (Date.now() - t0) / 1000);
  }
}

async function getMessages(roomId, cursor, limit) {
  const t0 = Date.now();
  try {
    await ensureRoom(roomId);
    const query = { roomId };
    if (cursor) {
      query._id = { $lt: cursor };
    }
    const rows = await Message.find(query).sort({ _id: -1 }).limit(limit).lean();
    const messages = rows.map(toMessageDto).reverse();
    const nextCursor = rows.length === limit ? String(rows[rows.length - 1]._id) : null;
    return { messages, nextCursor };
  } finally {
    metrics.mongodbOperationDurationSeconds.observe({ operation: "find" }, (Date.now() - t0) / 1000);
  }
}

async function editMessage(roomId, messageId, userId, content) {
  const t0 = Date.now();
  try {
    const msg = await Message.findOne({ _id: messageId, roomId });
    if (!msg) throw new Error("Message not found");
    if (msg.userId !== userId) throw new Error("Forbidden");
    msg.content = content;
    await msg.save();
    return toMessageDto(msg);
  } finally {
    metrics.mongodbOperationDurationSeconds.observe({ operation: "update" }, (Date.now() - t0) / 1000);
  }
}

async function deleteMessage(roomId, messageId, userId) {
  const t0 = Date.now();
  try {
    const msg = await Message.findOne({ _id: messageId, roomId });
    if (!msg) throw new Error("Message not found");
    if (msg.userId !== userId) throw new Error("Forbidden");
    await Message.deleteOne({ _id: messageId });
  } finally {
    metrics.mongodbOperationDurationSeconds.observe({ operation: "delete" }, (Date.now() - t0) / 1000);
  }
}

async function listRooms() {
  const rows = await Room.find({}).sort({ createdAt: -1 }).lean();
  return rows.map(toRoomDto);
}

function toRoomDto(room) {
  return {
    id: String(room._id),
    name: room.name,
    ownerId: room.ownerId,
    createdAt: room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt,
  };
}

function toMessageDto(msg) {
  return {
    id: String(msg._id),
    roomId: String(msg.roomId),
    userId: msg.userId,
    content: msg.content,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
    updatedAt: msg.updatedAt ? (msg.updatedAt instanceof Date ? msg.updatedAt.toISOString() : msg.updatedAt) : null,
  };
}

module.exports = {
  socketsByRoom,
  activeMembers,
  connectMongo,
  createRoom,
  joinRoom,
  leaveRoom,
  addMessage,
  getMessages,
  editMessage,
  deleteMessage,
  listRooms,
};
