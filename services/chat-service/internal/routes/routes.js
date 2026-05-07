const { registerChatHandlers } = require("../handlers/chat_handler");
const chatService = require("../services/chat_service");
const metricsService = require("../services/metrics_service");
const brokerService = require("../services/broker_service");

function registerRoutes(app, wsBroadcast) {
  registerChatHandlers(app, { chatService, metricsService, brokerService, wsBroadcast });
}

module.exports = { registerRoutes };
