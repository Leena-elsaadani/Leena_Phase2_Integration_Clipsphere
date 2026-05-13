const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const activeUsers = new client.Gauge({
  name: "chat_active_users",
  help: "Active websocket users in chat service",
  registers: [register],
});

const messagesTotal = new client.Counter({
  name: "chat_messages_total",
  help: "Total chat messages sent",
  registers: [register],
});

const mongodbOperationDurationSeconds = new client.Histogram({
  name: "mongodb_operation_duration_seconds",
  help: "MongoDB operation duration in seconds",
  labelNames: ["operation"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const rabbitmqPublishDurationSeconds = new client.Histogram({
  name: "rabbitmq_publish_duration_seconds",
  help: "RabbitMQ publish duration in seconds",
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const rabbitmqPublishErrorsTotal = new client.Counter({
  name: "rabbitmq_publish_errors_total",
  help: "RabbitMQ publish failures or blocked sends",
  registers: [register],
});

let activeUsersValue = 0;
let messageVolumeTimeline = [];

function setActiveUsers(count) {
  activeUsersValue = count;
  activeUsers.set(count);
}

function incMessages() {
  messagesTotal.inc();
  const bucket = Math.floor(Date.now() / 60000) * 60000;
  const last = messageVolumeTimeline[messageVolumeTimeline.length - 1];
  if (!last || last.ts !== bucket) {
    messageVolumeTimeline.push({ ts: bucket, count: 1 });
  } else {
    last.count += 1;
  }
  if (messageVolumeTimeline.length > 120) {
    messageVolumeTimeline = messageVolumeTimeline.slice(-120);
  }
}

function getMetricsSummary() {
  return { activeUsers: activeUsersValue, messageVolume: messageVolumeTimeline };
}

module.exports = {
  register,
  setActiveUsers,
  incMessages,
  getMetricsSummary,
  mongodbOperationDurationSeconds,
  rabbitmqPublishDurationSeconds,
  rabbitmqPublishErrorsTotal,
};
