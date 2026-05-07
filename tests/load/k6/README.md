# k6 Load/Stress Scenarios

## Prerequisites

- Run system stack (`docker compose up`) with gateway on `:8080`.
- Provide token(s) through env vars.

## Scenarios

- `chat-load.js`: 1000 VUs ramp for concurrent message posting.
- `auth-gateway-stress.js`: repeated gateway validation + blacklisted token checks.
- `dashboard-metrics-load.js`: high write/read pressure for chat-driven dashboard metrics.

## Commands

```bash
k6 run tests/load/k6/chat-load.js -e BASE_URL=http://localhost:8080 -e TOKEN=<valid_jwt>
k6 run tests/load/k6/auth-gateway-stress.js -e BASE_URL=http://localhost:8080 -e TOKEN=<valid_jwt> -e BLACKLISTED_TOKEN=<revoked_jwt>
k6 run tests/load/k6/dashboard-metrics-load.js -e BASE_URL=http://localhost:8080 -e TOKEN=<valid_jwt>
```
