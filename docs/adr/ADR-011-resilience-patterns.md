# ADR-011: Resilience Patterns

## Status
Partially Implemented

## Decision
- Dashboard service: Circuit breaker on external HTTP calls (implemented)
- Chat service: Retry with exponential backoff on RabbitMQ publish (implemented)
- Auth/User services: No circuit breaker needed (direct DB calls,
  GORM handles connection pooling and retry)

## Rationale
Circuit breakers are most valuable on network calls to external services.
DB connections are managed by GORM connection pool which handles
reconnection automatically. Adding circuit breakers to every service
would add complexity without proportional benefit for this project scope.
