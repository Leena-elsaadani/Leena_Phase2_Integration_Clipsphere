import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const TOKEN = __ENV.TOKEN || "";

export const options = {
  scenarios: {
    chat_spike: {
      executor: "ramping-vus",
      startVUs: 50,
      stages: [
        { duration: "1m", target: 500 },
        { duration: "2m", target: 1000 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<200"],
    http_req_failed: ["rate<0.05"],
  },
};

const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

export default function () {
  const roomRes = http.post(`${BASE_URL}/rooms`, JSON.stringify({ name: `k6-room-${__VU}-${__ITER}`, ownerId: `u-${__VU}` }), { headers });
  if (roomRes.status !== 201 && roomRes.status !== 200) return;
  const roomId = JSON.parse(roomRes.body).id;

  const msgRes = http.post(`${BASE_URL}/rooms/${roomId}/messages`, JSON.stringify({ userId: `u-${__VU}`, content: "load message" }), { headers });
  check(msgRes, { "message sent": (r) => r.status === 200 });
  sleep(0.1);
}
