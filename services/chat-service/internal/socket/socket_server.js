const { WebSocketServer } = require("ws");
const { socketsByRoom } = require("../repository/chat_repository");
const { setActiveUsers } = require("../services/metrics_service");
const { publishUserPresence } = require("../services/broker_service");

function attachWebSocket(server, port) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const allClients = new Set();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const roomId = url.searchParams.get("roomId");
    const userId = url.searchParams.get("userId");
    if (!roomId) {
      ws.close(1008, "roomId is required");
      return;
    }

    if (!socketsByRoom.has(roomId)) {
      socketsByRoom.set(roomId, new Set());
    }
    socketsByRoom.get(roomId).add(ws);
    allClients.add(ws);
    setActiveUsers(allClients.size);
    if (userId) {
      publishUserPresence({ userId, roomId, timestamp: String(Date.now() / 1000) }, true).catch(() => {});
    }

    ws.on("close", () => {
      socketsByRoom.get(roomId)?.delete(ws);
      allClients.delete(ws);
      setActiveUsers(allClients.size);
      if (userId) {
        publishUserPresence({ userId, roomId, timestamp: String(Date.now() / 1000) }, false).catch(() => {});
      }
    });
  });

  return wss;
}

function broadcastToRoom(roomId, payload) {
  const roomSockets = socketsByRoom.get(roomId);
  if (!roomSockets) return;
  const data = JSON.stringify(payload);
  for (const ws of roomSockets) {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}

module.exports = { attachWebSocket, broadcastToRoom };
