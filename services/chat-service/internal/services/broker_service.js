const amqp = require("amqplib");
const metrics = require("./metrics_service");

let channel;
const circuit = {
  failureCount: 0,
  state: "CLOSED",
  lastFailureTime: 0,
  testInProgress: false,
};

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

const OPEN_THRESHOLD = 5;
const OPEN_TIMEOUT_MS = 30000;

function openCircuit() {
  circuit.failureCount = 0;
  circuit.state = "OPEN";
  circuit.lastFailureTime = Date.now();
  circuit.testInProgress = false;
}

function resetCircuit() {
  circuit.failureCount = 0;
  circuit.state = "CLOSED";
  circuit.lastFailureTime = 0;
  circuit.testInProgress = false;
}

function allowRequest() {
  if (circuit.state === "OPEN") {
    if (Date.now() - circuit.lastFailureTime >= OPEN_TIMEOUT_MS) {
      if (circuit.testInProgress) {
        return false;
      }
      circuit.state = "HALF_OPEN";
      circuit.testInProgress = true;
      return true;
    }
    return false;
  }
  if (circuit.state === "HALF_OPEN") {
    return false;
  }
  return true;
}

function handlePublishSuccess() {
  if (circuit.state === "HALF_OPEN") {
    resetCircuit();
    return;
  }
  circuit.failureCount = 0;
}

function handlePublishFailure() {
  if (circuit.state === "HALF_OPEN") {
    openCircuit();
    return;
  }

  circuit.failureCount += 1;
  if (circuit.failureCount >= OPEN_THRESHOLD) {
    openCircuit();
  }
}

async function publishEvent(routingKey, payload) {
  if (!channel || !allowRequest()) return false;

  try {
    const ok = channel.publish("chat.events", routingKey, Buffer.from(JSON.stringify(payload)), {
      contentType: "application/json",
      persistent: true,
    });
    await channel.waitForConfirms();
    handlePublishSuccess();
    return ok;
  } catch (err) {
    handlePublishFailure();
    return false;
  }
}

async function retryWithBackoff(fn, retries=3, delayMs=500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch(err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
}

async function publishMessageCreated(payload) {
  return retryWithBackoff(async () => {
    const t0 = Date.now();
    try {
      const ok = await publishEvent("message.created", payload);
      if (!ok) {
        metrics.rabbitmqPublishErrorsTotal.inc();
        throw new Error("Publish failed");
      }
      return ok;
    } finally {
      metrics.rabbitmqPublishDurationSeconds.observe((Date.now() - t0) / 1000);
    }
  });
}

async function publishUserPresence(payload, connected) {
  return retryWithBackoff(async () => {
    const routingKey = connected ? "user.connected" : "user.disconnected";
    const ok = await publishEvent(routingKey, payload);
    if (!ok) throw new Error("Publish failed");
    return ok;
  });
}

module.exports = { connectBroker, publishMessageCreated, publishUserPresence };
