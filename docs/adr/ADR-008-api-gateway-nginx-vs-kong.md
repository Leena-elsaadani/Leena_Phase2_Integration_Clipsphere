# ADR-008: API Gateway — OpenResty/NGINX instead of Kong

## Status
Accepted

## Context
The original architecture specification suggested Kong as the API Gateway.
During implementation, OpenResty (NGINX + Lua) was chosen instead.

## Decision
We use OpenResty (NGINX + Lua) as the API Gateway.

## Reasons
1. Simplicity: Kong adds operational overhead (requires its own database or
   DB-less config file, admin API, plugin management). For a course project
   with a tight deadline, OpenResty provides the same core features with
   less complexity.

2. Learning value: Writing Lua scripts for JWT validation, rate limiting,
   and header forwarding gave the team deeper understanding of how API
   gateways work internally, rather than configuring a black-box tool.

3. Lua flexibility: Custom JWT validation logic (RS256, Redis blacklist check,
   header injection of X-User-Id/X-User-Role/X-User-Email) was implemented
   in ~100 lines of Lua. The same in Kong would require a custom plugin.

4. Performance: OpenResty is the foundation Kong itself is built on.
   Raw performance is identical or better without the Kong abstraction layer.

5. Feature parity: All required gateway features are implemented:
   - JWT validation (RS256)
   - Rate limiting (per-user token bucket)
   - WebSocket proxying
   - Service routing
   - Redis integration for token blacklist

## Consequences
- No Kong admin API for dynamic route management
- No Kong plugin ecosystem
- Custom Lua maintenance required for gateway logic changes
- All required features for this project are fully covered

## Alternatives Considered
- Kong DB-less mode: rejected due to YAML config complexity
- Traefik: rejected due to limited custom auth middleware support
- Direct service exposure: rejected due to security concerns
