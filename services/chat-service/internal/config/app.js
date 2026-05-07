const express = require("express");
const { registerRoutes } = require("../routes/routes");

function createApp(wsBroadcast) {
  const app = express();
  app.use(express.json());
  registerRoutes(app, wsBroadcast);
  return app;
}

module.exports = { createApp };
