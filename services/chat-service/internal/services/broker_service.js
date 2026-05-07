const amqp = require("amqplib");

let channel;

async function connectBroker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
  const conn = await amqp.connect(amqpUrl);
  channel = await conn.createConfirmChannel();
  await channel.assertExchange("chat.events", "topic", { durable: true });
}

async function publishMessageCreated(payload) {
  if (!channel) return false;
  const ok = channel.publish("chat.events", "message.created", Buffer.from(JSON.stringify(payload)), {
    contentType: "application/json",
    persistent: true,
  });
  await channel.waitForConfirms();
  return ok;
}

async function publishUserPresence(payload, connected) {
  if (!channel) return false;
  const routingKey = connected ? "user.connected" : "user.disconnected";
  const ok = channel.publish("chat.events", routingKey, Buffer.from(JSON.stringify(payload)), {
    contentType: "application/json",
    persistent: true,
  });
  await channel.waitForConfirms();
  return ok;
}

module.exports = { connectBroker, publishMessageCreated, publishUserPresence };
