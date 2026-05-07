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

module.exports = { register, setActiveUsers, incMessages, getMetricsSummary };
