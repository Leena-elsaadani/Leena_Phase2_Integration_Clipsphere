function registerChatHandlers(app, deps) {
  const { chatService, metricsService, brokerService, wsBroadcast } = deps;

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", metricsService.register.contentType);
    res.send(await metricsService.register.metrics());
  });

  app.get("/metrics-summary", (_req, res) => {
    res.status(200).json(metricsService.getMetricsSummary());
  });

  app.post("/rooms", async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { name } = req.body || {};
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!name) return res.status(400).json({ error: "name is required" });
    const room = await chatService.createRoom(name, userId);
    return res.status(201).json(room);
  });

app.post("/rooms/:roomId/join", async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await chatService.joinRoom(req.params.roomId, userId);
    return res.status(200).json({ message: "joined" });
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

app.post("/rooms/:roomId/leave", async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await chatService.leaveRoom(req.params.roomId, userId);
    return res.status(200).json({ message: "left" });
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

  app.post("/rooms/:roomId/messages", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'];
      const { content } = req.body || {};
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!content) return res.status(400).json({ error: "content is required" });
      const msg = await chatService.addMessage(req.params.roomId, userId, content);
      metricsService.incMessages();
      const event = {
        messageId: msg.id,
        roomId: msg.roomId,
        userId: msg.userId,
        timestamp: String(Date.now() / 1000),
      };
      await brokerService.publishMessageCreated(event);
      wsBroadcast(req.params.roomId, { event: "message.created", data: msg });
      return res.status(200).json(msg);
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  });

  app.get("/rooms/:roomId/messages", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit || 20), 100);
      const data = await chatService.getMessages(req.params.roomId, req.query.cursor || null, limit);
      return res.status(200).json(data);
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  });

  app.put("/rooms/:roomId/messages/:messageId", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'];
      const { content } = req.body || {};
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!content) return res.status(400).json({ error: "content is required" });
      const msg = await chatService.editMessage(req.params.roomId, req.params.messageId, userId, content);
      wsBroadcast(req.params.roomId, { event: "message.updated", data: msg });
      return res.status(200).json(msg);
    } catch (err) {
      if (err.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
      return res.status(404).json({ error: err.message });
    }
  });

  app.delete("/rooms/:roomId/messages/:messageId", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'];
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      await chatService.deleteMessage(req.params.roomId, req.params.messageId, userId);
      wsBroadcast(req.params.roomId, { event: "message.deleted", data: { id: req.params.messageId } });
      return res.status(204).send();
    } catch (err) {
      if (err.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
      return res.status(404).json({ error: err.message });
    }
  });

  app.get("/rooms", async (_req, res) => {
    return res.status(200).json({ rooms: await chatService.listRooms() });
  });
}

module.exports = { registerChatHandlers };
