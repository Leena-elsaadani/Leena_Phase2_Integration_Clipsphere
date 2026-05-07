import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const TOKEN = __ENV.TOKEN || "";

export const options = {
  vus: 500,
  duration: "2m",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<250"],
  },
};

const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

export default function () {
  const roomRes = http.post(`${BASE_URL}/rooms`, JSON.stringify({ name: `metrics-room-${__VU}-${__ITER}` }), { headers });
  if (roomRes.status !== 201 && roomRes.status !== 200) return;
  const roomId = JSON.parse(roomRes.body).id;

  const msgRes = http.post(
    `${BASE_URL}/rooms/${roomId}/messages`,
    JSON.stringify({ userId: `user-${__VU}`, content: "metrics load event" }),
    { headers }
  );
  check(msgRes, { "message accepted": (r) => r.status === 200 });

  const dashboard = http.get(`${BASE_URL}/dashboard/message-volume`, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} });
  check(dashboard, { "dashboard responds": (r) => r.status === 200 || r.status === 401 });
  sleep(0.1);
}
