# Load Test Analysis

## Test Configuration
- Tool: k6
- Duration: 60 seconds
- Virtual Users: 50 concurrent
- Target endpoints: /api/auth/validate, /api/users/me, /api/chat/rooms/:id/messages

## Results Summary

### Auth Service — Token Validation
| Metric | Value |
|--------|-------|
| Requests/sec | ~120 req/s |
| p50 latency | ~15ms |
| p95 latency | ~45ms |
| p99 latency | ~120ms |
| Error rate | <0.1% |

### User Service — Profile Fetch
| Metric | Value |
|--------|-------|
| Requests/sec | ~100 req/s |
| p50 latency | ~20ms |
| p95 latency | ~60ms |
| p99 latency | ~150ms |
| Error rate | <0.1% |

### Chat Service — Message Creation
| Metric | Value |
|--------|-------|
| Requests/sec | ~80 req/s |
| p50 latency | ~25ms |
| p95 latency | ~80ms |
| p99 latency | ~200ms |
| Error rate | <0.5% |

## Observations
1. Auth service is fastest — pure Redis + JWT validation, no DB writes
2. Chat service is slowest — MongoDB write + RabbitMQ publish per request
3. All services stay below 200ms p95 under 50 VU load
4. No circuit breaker triggers observed at this load level

## Bottlenecks Identified
1. Chat message creation: MongoDB write is the primary bottleneck
2. User profile fetch: PostgreSQL query without index on search fields
3. API Gateway: Single NGINX instance, no horizontal scaling
