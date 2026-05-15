# ADR-010: Database Sharding Strategy

## Status
Proposed (not yet implemented)

## Context
The system uses PostgreSQL for user/auth data and MongoDB for chat messages.
As the system scales, single-node databases become bottlenecks.

## Decision
We document the sharding strategy for future implementation.
Current implementation uses single-node databases suitable for the
current scale of a course project demo.

## PostgreSQL Sharding Strategy
- Shard key: user_id (UUID)
- Method: Range-based or hash-based sharding using Citus extension
- Auth service shard: users table partitioned by user_id hash % N
- User service shard: profiles table co-located with auth shard
- Why UUID: UUIDs distribute evenly across shards, no hotspots
- Cross-shard queries: avoided by keeping user data co-located

## MongoDB Sharding Strategy  
- Shard key: { roomId: 1, _id: 1 } compound key
- Method: Range-based sharding on roomId for locality
- Why roomId: Messages in the same room are queried together,
  range sharding keeps them on the same shard = fewer cross-shard reads
- _id as secondary key: prevents hotspots within a single room
- Config servers: 3-node replica set for shard metadata
- Mongos router: deployed alongside API Gateway

## Current Implementation
- PostgreSQL: UUID primary keys on all tables (shard-ready)
- MongoDB: roomId field on all messages (shard-ready)
- No sharding implemented — single node sufficient for demo scale

## Consequences
- Future sharding requires no schema changes (keys already correct)
- Application code requires no changes (shard key in all queries)
- Operational complexity increases significantly when sharding is enabled
