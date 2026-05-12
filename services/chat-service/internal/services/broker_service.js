const amqp = require("amqplib");

let channel;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectBroker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
  const maxAttempts = 45;
  const delayMs = 2000;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const conn = await amqp.connect(amqpUrl);
      channel = await conn.createConfirmChannel();
      await channel.assertExchange("chat.events", "topic", { durable: true });
      return;
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      await sleep(delayMs);
    }
  }
  throw lastErr;
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
