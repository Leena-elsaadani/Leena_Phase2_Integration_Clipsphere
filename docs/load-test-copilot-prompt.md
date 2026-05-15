# Copilot Prompt — Load Test Execution & Results Documentation

> **Purpose:** Use this prompt verbatim (or paste it into GitHub Copilot Chat / any
> LLM-assisted editor) to run the three existing k6 load tests, capture their
> raw output, and produce a finished Markdown results section for the project report.
>
> **Scope:** Read-only against running scripts. No new test files. No code changes.

---

## THE PROMPT

```
You are a performance-engineering assistant for a microservices chat platform.

Three k6 load-test scripts already exist in the repository at:

  tests/load/k6/auth-gateway-stress.js
  tests/load/k6/chat-load.js
  tests/load/k6/dashboard-metrics-load.js

Your job is to:
  1. Show the exact shell commands needed to run each script.
  2. Explain what metrics k6 will emit and which ones matter for this project.
  3. Accept raw k6 terminal output (which I will paste) and extract the key numbers.
  4. Format those numbers into a complete Markdown results section ready for the
     project report.

---

### STEP 1 — Run Commands

Generate the exact commands to run each script. Use the environment variables
the scripts already declare. Substitute the placeholder values shown below:

  BASE_URL          = http://localhost:8080          (API gateway)
  TOKEN             = <a valid JWT from /auth/google/callback>
  BLACKLISTED_TOKEN = <a JWT that has been logged out via POST /auth/logout>

Output one fenced shell block per script, labelled with the script name.

The three scripts and their declared options are:

  auth-gateway-stress.js
    - 300 VUs, 3 minutes flat
    - Thresholds: p(95) latency < 300 ms, error rate < 10 %
    - Endpoints tested: GET /users/me (with valid token), GET /users/me (with
      blacklisted token)
    - Env vars required: BASE_URL, TOKEN, BLACKLISTED_TOKEN

  chat-load.js
    - Ramping-VUs scenario named "chat_spike"
    - Stages: 50 → 500 VUs over 1 min, hold 500 → 1000 VUs over 2 min,
      ramp down to 0 over 1 min; 30 s graceful ramp-down
    - Thresholds: p(95) latency < 200 ms, error rate < 5 %
    - Endpoints tested: POST /rooms, POST /rooms/{id}/messages
    - Env vars required: BASE_URL, TOKEN

  dashboard-metrics-load.js
    - 500 VUs, 2 minutes flat
    - Thresholds: p(95) latency < 250 ms, error rate < 5 %
    - Endpoints tested: POST /rooms, POST /rooms/{id}/messages,
      GET /dashboard/message-volume
    - Env vars required: BASE_URL, TOKEN

---

### STEP 2 — Metrics Explanation

After showing the commands, explain which k6 built-in metrics to focus on
for this project and why. Cover exactly these metrics in a small Markdown table:

  http_req_duration       (p50, p90, p95, p99, max)
  http_req_failed         (rate as a percentage)
  http_reqs               (total count and requests/second)
  iterations              (total VU iterations completed)
  vus_max                 (peak concurrent virtual users reached)
  checks                