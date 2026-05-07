const { createApp } = require("../internal/config/app");
const { attachWebSocket, broadcastToRoom } = require("../internal/socket/socket_server");
const chatRepository = require("../internal/repository/chat_repository");
const brokerService = require("../internal/services/broker_service");

const PORT = process.env.PORT || 3002;

async function start() {
  await chatRepository.connectMongo();
  await brokerService.connectBroker();

  const app = createApp(broadcastToRoom);
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Chat Service] Listening on port ${PORT}`);
  });
  attachWebSocket(server, PORT);
}

if (require.main === module) {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[Chat Service] Failed to start:", err);
    process.exit(1);
  });
}

module.exports = { start };
