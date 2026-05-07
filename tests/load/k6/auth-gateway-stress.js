import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const TOKEN = __ENV.TOKEN || "";
const BLACKLISTED_TOKEN = __ENV.BLACKLISTED_TOKEN || "";

export const options = {
  vus: 300,
  duration: "3m",
  thresholds: {
    http_req_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.1"],
  },
};

export default function () {
  if (TOKEN) {
    const okRes = http.get(`${BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    check(okRes, { "valid token accepted": (r) => r.status === 200 || r.status === 404 });
  }

  if (BLACKLISTED_TOKEN) {
    const blocked = http.get(`${BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${BLACKLISTED_TOKEN}` } });
    check(blocked, { "blacklisted denied": (r) => r.status === 401 });
  }

  sleep(0.05);
}
