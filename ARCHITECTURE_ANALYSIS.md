# Scalable Real-Time Chat Platform — Comprehensive Architecture Analysis

**Date:** May 14, 2026  
**Platform:** Microservices-based real-time chat with dashboard and observability

---

## Table of Contents
1. [Overview](#overview)
2. [Service Catalog](#service-catalog)
3. [HTTP API Endpoints](#http-api-endpoints)
4. [Database Models & Schema](#database-models--schema)
5. [Metrics & Prometheus](#metrics--prometheus)
6. [WebSocket Implementation](#websocket-implementation)
7. [Message Broker (RabbitMQ)](#message-broker-rabbitmq)
8. [Resilience Patterns](#resilience-patterns)
9. [Authentication & Authorization](#authentication--authorization)
10. [Error Handling](#error-handling)
11. [Logging Setup](#logging-setup)
12. [Testing Strategy](#testing-strategy)
13. [Infrastructure](#infrastructure)

---

## Overview

The platform is built on a **microservices architecture** with four independent services:
- **Auth Service** (Go/Gin) — OAuth2 + JWT authentication
- **User Service** (Go/Gin) — User profile management
- **Chat Service** (Node.js/Express) — Real-time messaging with WebSocket
- **Dashboard Service** (Python/FastAPI) — Analytics & system health monitoring

**Key Technologies:**
- **Databases:** PostgreSQL (Auth, User), MongoDB (Chat)
- **Caching:** Redis (sessions, metrics)
- **Message Broker:** RabbitMQ (async event publishing)
- **Observability:** Prometheus + Grafana + OpenSearch
- **API Gateway:** Kong/NGINX (centralized auth, rate limiting)
- **Containerization:** Docker + Docker Compose

---

## Service Catalog

### 1. Auth Service

**Language:** Go 1.24  
**Framework:** Gin web framework  
**Port:** 8081 (internal), exposed via API Gateway  
**Database:** PostgreSQL (`authdb` schema)  
**Cache:** Redis (session store, token blacklist)  

**Dependencies:**
- `github.com/gin-gonic/gin` — Web framework
- `github.com/golang-jwt/jwt/v5` — RS256 JWT signing
- `golang.org/x/oauth2` — Google OAuth2
- `gorm.io/gorm` — ORM for PostgreSQL
- `github.com/go-redis/redis/v8` — Redis client
- `github.com/prometheus/client_golang` — Prometheus metrics

**Main Entry Point:** `services/auth-service/cmd/main.go`

**Initialization Flow:**
```go
1. Load configuration from .env
2. Initialize PostgreSQL connection (GORM)
3. Run database schema migrations
4. Initialize Redis client
5. Create AuthService (handles OAuth2, JWT, sessions)
6. Start Gin server on port 8081
7. Register Prometheus middleware on all routes
```

---

## HTTP API Endpoints

### Auth Service (`/auth/*`)

| Method | Endpoint | Purpose | Auth Required | Notes |
|--------|----------|---------|---------------|-------|
| GET | `/auth/google/login` | Initiate OAuth2 flow | No | Redirects to Google consent screen |
| GET | `/auth/google/callback` | OAuth2 callback | No | Google redirects here with `code` param |
| POST | `/auth/validate` | Validate JWT token | Bearer JWT | Called by API Gateway; checks Redis blacklist |
| POST | `/auth/logout` | Invalidate token | Bearer JWT | Adds hash to Redis blacklist + invalidates session |
| GET | `/auth/public-key` | Fetch RSA public key | No | PEM format; allows local JWT verification |
| GET | `/auth/failure` | OAuth2 failure handler | No | Returns 401 error |
| GET | `/health` | Service health check | No | Returns `{"status": "ok"}` |
| GET | `/metrics` | Prometheus metrics | No | Prometheus scrape endpoint |

**Auth Service Response Format:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  }
}
```

**JWT Payload (RS256):**
```json
{
  "sub": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "role": "user",
  "iat": 1715694000,
  "exp": 1715697600
}
```

---

### User Service (`/users/*`)

| Method | Endpoint | Purpose | Auth Required | Role Required | Notes |
|--------|----------|---------|---------------|---------------|-------|
| GET | `/users/me` | Get current user profile | Yes | — | Uses `X-User-Id` header from gateway |
| PATCH | `/users/me` | Update own profile | Yes | — | Fields: `name`, `avatar` |
| GET | `/users/search` | Search users by name/email | Yes | — | Query param: `q` (ILIKE search) |
| GET | `/users/:id` | Get user by ID | Yes | — | Returns public profile |
| GET | `/users` | List all users (paginated) | Yes | admin | Query params: `q`, `page`, `limit` |
| PATCH | `/users/:id/role` | Update user role | Yes | admin | Request body: `{"role": "user"\|"admin"}` |
| DELETE | `/users/:id` | Delete user | Yes | admin | Soft or hard delete |
| GET | `/health` | Health check | No | — | Returns `{"status": "ok"}` |
| GET | `/metrics` | Prometheus metrics | No | — | Prometheus scrape endpoint |

**User Service Response Format:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "avatar": "https://example.com/avatar.jpg",
  "role": "user",
  "created_at": "2024-05-14T10:30:00Z",
  "updated_at": "2024-05-14T10:30:00Z"
}
```

---

### Chat Service (`/rooms/*`, WebSocket `/ws`)

| Method | Endpoint | Purpose | Auth Required | Notes |
|--------|----------|---------|---------------|-------|
| POST | `/rooms` | Create new chat room | Yes (via `X-User-Id` header) | JSON body: `{"name": "string"}` |
| POST | `/rooms/:roomId/join` | Join a room | Yes | Adds user to room members |
| POST | `/rooms/:roomId/leave` | Leave a room | Yes | Removes user from room members |
| POST | `/rooms/:roomId/messages` | Send message to room | Yes | JSON body: `{"content": "string"}` |
| GET | `/rooms/:roomId/messages` | Get message history | Yes | Query params: `cursor` (pagination), `limit` (max 100) |
| PUT | `/rooms/:roomId/messages/:messageId` | Edit message | Yes | Only by message author; JSON body: `{"content": "string"}` |
| DELETE | `/rooms/:roomId/messages/:messageId` | Delete message | Yes | Only by message author |
| GET | `/health` | Health check | No | Returns `{"status": "ok"}` |
| GET | `/metrics` | Prometheus metrics | No | Prometheus scrape endpoint |
| GET | `/metrics-summary` | Metrics summary | No | Returns active users + message volume timeline |
| WS | `/ws` | WebSocket connection | Yes | Query params: `roomId` (required), `userId` (optional) |

**Chat Room Response Format:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "General Chat",
  "ownerId": "uuid",
  "createdAt": "2024-05-14T10:30:00Z"
}
```

**Chat Message Response Format:**
```json
{
  "id": "507f1f77bcf86cd799439012",
  "roomId": "507f1f77bcf86cd799439011",
  "userId": "uuid",
  "content": "Hello, world!",
  "createdAt": "2024-05-14T10:30:15Z",
  "updatedAt": "2024-05-14T10:30:15Z"
}
```

**WebSocket Events:**
- `message.created` — New message sent to room
- `message.updated` — Message edited
- `message.deleted` — Message deleted
- `user.connected` — User joined room (published to RabbitMQ)
- `user.disconnected` — User left room (published to RabbitMQ)

---

### Dashboard Service (`/dashboard/*`)

| Method | Endpoint | Purpose | Auth Required | Notes |
|--------|----------|---------|---------------|-------|
| GET | `/dashboard/active-users` | Get current active user count | No | Returns from Redis cache |
| GET | `/dashboard/message-volume` | Get message volume timeline | No | Returns 120 60-second buckets |
| GET | `/dashboard/system-health` | Check all service health | No | Uses circuit breaker on each service |
| GET | `/health` | Health check | No | Returns `{"status": "ok"}` |
| GET | `/metrics` | Prometheus metrics | No | Default Prometheus endpoint |

**Active Users Response:**
```json
{
  "activeUsers": 42
}
```

**Message Volume Response:**
```json
{
  "points": [
    {"ts": "1715694000", "count": 15},
    {"ts": "1715694060", "count": 23}
  ]
}
```

**System Health Response:**
```json
{
  "services": {
    "auth-service": {"status": "up"},
    "user-service": {"status": "up"},
    "chat-service": {"status": "up"}
  }
}
```

---

## Database Models & Schema

### PostgreSQL Schema (Auth & User Services)

#### `users` table (shared across auth and user services)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR(255) UNIQUE,           -- NULL if created locally
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar TEXT,                              -- URL to avatar image
  role VARCHAR(50) NOT NULL DEFAULT 'user', -- 'user' or 'admin'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()        -- User service only
);

CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
```

**GORM Model (Go):**
```go
type User struct {
  ID        string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
  GoogleID  *string   `gorm:"column:google_id;unique" json:"google_id"`
  Email     string    `gorm:"unique;not null" json:"email"`
  Name      string    `json:"name"`
  Avatar    string    `json:"avatar"`
  Role      string    `gorm:"not null;default:user" json:"role"`
  CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
  UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}
```

**Auth Service Specifics:**
- Uses GORM with `UpsertFromGoogle()` method (UPSERT on `google_id`)
- Avoids `updated_at` column (auth records are immutable after creation)

**User Service Specifics:**
- Connection pool: `MaxOpenConns=25, MaxIdleConns=5, ConnMaxLifetime=5min`
- Supports retry logic for transient DB errors

---

### MongoDB Schema (Chat Service)

#### `chatrooms` collection (via Mongoose)

```javascript
const roomSchema = new Schema({
  name: { type: String, required: true },
  ownerId: { type: String, default: null },        // User UUID
  members: { type: [String], default: [] },        // Array of user UUIDs
  createdAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('ChatRoom', roomSchema);
```

**Indexes:**
- Primary key on `_id`
- No explicit indexes defined (will auto-create on queries)

#### `chatmessages` collection

```javascript
const messageSchema = new Schema({
  roomId: { 
    type: ObjectId, 
    required: true, 
    index: true                              // For fast room lookups
  },
  userId: { type: String, required: true },  // User UUID
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('ChatMessage', messageSchema);
```

**Indexes:**
- `roomId` — for cursor-based pagination within rooms

**Data Retention:**
- Messages are immutable except for edits (updatedAt field tracks changes)
- No TTL set; messages persist indefinitely
- Cursor-based pagination uses `_id` for consistency

---

### Redis Keys (Session & Cache Store)

| Key Pattern | TTL | Value | Purpose |
|-------------|-----|-------|---------|
| `session:{token_hash}` | 1 hour | `user_uuid` | Active sessions (auth-service) |
| `blacklisted:{token_hash}` | Token's remaining TTL | `"1"` | Invalidated tokens (auth-service) |
| `dashboard:active_users` | Unbounded | Set of user UUIDs | Current active users |
| `dashboard:message_count` | Unbounded | Integer | Total messages sent (cumulative) |
| `dashboard:message_volume` | Unbounded | Sorted set (timestamp → count) | 1-minute buckets of message rates |
| `dashboard:event:{event_hash}` | 2 hours | `"1"` | Event deduplication (idempotency) |

**Token Hashing:**
- SHA-256 hash of JWT token used as Redis key to avoid storing full tokens

---

## Metrics & Prometheus

### Prometheus Configuration

**Scrape Interval:** 15 seconds globally  
**Evaluation Interval:** 15 seconds for alert rules  
**Scrape Timeout:** 10 seconds per target

**Targets:**
```yaml
- auth-service:8081/metrics
- user-service:8082/metrics
- chat-service:3000/metrics
- dashboard-service:8000/metrics
- node-exporter:9100/metrics
- redis-exporter:9121/metrics (if deployed)
- rabbitmq:15692/metrics
```

---

### Metrics Exposed by Each Service

#### Auth Service Metrics
```
auth_http_requests_total{method, path, status}       # Counter: total HTTP requests
auth_http_request_duration_seconds{method, path}     # Histogram: request latency
```

**Example Queries:**
```
rate(auth_http_requests_total[5m])                    # Request rate
rate(auth_http_requests_total{status=~"5.."}[5m])    # Error rate
histogram_quantile(0.95, auth_http_request_duration_seconds_bucket)  # p95 latency
```

---

#### User Service Metrics
```
user_http_requests_total{method, path, status}       # Counter: total HTTP requests
user_http_request_duration_seconds{method, path}     # Histogram: request latency
```

---

#### Chat Service Metrics
```
chat_active_users                                      # Gauge: current active WebSocket users
chat_messages_total                                    # Counter: total messages sent
http_request_duration_seconds_count{job="chat"}       # (default prom-client metric)
```

**Custom Endpoints:**
- `GET /metrics-summary` — Returns `{activeUsers: N, messageVolume: [...]}`

---

#### Dashboard Service Metrics
```
http_requests_total{job="dashboard-service", status_code}  # Counter
http_request_duration_seconds_bucket{job="dashboard"}      # Histogram
```

---

### Grafana Dashboard

**Location:** `infrastructure/grafana/dashboards/system-overview.json`

**Panels:**
1. **HTTP Request Rate (req/s)** — Line chart of requests per second by service
2. **HTTP Error Rate (5xx %)** — Error rate threshold alerts (red > 5%, yellow > 1%)
3. **p95 Response Time (ms)** — 95th percentile latency (yellow > 200ms, red > 500ms)
4. **CPU Usage %** — Host CPU utilization
5. **Memory Usage %** — Host memory utilization (alerting at 85%)
6. **RabbitMQ Queue Depth** — Message backlog per queue

**Data Source:** Prometheus (configured in `infrastructure/grafana/datasources/`)

---

### Alert Rules

**Location:** `infrastructure/prometheus/alerts.rules.yml`

| Alert Name | Condition | Duration | Severity |
|------------|-----------|----------|----------|
| **ServiceDown** | `up == 0` | 1 minute | Critical |
| **HighErrorRateAuth** | 5xx rate > 5% | 2 minutes | Warning |
| **HighErrorRateUser** | 5xx rate > 5% | 2 minutes | Warning |
| **HighChatMessageRate** | Rate > 100/min | 1 minute | Warning |
| **RedisDown** | `redis_up == 0` | 30 seconds | Critical |
| **HighMemoryUsage** | Memory > 85% | 5 minutes | Warning |
| **RabbitMQQueueBacklog** | Queue size > 1000 | 2 minutes | Warning |

---

## WebSocket Implementation

### Technology Stack
- **Library:** `ws` (Node.js WebSocket server)
- **Port:** 3000 (same as HTTP server)
- **Path:** `/ws`
- **Protocol:** Raw WebSocket frames (JSON payload)

### WebSocket Server Setup

**File:** `services/chat-service/internal/socket/socket_server.js`

```javascript
const wss = new WebSocketServer({ server, path: "/ws" });

// Connection: http://chat-service:3000/ws?roomId=ROOM_ID&userId=USER_ID
wss.on("connection", (ws, req) => {
  const roomId = url.searchParams.get("roomId");      // Required
  const userId = url.searchParams.get("userId");      // Optional
  
  // Add socket to room tracking (Map<roomId, Set<ws>>)
  socketsByRoom.get(roomId).add(ws);
  allClients.add(ws);
  
  // Publish presence event to RabbitMQ if userId provided
  publishUserPresence({ userId, roomId, timestamp }, true);
  
  ws.on("close", () => {
    // Remove from tracking
    // Publish disconnect event
    publishUserPresence({ userId, roomId, timestamp }, false);
  });
});
```

### Broadcasting Mechanism

```javascript
function broadcastToRoom(roomId, payload) {
  const roomSockets = socketsByRoom.get(roomId);
  if (!roomSockets) return;
  
  for (const ws of roomSockets) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }
}
```

**Broadcast Triggers:**
1. **Message Created** — `/rooms/:roomId/messages` POST endpoint
   - Publishes to RabbitMQ for Dashboard aggregation
   - Broadcasts to room WebSocket clients: `{event: "message.created", data: Message}`

2. **Message Updated** — `/rooms/:roomId/messages/:messageId` PUT endpoint
   - Broadcasts: `{event: "message.updated", data: Message}`

3. **Message Deleted** — `/rooms/:roomId/messages/:messageId` DELETE endpoint
   - Broadcasts: `{event: "message.deleted", data: {id: messageId}}`

### Metrics Tracking

- **Active Users:** Updated on every connection/disconnection
  - `setActiveUsers(allClients.size)` → Prometheus gauge
  - Published to RabbitMQ as `user.connected` / `user.disconnected` events

---

## Message Broker (RabbitMQ)

### Configuration

**Broker URL:** `amqp://rabbitmq:5672` (development)  
**Plugins Enabled:** Management plugin (15672), Prometheus metrics (15692)

### Exchange & Queue Setup

#### Chat Service (Publisher)

**Exchange:** `chat.events` (topic exchange, durable)

**Publishing Methods:**
```javascript
publishMessageCreated(payload)      // Routing key: "message.created"
publishUserPresence(payload, connected) // Routing key: "user.connected" or "user.disconnected"
```

**Payload Format:**
```json
{
  "messageId": "507f1f77bcf86cd799439012",
  "roomId": "507f1f77bcf86cd799439011",
  "userId": "user-uuid",
  "timestamp": "1715694015"
}
```

**Publish Reliability:**
- Uses confirm channel (`channel.waitForConfirms()`)
- Message persistence: `persistent: true`
- Content type: `application/json`

---

#### Dashboard Service (Consumer)

**Queue:** `dashboard.message.created` (durable)

**Bindings:**
```
Exchange: chat.events
  → Routing key: message.created
  → Routing key: user.connected
  → Routing key: user.disconnected
```

**Consumer Settings:**
```python
channel.basic_qos(prefetch_count=100)  # Batch processing
channel.basic_consume(queue=q.method.queue, on_message_callback=on_message)
```

**Message Handlers:**
```python
if routing_key == "message.created":
    store.on_message_created(payload)
elif routing_key == "user.connected":
    store.on_user_connected(payload)
elif routing_key == "user.disconnected":
    store.on_user_disconnected(payload)
```

**Actions Taken:**
1. **message.created** — Increment total message count + add to message volume histogram (60s bucket)
2. **user.connected** — Add user ID to active users set (Redis)
3. **user.disconnected** — Remove user ID from active users set (Redis)

### Retry & Dead-Letter Policy

**Not Explicitly Configured** — Default RabbitMQ behavior:
- Rejected messages are re-queued
- Manual acknowledgment (`basic_ack`) required or message is redelivered
- No DLX (Dead Letter Exchange) configured

**Recommendation:** Add DLX for failed messages to prevent infinite retry loops.

---

## Resilience Patterns

### 1. Circuit Breaker Pattern

#### Chat Service (RabbitMQ Publisher)

**File:** `services/chat-service/internal/services/broker_service.js`

**Implementation:**
```javascript
const circuit = {
  failureCount: 0,
  state: "CLOSED",           // CLOSED → OPEN → HALF_OPEN → CLOSED
  lastFailureTime: 0,
  testInProgress: false
};

const OPEN_THRESHOLD = 5;     // Fail 5 times to open
const OPEN_TIMEOUT_MS = 30000; // Stay open for 30s
```

**State Transitions:**
- **CLOSED → OPEN:** After 5 consecutive failures
- **OPEN → HALF_OPEN:** After 30 seconds idle
- **HALF_OPEN → CLOSED:** On success
- **HALF_OPEN → OPEN:** On failure (restart timer)

**Usage:**
```javascript
async function publishEvent(routingKey, payload) {
  if (!allowRequest()) return false;  // Reject if OPEN
  
  try {
    await channel.publish(...);
    await channel.waitForConfirms();
    handlePublishSuccess();
    return true;
  } catch (err) {
    handlePublishFailure();
    return false;
  }
}
```

---

#### Dashboard Service (Inter-Service Health Checks)

**File:** `services/dashboard-service/internal/services/system_service.py`

```python
class CircuitBreaker:
    def __init__(self, threshold: int = 3, cooldown_seconds: int = 10):
        self.threshold = threshold          # Fail 3 times to open
        self.cooldown_seconds = cooldown_seconds
        self.failures = 0
        self.opened_at = None
    
    def can_call(self) -> bool:
        if self.opened_at is None:
            return True
        return (time.time() - self.opened_at) >= self.cooldown_seconds
    
    def on_success(self):
        self.failures = 0
        self.opened_at = None
    
    def on_failure(self):
        self.failures += 1
        if self.failures >= self.threshold:
            self.opened_at = time.time()
```

**Health Check Endpoints:**
```python
checks = [
    ("auth-service", "http://auth-service:3001/health", auth_breaker),
    ("user-service", "http://user-service:3003/health", user_breaker),
    ("chat-service", "http://chat-service:3002/health", chat_breaker)
]

for name, url, breaker in checks:
    try:
        await fetch_with_retry(url, breaker)
        result[name] = {"status": "up"}
    except Exception:
        result[name] = {"status": "down"}
```

---

### 2. Retry Pattern

#### Auth Service (OAuth2 Token Exchange)

**File:** `services/auth-service/internal/services/auth_service.go`

```go
backoffs := []time.Duration{100*time.Millisecond, 200*time.Millisecond, 400*time.Millisecond}

for attempt := 0; attempt < len(backoffs); attempt++ {
    token, err := s.oauthCfg.Exchange(ctx, code)
    if err == nil {
        break
    }
    
    // Retry only on transient network errors
    if !isTransientOAuthError(err) {
        return "", nil, err
    }
    
    if attempt < len(backoffs)-1 {
        time.Sleep(backoffs[attempt])
    }
}
```

**Backoff Strategy:** Exponential (100ms, 200ms, 400ms)  
**Total Timeout:** 5 seconds  
**Retry Condition:** Only transient network errors (timeout, connection refused)

---

#### User Service (Database Queries)

**File:** `services/user-service/internal/repository/user_repository.go`

```go
func (r *UserRepository) withRetry(fn func() error) error {
    backoffs := []time.Duration{100*ms, 200*ms, 400*ms}
    
    for i, delay := range backoffs {
        err := fn()
        if err == nil {
            return nil
        }
        
        // Only retry on transient DB errors
        if !isTransientDBError(err) || i == len(backoffs)-1 {
            return err
        }
        
        time.Sleep(delay)
    }
}

func isTransientDBError(err error) bool {
    // Check for connection issues
    if errors.Is(err, driver.ErrBadConn) {
        return true
    }
    
    // Check network errors
    var netErr net.Error
    if errors.As(err, &netErr) {
        return netErr.Timeout() || netErr.Temporary()
    }
    
    // Check for specific error strings
    lower := strings.ToLower(err.Error())
    return strings.Contains(lower, "connection refused") ||
           strings.Contains(lower, "connection reset")
}
```

---

#### Dashboard Service (Inter-Service Calls)

**File:** `services/dashboard-service/internal/services/system_service.py`

```python
async def fetch_with_retry(url: str, breaker: CircuitBreaker) -> dict:
    if not breaker.can_call():
        raise RuntimeError("circuit open")
    
    delays = [0.1, 0.2, 0.4]  # 100ms, 200ms, 400ms
    
    async with httpx.AsyncClient(timeout=2.0) as client:
        for idx, delay in enumerate(delays):
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                breaker.on_success()
                return data
            except Exception as exc:
                breaker.on_failure()
                if idx < len(delays) - 1:
                    await asyncio.sleep(delay)
```

---

### 3. Connection Pooling (User Service)

**File:** `services/user-service/internal/repository/user_repository.go`

```go
func NewUserRepository(db *gorm.DB) *UserRepository {
    if sqlDB, err := db.DB(); err == nil {
        sqlDB.SetMaxOpenConns(25)        // Max 25 concurrent connections
        sqlDB.SetMaxIdleConns(5)         // Keep 5 idle connections
        sqlDB.SetConnMaxLifetime(5 * time.Minute)  // Recycle after 5min
    }
    return &UserRepository{db: db}
}
```

---

## Authentication & Authorization

### OAuth2 + JWT Flow

**Architecture Decision:** [ADR-003](adrs/ADR-003-authentication-gooleouth-jwt.md)

#### Step 1: Initiate Login
```
Client → Auth Service: GET /auth/google/login
Auth Service → Google: Redirect to consent screen
```

#### Step 2: Google Callback
```
Google → Client: Redirect with ?code=...
Client → Auth Service: GET /auth/google/callback?code=...
```

#### Step 3: Token Exchange

**Auth Service:**
```go
// Exchange auth code for Google access token
token, err := s.oauthCfg.Exchange(ctx, code)

// Fetch user info from Google
googleUser := fetchUserInfo(token.AccessToken)

// Upsert user to PostgreSQL (UPSERT on google_id)
user := s.userRepo.UpsertFromGoogle(googleUser.ID, googleUser.Email, googleUser.Name, googleUser.Picture)

// Create RS256 JWT
jwt := signWithRSA(privateKey, {
    "sub": user.ID,
    "email": user.Email,
    "name": user.Name,
    "role": user.Role,
    "exp": now + 1 hour,
    "iat": now
})

// Save session hash to Redis (TTL: 1 hour)
redis.Set("session:" + hash(jwt), user.ID, 1 hour)

return jwt, user
```

---

#### JWT Verification

**Local Verification (All Services):**
```go
// 1. Fetch public key from Auth Service
publicKey := getPublicKey()

// 2. Verify RS256 signature
claims, err := jwt.Parse(token, publicKey)

// 3. Check Redis session store (for logout)
_, err := redis.Get("session:" + hash(token))
if err != nil {
    // Token was invalidated (logged out)
    return 401
}

// 4. Extract claims
sub = claims["sub"]
role = claims["role"]
```

---

#### Logout Flow

```
Client: POST /auth/logout
  ↓
Auth Service:
  1. Delete session from Redis
  2. Add token hash to blacklist (TTL = remaining token expiry)
  3. Return 200
  ↓
Client: Token is discarded from memory
```

---

### JWT Claims & Expiry

| Claim | Value | Notes |
|-------|-------|-------|
| `sub` | User UUID | Subject (user identifier) |
| `email` | String | User's email |
| `name` | String | User's display name |
| `role` | "user" \| "admin" | Authorization role |
| `iat` | Unix timestamp | Issued at |
| `exp` | Unix timestamp | Expires in 1 hour |

**Token Lifetime:** 1 hour  
**Refresh Strategy:** Client must re-authenticate after 1 hour

---

### Role-Based Access Control (RBAC)

**Roles:**
- **user** — Standard user, can chat, view own profile, search users
- **admin** — Can manage users, change roles, delete accounts

**Enforcement:**

**User Service:**
```go
// Middleware: RequireRole("admin")
func RequireRole(minRole string) gin.HandlerFunc {
    roleRank := map[string]int{"user": 0, "admin": 1}
    return func(c *gin.Context) {
        claims := c.MustGet("user").(map[string]any)
        role := claims["role"].(string)
        
        if roleRank[role] < roleRank[minRole] {
            c.AbortWithStatusJSON(403, gin.H{"error": "Insufficient permissions"})
            return
        }
        c.Next()
    }
}

// Routes with role enforcement
users.PATCH("/:id/role", jwtMW.VerifyJWT(), RequireRole("admin"), h.UpdateRole)
users.DELETE("/:id", jwtMW.VerifyJWT(), RequireRole("admin"), h.DeleteUser)
```

---

### Gateway Authentication (Kong/NGINX)

**Responsibility:**
1. Validate JWT signature (calls Auth Service's `/auth/validate`)
2. Extract claims and add headers:
   - `X-User-Id` → `sub` claim
   - `X-User-Role` → `role` claim
   - `X-User-Email` → `email` claim
3. Forward request to backend service
4. Rate limit: 100 requests/minute per user

**Downstream Services:**
- Trust headers from gateway (no re-validation needed)
- Extract identity from headers:
  ```go
  userId := c.GetHeader("X-User-Id")
  role := c.GetHeader("X-User-Role")
  ```

---

## Error Handling

### Standard Error Responses

#### Auth Service
```json
// Unauthorized
{"error": "Invalid token"}

// OAuth failure
{"error": "Failed to issue token"}

// Missing token
{"error": "No token"}
```

#### User Service
```json
// Invalid input
{"error": "No fields to update"}

// Permission denied
{"error": "Insufficient permissions"}

// Not found
{"error": "User not found"}

// Server error
{"error": "Internal server error"}
```

#### Chat Service
```json
// Unauthorized
{"error": "Unauthorized"}

// Validation
{"error": "name is required"}
{"error": "content is required"}

// Not found
{"error": "Room not found"}
{"error": "Message not found"}

// Permission
{"error": "Forbidden"}  // User trying to edit/delete another's message
```

---

### Error Handling Patterns

#### Auth Service

**Transient OAuth Errors** (retried):
- Network timeouts
- Connection errors
- Temporary DNS failures

**Non-Transient OAuth Errors** (fail immediately):
- `invalid_grant` (bad authorization code)
- Invalid client ID/secret
- Scope mismatch

```go
if strings.Contains(err.Error(), "invalid_grant") || !isTransientOAuthError(err) {
    return "", nil, err
}
```

---

#### User Service

**Transient Database Errors** (retried):
- `driver.ErrBadConn`
- Network timeouts
- "connection refused", "connection reset", "broken pipe"

**Non-Transient Database Errors** (fail immediately):
- Foreign key violations
- Unique constraint violations
- Schema errors

```go
if !isTransientDBError(err) || i == len(backoffs)-1 {
    return err
}
```

---

#### Chat Service

**Validation Errors** (400):
- Missing required fields (`name`, `content`, `roomId`)
- Message author mismatch on edit/delete

**Authorization Errors** (401/403):
- Missing `X-User-Id` header
- User trying to edit/delete another's message

**Not Found Errors** (404):
- Room doesn't exist
- Message doesn't exist

---

#### Dashboard Service

**Circuit Breaker Errors** (503):
- Service health check fails → circuit opens
- Returns `{"status": "down"}` for that service

**Timeout Errors** (2 second timeout per service):
```python
async with httpx.AsyncClient(timeout=2.0) as client:
    resp = await client.get(url)
```

---

### Graceful Degradation

**Architecture:** Services are designed to fail independently

1. **Auth Service Down** → All other services become unavailable (gateway blocks requests)
2. **User Service Down** → Chat and Dashboard still work (user profiles not accessible)
3. **Chat Service Down** → Dashboard shows "down" status; auth/users unaffected
4. **Dashboard Down** → Chat and auth still work; metrics unavailable

**RabbitMQ Down:**
- Chat Service: Message publishing returns false but doesn't block message creation
- Dashboard Service: Can't consume events but can still serve /health

---

## Logging Setup

### Log Levels

| Level | Used By | Format |
|-------|---------|--------|
| DEBUG | Tests, verbose startup | Text with timestamps |
| INFO | Service startup, important events | Text with timestamps |
| WARN | Recovered errors, degraded state | Text with timestamps |
| ERROR | Failures, crashes | Text with timestamps |

---

### Log Destinations

#### Development
- **STDOUT/STDERR** — Console output during `docker-compose up`

#### Production
- **OpenSearch (Elasticsearch-compatible)**
  - Centralized logging via Filebeat
  - Searchable logs with timestamp, service name, level

#### Configuration
**Filebeat:** `infrastructure/filebeat/filebeat.yml`
```yaml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/app/*.log

output.elasticsearch:
  hosts: ["opensearch:9200"]
```

---

### Logging in Services

#### Go Services (Auth, User)
- No structured logging library configured (uses standard `log` package)
- Logs printed to STDOUT

#### Node.js (Chat Service)
- `prom-client` for metrics (not traditional logging)
- Errors caught but not logged to file

#### Python (Dashboard Service)
- Standard `logging` module (not configured for file output)
- Errors logged via `except` blocks

**Recommendation:** Integrate a proper structured logging library (Winston for Node.js, Logrus for Go, structlog for Python).

---

## Testing Strategy

### Test Pyramid

**Location:** `tests/` directory

```
        ┌─────────────────────────────┐
        │   Unit Tests (fastest)       │
        │  service/*/tests/unit/*.     │
        └─────────────────────────────┘
                   ▲
                   │
        ┌─────────────────────────────┐
        │ Integration Tests            │
        │ tests/integration/*.test.js  │
        └─────────────────────────────┘
                   ▲
                   │
        ┌─────────────────────────────┐
        │  Contract Tests              │
        │ tests/contract/              │
        └─────────────────────────────┘
                   ▲
                   │
        ┌─────────────────────────────┐
        │  E2E / Load Tests (slowest)  │
        │ tests/load/k6-scenarios.js   │
        └─────────────────────────────┘
```

---

### Integration Tests

**File:** `tests/integration/auth.test.js`

**Technology:** Jest + Supertest + Mock libraries

**Setup:**
```javascript
// Mock filesystem (keys)
jest.mock('fs', () => ({...}));

// Mock PostgreSQL
jest.mock('pg', () => ({...}));

// Mock Redis
jest.mock('redis', () => ({...}));

// Mock Google OAuth
jest.mock('passport', () => ({...}));
```

**Test Scenario:**
```
1. Generate RSA key pair (fresh each test)
2. Call auth-service to issue JWT
3. Call user-service with JWT in Authorization header
4. Verify user-service accepts the token
5. Test RBAC: non-admin user cannot delete other users
```

**Coverage:**
- Cross-service JWT verification
- Token rejection when tampered
- RBAC enforcement (user role < admin role)

---

### Contract Tests

**Location:** `tests/contract/test_api_contracts.py`

**Purpose:** Verify API schema compatibility (Pact-equivalent)

---

### Load Tests

**Location:** `tests/load/k6-scenarios.js`

**Framework:** k6 (JavaScript-based load testing)

**Scenarios:** (Not yet populated, but framework is in place)

---

### Docker Compose Test Configuration

**File:** `infrastructure/docker-compose.test.yml`

**Services:**
- `postgres-test` — In-memory test database (port 5433)
- `mongodb-test` — In-memory test MongoDB (port 27018)
- `redis-test` — In-memory test Redis (port 6380)
- `rabbitmq-test` — Test RabbitMQ (ports 5673, 15673)

**Usage:**
```bash
docker compose -f infrastructure/docker-compose.test.yml up -d
npm test
docker compose -f infrastructure/docker-compose.test.yml down -v
```

---

### Test Coverage

**Auth Service:** `coverage/index.html` available after `npm test:coverage`  
**User Service:** `coverage.html` available after `go test -cover ./...`  
**Chat Service:** `coverage/` directory available after `npm test:coverage`  
**Dashboard Service:** `coverage_html/` directory available after pytest with coverage plugin

---

## Infrastructure

### Docker Compose Production Setup

**File:** `infrastructure/docker-compose.yml`

#### Database Services

**PostgreSQL 15**
- Port: 5432
- User: admin / Password: secret
- Database: appdb
- Volume: `postgres-data`
- Init script: `infrastructure/postgres/init.sql`
- Creates: `authdb`, `userdb` schemas

**MongoDB 7**
- Port: 27017
- Database: chatdb
- Volume: `mongo-data`
- No authentication configured (local development)

**Redis 7**
- Port: 6379
- Volume: `redis-data`
- No authentication configured

#### Message Broker

**RabbitMQ 3 (Alpine)**
- AMQP Port: 5672
- Management Console: 15672 (admin/admin)
- Prometheus Metrics: 15692
- Plugins: `enabled_plugins` from `infrastructure/rabbitmq/enabled_plugins`
- Volume: None (transient)

#### Observability Services

**Prometheus v2.51.0**
- Port: 9090
- Config: `infrastructure/prometheus/prometheus.yml`
- Scrape interval: 15s
- Rule file: `infrastructure/prometheus/alerts.rules.yml`
- Volume: `prometheus_data` (for time-series storage)

**Grafana 10.4.2**
- Port: 3001 (redirects from 3000)
- Admin user: admin / Password: admin
- Provisioning:
  - Dashboards: `infrastructure/grafana/dashboards/`
  - Datasources: `infrastructure/grafana/datasources/`
- Volume: `grafana_data`

**Node Exporter v1.7.0**
- Port: 9100
- Exports host-level metrics (CPU, memory, disk, network)

**OpenSearch (Elasticsearch Alternative)**
- Port: 9200
- Volume: `opensearch-data`
- Role: Centralized logging backend (for Filebeat)

---

### Network Topology

```
┌─────────────────────────────────────────────────────┐
│         Docker Bridge Network: app-network          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  API Gateway (Kong/NGINX)                          │
│  ├─ Port 8000 (HTTP)                               │
│  ├─ Port 8443 (HTTPS)                              │
│  └─ Internal routing to services                   │
│                                                     │
│  Auth Service (Gin) ──┬─ PostgreSQL                │
│  ├─ Port 3001         │                             │
│  ├─ Port 8081         └─ Redis                      │
│  └─ Metrics: /metrics                              │
│                                                     │
│  User Service (Gin)    PostgreSQL                  │
│  ├─ Port 3003          │                            │
│  ├─ Port 8082          └─ Redis                     │
│  └─ Metrics: /metrics                              │
│                                                     │
│  Chat Service (Express)                            │
│  ├─ Port 3000          MongoDB                     │
│  ├─ Port 3002          ├─ RabbitMQ                 │
│  └─ Metrics: /metrics  └─ Redis                     │
│                                                     │
│  Dashboard Service (FastAPI)                       │
│  ├─ Port 8000          Redis                       │
│  ├─ Port 5000          └─ RabbitMQ                 │
│  └─ Metrics: /metrics                              │
│                                                     │
│  Prometheus ──────────────┐                        │
│  ├─ Port 9090             │                         │
│  ├─ Scrapes all /metrics  │                         │
│  └─ Alerting rules        │                         │
│                            │                         │
│  Grafana                   │                         │
│  ├─ Port 3001              │                         │
│  └─ Data source: Prometheus                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Health Checks

All services have health check configurations in docker-compose:

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:PORT/health || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

---

### Environment Variables

#### Auth Service (`.env`)
```bash
PORT=3001
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8000/auth/google/callback
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
POSTGRES_URL=postgresql://admin:secret@localhost:5432/authdb
REDIS_URL=redis://localhost:6379
```

#### User Service (`.env`)
```bash
PORT=3003
POSTGRES_URL=postgresql://admin:secret@localhost:5432/userdb
JWT_PUBLIC_KEY_PATH=./keys/public.pem
```

#### Chat Service (`.env`)
```bash
PORT=3000
MONGODB_URL=mongodb://localhost:27017/chatdb
RABBITMQ_URL=amqp://localhost:5672
REDIS_URL=redis://localhost:6379
```

#### Dashboard Service (`.env`)
```bash
PORT=8000
REDIS_HOST=redis
REDIS_PORT=6379
RABBITMQ_URL=amqp://rabbitmq:5672
```

---

### RSA Key Generation

**Location:** `infrastructure/scripts/generate-keys.sh`

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

**Storage:** `keys/` directory (mounted in services)

---

### Deployment Considerations

#### Scaling
- **Stateless Services:** Auth, User, Chat can be scaled horizontally (multiple replicas)
- **Stateful:** PostgreSQL (primary-replica), MongoDB (replica set), Redis (cluster mode)

#### Clustering
- **Kubernetes Ready:** Services containerized, health checks defined
- **Load Balancing:** API Gateway distributes traffic
- **Service Discovery:** DNS (Kubernetes) or Consul (Nomad)

#### Backup Strategy
- **Database Snapshots:** PostgreSQL WAL archiving, MongoDB oplog
- **Redis Persistence:** AOF or RDB snapshots
- **Log Retention:** OpenSearch index lifecycle policies

---

## Summary of External Dependencies

### External APIs
- **Google OAuth2** — User authentication (timeout: 5s, retries: 3)

### Internal Service Calls
- **Auth Service** → Auth Service (public key fetch)
- **Dashboard Service** → Auth, User, Chat services (health checks with circuit breaker)

### Message Flows
- **Chat Service** → RabbitMQ → Dashboard Service (async event aggregation)
- **WebSocket Clients** → Chat Service (real-time messaging)

### Third-Party SaaS
- None currently; Google OAuth is only external dependency

---

## Key Architecture Decisions (ADRs)

| ADR | Title | Status | Key Points |
|-----|-------|--------|------------|
| [ADR-001](adrs/ADR-001-microservices.md) | Microservices Architecture | Accepted | Independent scaling, fault isolation, technology freedom |
| [ADR-002](adrs/ADR-002-api-gateway.md) | API Gateway Selection (Kong) | Accepted | Centralized auth, rate limiting, SSL termination |
| [ADR-003](adrs/ADR-003-authentication-gooleouth-jwt.md) | OAuth2 + JWT | Accepted | Google OAuth, RS256, Redis session store |
| ADR-004 | Observability | (Empty) | Prometheus + Grafana + OpenSearch |
| ADR-005 | Containerization | (Empty) | Docker + Docker Compose |
| [ADR-006](adrs/ADR-006-message-broker.md) | Message Broker (RabbitMQ) | Accepted | Async event pub/sub, decouples Chat from Dashboard |

---

## Performance Targets (from Requirements)

| Metric | Target | Status |
|--------|--------|--------|
| API response time (p95) | < 200ms | To be validated under load |
| Concurrent users supported | 10,000 | To be validated with k6 load tests |
| Service availability | 99.9% uptime | Monitoring in place with Prometheus alerts |
| Message throughput | Unbounded (with backpressure) | RabbitMQ queue monitoring enabled |

---

## Known Limitations

1. **No Dead-Letter Queue (DLX)** for RabbitMQ — failed messages are re-queued indefinitely
2. **Token Refresh** — Clients must re-authenticate after 1 hour (no refresh tokens)
3. **Message Retention** — MongoDB has no TTL; messages persist indefinitely
4. **Horizontal Scaling** — Redis and RabbitMQ not clustered; single points of failure
5. **HTTPS** — Not enforced in local development; should be mandatory in production
6. **Logging** — No structured logging library integrated; only STDOUT/console output
7. **Load Testing** — k6 scenarios not yet populated

---

## Recommended Next Steps

1. **Implement k6 Load Tests** — Populate `tests/load/k6-scenarios.js` with realistic scenarios
2. **Add Structured Logging** — Integrate Winston (Node.js), Logrus (Go), structlog (Python)
3. **Setup Alert Manager** — Configure Prometheus AlertManager for on-call notifications
4. **Redis Cluster** — Deploy Redis in cluster mode for high availability
5. **RabbitMQ Clustering** — Setup RabbitMQ cluster with disk nodes
6. **Dead-Letter Queues** — Add DLX for failed message handling
7. **Token Refresh** — Implement refresh token flow for better UX
8. **Message TTL** — Add MongoDB TTL index for automatic message expiry
9. **Comprehensive Documentation** — Complete empty ADR-004 and ADR-005
10. **Security Hardening** — Add rate limiting, DDoS protection, input validation

---

**End of Analysis Document**
