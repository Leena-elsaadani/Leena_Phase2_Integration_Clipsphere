# Phase 2 Test Layers

This repository includes four test layers:

- `tests/integration`: end-to-end system flow checks through API gateway and service boundaries.
- `tests/contract`: API schema compatibility checks (Pact-equivalent, schema-based).
- `tests/load/k6`: k6 load/stress scenarios.
- Service-level unit tests under each service:
  - `services/auth-service/tests/unit`
  - `services/user-service/tests/unit`
  - `services/chat-service/tests/unit`
  - `services/dashboard-service/tests/unit`

## Run order (recommended)

1. Integration tests
2. Unit tests + coverage
3. Load tests
4. Contract tests

## Notes

- Tests are additive and do not modify production logic.
- Integration/contract tests use live HTTP and can be gated by environment variables.
