# ADR-001: Microservices Architecture Over Monolith

## Status
Accepted

## Context
The application has three components with fundamentally different load profiles:
- **Chat Service** — high write throughput, real-time WebSocket connections
- **Dashboard Service** — read-heavy, aggregation queries
- **Auth Service** — security-critical, low latency required on every request

A monolithic architecture cannot scale these independently. A failure in the Dashboard
would take down the entire system including Auth and Chat.

## Decision
We adopt a microservices architecture with four independently deployable services:
Auth, Chat, User, and Dashboard. Each service owns its own database (database-per-service pattern).
An API Gateway serves as the single entry point for all client traffic.

## Consequences
**Positive:**
- Each service scales independently based on its own load
- Fault isolation: a Dashboard failure does not affect Auth or Chat
- Technology freedom: each service can use the best-fit language and framework
- Teams can develop and deploy services independently

**Negative:**
- Higher operational complexity (more things to deploy, monitor, and debug)
- Network latency on inter-service calls compared to in-process calls
- Requires API Gateway and distributed tracing for observability

## Resilience Strategy
- Retry policy uses exponential backoff for transient failures: 100ms, 200ms, 400ms.
- Chat service RabbitMQ publishing supports an in-memory circuit breaker that opens after 5 failures and retries after 30 seconds.
- User service database resilience includes connection pool limits and connection lifetime controls.
- Auth service retries OAuth token exchange only on network errors, with a 5 second total timeout.

## Alternatives Considered
- **Monolith** — Rejected. Cannot scale Chat and Dashboard independently. Single point of failure.
- **Serverless** — Rejected. Cold start latency is incompatible with real-time WebSocket chat.