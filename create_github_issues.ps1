 GitHub Issues Creation Script
# Real-Time Chat & Dashboard - Microservices Project
# Compatible with: PowerShell 5.1+ / PowerShell 7+ on Windows
# Save this file as UTF-8 (VS Code: bottom-right corner -> UTF-8)
# ============================================================

# ---- CONFIGURE THESE ----
$REPO_NAME = "scalable-realtime-chat-platform-v2.0"
$REPO_OWNER = "Maya321-wq"
# -------------------------

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Real-Time Chat & Dashboard - GitHub Issues" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check gh CLI
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: GitHub CLI not installed. Get it from https://cli.github.com/" -ForegroundColor Red
    exit 1
}

Write-Host "Checking GitHub authentication..." -ForegroundColor Yellow
gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Not authenticated. Run: gh auth login" -ForegroundColor Red
    exit 1
}

$FULL_REPO = "$REPO_OWNER/$REPO_NAME"
Write-Host "Using repo: $FULL_REPO" -ForegroundColor Green
Write-Host ""

# ---- CREATE LABELS ----
Write-Host "Creating labels..." -ForegroundColor Yellow

$labelData = @(
    "priority:critical|d73a4a|Blocks demo or grading",
    "priority:important|e4e669|Affects grade significantly",
    "priority:nice-to-have|0075ca|Polish and extras",
    "member:A|7057ff|Assigned to Member A - Infra and Observability",
    "member:B|008672|Assigned to Member B - Docs and Security",
    "member:C|e99695|Assigned to Member C - Frontend and Resilience",
    "area:infrastructure|bfd4f2|docker-compose and infra config",
    "area:observability|fef2c0|Prometheus Grafana metrics",
    "area:frontend|d4edda|React UI",
    "area:backend|f1e0ff|Go Node.js Python services",
    "area:documentation|cfe2ff|ADRs API specs diagrams report",
    "area:security|ffe0b2|Auth TLS CSRF CORS",
    "area:testing|e2e8f0|Unit integration load tests"
)

foreach ($entry in $labelData) {
    $parts = $entry -split "\|"
    Write-Host "  Label: $($parts[0])" -ForegroundColor Gray
    gh label create $parts[0] --color $parts[1] --description $parts[2] --repo $FULL_REPO 2>$null
}
Write-Host "Labels done." -ForegroundColor Green
Write-Host ""

# ---- HELPER FUNCTION ----
function New-Issue {
    param(
        [string]$Title,
        [string]$Labels,
        [string]$Body
    )
    $tmp = [System.IO.Path]::GetTempFileName() + ".md"
    [System.IO.File]::WriteAllText($tmp, $Body, [System.Text.Encoding]::UTF8)
    gh issue create --title $Title --body-file $tmp --label $Labels --repo $FULL_REPO
    Remove-Item $tmp -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    OK" -ForegroundColor Green
    } else {
        Write-Host "    FAILED" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 600
}

Write-Host "Creating issues..." -ForegroundColor Yellow
Write-Host ""

# ================================================================
# ISSUE 1
# ================================================================
Write-Host "  Issue #1: Add Prometheus and Grafana to docker-compose..." -ForegroundColor Gray
New-Issue `
    -Title "[INFRA] Add Prometheus and Grafana services to docker-compose.yml" `
    -Labels "priority:critical,member:A,area:infrastructure,area:observability" `
    -Body @"
## Problem
prometheus.yml and the Grafana dashboard JSON are fully configured but neither service is defined in infrastructure/docker-compose.yml. Metrics collection and visualization are completely non-functional.

## Acceptance Criteria
- [ ] Add prometheus service using image prom/prometheus:latest
  - Mount ./prometheus/prometheus.yml as /etc/prometheus/prometheus.yml
  - Expose port 9090
  - Add healthcheck: wget -qO- http://localhost:9090/-/healthy
- [ ] Add grafana service using image grafana/grafana:latest
  - Mount ./grafana/dashboards/ for dashboard provisioning
  - Mount ./grafana/provisioning/ for datasource config
  - Expose port 3000
  - Set env: GF_SECURITY_ADMIN_PASSWORD=admin
- [ ] Create infrastructure/grafana/provisioning/datasources/prometheus.yml pointing to http://prometheus:9090
- [ ] Create infrastructure/grafana/provisioning/dashboards/dashboard.yml pointing to dashboard folder
- [ ] Prometheus UI at http://localhost:9090 shows at least 2 UP targets (chat-service, dashboard-service)
- [ ] Grafana at http://localhost:3000 loads the system-overview dashboard

## Files to Change
- infrastructure/docker-compose.yml
- infrastructure/prometheus/prometheus.yml (verify scrape targets)
- infrastructure/grafana/provisioning/datasources/prometheus.yml (create)
- infrastructure/grafana/provisioning/dashboards/dashboard.yml (create)

## Estimated Effort
Easy - 1 to 2 hours

## Notes
This issue UNBLOCKS Issues #3, #4, #13, and #15. Do this first.
"@

# ================================================================
# ISSUE 2
# ================================================================
Write-Host "  Issue #2: Add node-exporter and redis-exporter..." -ForegroundColor Gray
New-Issue `
    -Title "[INFRA] Add node-exporter and redis-exporter to docker-compose.yml" `
    -Labels "priority:critical,member:A,area:infrastructure,area:observability" `
    -Body @"
## Problem
prometheus.yml references node-exporter:9100 and redis-exporter:9121 as scrape targets but neither service is defined in docker-compose.yml. Grafana panels for CPU and Memory will show no data.

## Acceptance Criteria
- [ ] Add node-exporter service using prom/node-exporter:latest
  - Use pid: host and appropriate volume mounts for /proc, /sys
  - Expose port 9100
  - Verify metric node_cpu_seconds_total appears in Prometheus
- [ ] Add redis-exporter service using oliver006/redis_exporter:latest
  - Set env: REDIS_ADDR=redis://redis:6379
  - Expose port 9121
  - Verify metric redis_connected_clients appears in Prometheus
- [ ] Both appear as UP targets in Prometheus UI after docker compose up

## Files to Change
- infrastructure/docker-compose.yml

## Estimated Effort
Easy - 30 minutes

## Dependencies
Issue #1 must be done first (Prometheus needs to be running)
"@

# ================================================================
# ISSUE 3
# ================================================================
Write-Host "  Issue #3: Auth Service /metrics endpoint (Go)..." -ForegroundColor Gray
New-Issue `
    -Title "[BACKEND] Add Prometheus /metrics endpoint to Auth Service (Go/Gin)" `
    -Labels "priority:critical,member:A,area:backend,area:observability" `
    -Body @"
## Problem
The Auth service (Go/Gin) has no /metrics endpoint. prometheus.yml scrapes auth-service:3001/metrics but that URL returns 404. All auth service metrics are invisible to Prometheus - the target appears as DOWN.

## Acceptance Criteria
- [ ] Add github.com/prometheus/client_golang to services/auth-service/go.mod
- [ ] Create services/auth-service/internal/metrics/metrics.go with:
  - HttpRequestsTotal - Counter with labels: method, path, status_code
  - HttpRequestDurationSeconds - Histogram with labels: method, path
  - AuthLoginTotal - Counter with labels: status (success/failure)
  - AuthLogoutTotal - Counter
- [ ] Create Gin middleware services/auth-service/internal/middleware/metrics_middleware.go that:
  - Records request count and duration for every route
  - Uses strconv.Itoa(c.Writer.Status()) for status_code label
- [ ] Register middleware in services/auth-service/internal/routes/routes.go
- [ ] Expose /metrics endpoint (no JWT auth on this endpoint)
- [ ] Instrument AuthenticateUser to increment AuthLoginTotal
- [ ] Instrument LogoutUser to increment AuthLogoutTotal
- [ ] Prometheus target auth-service:3001 shows UP after restart

## Files to Change
- services/auth-service/go.mod and go.sum
- services/auth-service/internal/routes/routes.go
- services/auth-service/internal/metrics/metrics.go (create)
- services/auth-service/internal/middleware/metrics_middleware.go (create)
- services/auth-service/internal/services/auth_service.go (add metric increments)

## Estimated Effort
Medium - 3 to 4 hours

## Dependencies
Issue #1 (Prometheus must be running to verify)
"@

# ================================================================
# ISSUE 4
# ================================================================
Write-Host "  Issue #4: User Service /metrics endpoint (Go)..." -ForegroundColor Gray
New-Issue `
    -Title "[BACKEND] Add Prometheus /metrics endpoint to User Service (Go/Gin)" `
    -Labels "priority:critical,member:A,area:backend,area:observability" `
    -Body @"
## Problem
The User service (Go/Gin) has no /metrics endpoint. prometheus.yml scrapes user-service:3003/metrics but that URL returns 404. The Prometheus target appears DOWN.

## Acceptance Criteria
- [ ] Add github.com/prometheus/client_golang to services/user-service/go.mod
- [ ] Create services/user-service/internal/metrics/metrics.go with:
  - HttpRequestsTotal - Counter with labels: method, path, status_code
  - HttpRequestDurationSeconds - Histogram with labels: method, path
  - UserOperationsTotal - Counter with labels: operation (get/update/list/search), status
- [ ] Reuse the same Gin middleware pattern from Issue #3 (copy metrics_middleware.go)
- [ ] Register middleware in services/user-service/internal/routes/routes.go
- [ ] Expose /metrics endpoint (no JWT auth)
- [ ] Instrument GetUser, UpdateProfile, ListUsers handlers
- [ ] Prometheus target user-service:3003 shows UP after restart

## Files to Change
- services/user-service/go.mod and go.sum
- services/user-service/internal/routes/routes.go
- services/user-service/internal/metrics/metrics.go (create)
- services/user-service/internal/middleware/metrics_middleware.go (create)
- services/user-service/internal/handlers/user_handler.go (add metric increments)

## Estimated Effort
Medium - 2 to 3 hours (pattern already established in Issue #3)

## Dependencies
- Issue #3 (follow same pattern)
- Issue #1 (Prometheus must be running to verify)
"@

# ================================================================
# ISSUE 5
# ================================================================
Write-Host "  Issue #5: Add Filebeat to docker-compose..." -ForegroundColor Gray
New-Issue `
    -Title "[INFRA] Add Filebeat service to docker-compose.yml for centralized logging" `
    -Labels "priority:critical,member:A,area:infrastructure" `
    -Body @"
## Problem
infrastructure/opensearch/filebeat.yml is fully configured but no Filebeat container exists in docker-compose.yml. Container logs are never shipped to OpenSearch. The centralized logging requirement completely fails.

## Acceptance Criteria
- [ ] Add filebeat service to docker-compose.yml using elastic/filebeat:8.13.0
  - Mount /var/lib/docker/containers:/var/lib/docker/containers:ro
  - Mount /var/run/docker.sock:/var/run/docker.sock:ro
  - Mount ./opensearch/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
  - Set user to root (required to read Docker socket)
- [ ] Depends on opensearch service being healthy
- [ ] Verify logs appear in OpenSearch under index pattern app-logs-* after traffic
- [ ] Add structured JSON logging to Chat service:
  - Use JSON.stringify({ level, message, timestamp, service }) format
- [ ] Document in ADR-004 that Filebeat uses Docker log autodiscovery

## Files to Change
- infrastructure/docker-compose.yml
- infrastructure/opensearch/filebeat.yml (verify config)
- services/chat-service/ (add structured JSON logging)

## Estimated Effort
Easy - 1 to 2 hours

## Notes
On Windows with Docker Desktop, /var/run/docker.sock maps differently. Use npipe:////./pipe/docker_engine if needed.
"@

# ================================================================
# ISSUE 6
# ================================================================
Write-Host "  Issue #6: Implement complete React frontend..." -ForegroundColor Gray
New-Issue `
    -Title "[FRONTEND] Implement complete React frontend (Login, Chat, Dashboard)" `
    -Labels "priority:critical,member:C,area:frontend" `
    -Body @"
## Problem
All frontend files under frontend/src/ are empty. The React/Vite project structure is scaffolded but contains zero code. No working UI exists. This is the single largest gap in the project.

## Acceptance Criteria

### Auth and Session
- [ ] src/hooks/useAuth.js - manages JWT in memory (NOT localStorage), exposes login(), logout(), user, token state
- [ ] src/api/apiClient.js - Axios wrapper that attaches Authorization: Bearer token header; base URL from VITE_API_URL env var

### Pages
- [ ] src/pages/LoginPage.jsx
  - Google OAuth2 login button redirecting to /auth/google/login (via API gateway)
  - Handles redirect back with token in query param or cookie
  - Redirects to /chat on success
- [ ] src/pages/ChatPage.jsx
  - Room list sidebar (fetches GET /rooms)
  - Message thread (fetches GET /rooms/:id/messages with cursor pagination)
  - Message input (POST /rooms/:id/messages)
  - Real-time updates via WebSocket (ws://localhost:8080/ws)
  - Edit and delete own messages
- [ ] src/pages/DashboardPage.jsx
  - Active users count card (polls GET /dashboard/active-users every 10s)
  - Message volume line chart (recharts, data from GET /dashboard/message-volume)
  - System health panel (GET /dashboard/system-health)

### Hooks
- [ ] src/hooks/useSocket.js - manages WebSocket lifecycle (connect, reconnect, cleanup)
- [ ] src/hooks/useRooms.js - fetches and caches room list
- [ ] src/hooks/useMessages.js - fetches messages with cursor pagination

### Routing
- [ ] src/App.jsx - React Router: / redirect, /login, /chat, /dashboard
- [ ] Protected routes redirect to /login if not authenticated
- [ ] src/main.jsx - app entry point
- [ ] frontend/.env.example with VITE_API_URL=http://localhost:8080

## Files to Change
All files under frontend/src/ (currently empty)

## Estimated Effort
High - 3 to 5 days

## Implementation Order
Day 1: apiClient + useAuth + LoginPage (test login flow works)
Day 2: useSocket + useRooms + useMessages + ChatPage
Day 3: DashboardPage + charts + polish
"@

# ================================================================
# ISSUE 7
# ================================================================
Write-Host "  Issue #7: Write ADR-004 Observability..." -ForegroundColor Gray
New-Issue `
    -Title "[DOCS] Write ADR-004: Observability Stack Decision" `
    -Labels "priority:important,member:B,area:documentation" `
    -Body @"
## Problem
adrs/ADR-004-observability.md is an empty file. The observability stack decisions have no architectural justification. This is a required ADR.

## Acceptance Criteria
- [ ] Follow the existing ADR format (Status, Context, Decision, Consequences)
- [ ] Document why Prometheus + Grafana over alternatives (Datadog, New Relic, ELK-only)
  - Pull-based model fits containerized environments
  - Open source, no per-seat cost
  - PromQL is powerful for rate/histogram queries
- [ ] Document why prom-client (Node.js) for Chat service
- [ ] Document why prometheus-fastapi-instrumentator (Python) for Dashboard service
- [ ] Document why prometheus/client_golang (Go) for Auth + User services
- [ ] Document why OpenSearch for logs vs Grafana Loki vs Elasticsearch
  - OpenSearch is open source fork of Elasticsearch
  - Filebeat to OpenSearch pipeline is well-established
- [ ] Note trade-offs: pull model requires services to expose /metrics; Prometheus is single-node in this setup
- [ ] Reference ADR-001 and ADR-006 where relevant

## Files to Change
- adrs/ADR-004-observability.md

## Estimated Effort
Easy - 1 to 2 hours
"@

# ================================================================
# ISSUE 8
# ================================================================
Write-Host "  Issue #8: Write ADR-005 Containerization..." -ForegroundColor Gray
New-Issue `
    -Title "[DOCS] Write ADR-005: Containerization Strategy Decision" `
    -Labels "priority:important,member:B,area:documentation" `
    -Body @"
## Problem
adrs/ADR-005-containerization.md is an empty file. The containerization decisions need documentation.

## Acceptance Criteria
- [ ] Follow the existing ADR format (Status, Context, Decision, Consequences)
- [ ] Document why Docker + docker-compose for this project stage
  - Kubernetes is overkill for development and submission environment
  - docker-compose provides service discovery, healthchecks, networking out of the box
  - Lower operational complexity for a 3-person team
- [ ] Document why multi-stage builds for Go services (builder to alpine)
  - Final image approximately 15MB vs 800MB with full build toolchain
  - Reduces attack surface
  - Faster deployment
- [ ] Document healthcheck strategy - all services define healthchecks; depends_on with service_healthy ensures correct startup order
- [ ] Document volume strategy - named volumes for persistent data, bind mounts for config files
- [ ] Note path to Kubernetes - explain how docker-compose services map to K8s Deployments/Services
- [ ] Note trade-offs: docker-compose is single-host only; no auto-healing; no rolling updates

## Files to Change
- adrs/ADR-005-containerization.md

## Estimated Effort
Easy - 1 hour
"@

# ================================================================
# ISSUE 9
# ================================================================
Write-Host "  Issue #9: Write ADR-007 Language Choices..." -ForegroundColor Gray
New-Issue `
    -Title "[DOCS] Write ADR-007: Multi-Language Service Architecture Decision" `
    -Labels "priority:important,member:B,area:documentation" `
    -Body @"
## Problem
The project uses 3 programming languages (Go, Node.js, Python) across 4 services with no ADR justifying these choices. The grading rubric explicitly requires language choices to be justified in an ADR.

## Acceptance Criteria
- [ ] Create new file adrs/ADR-007-language-choices.md
- [ ] Follow the existing ADR format (Status, Context, Decision, Consequences)
- [ ] Document Go for Auth Service and User Service
  - Type safety catches auth bugs at compile time (critical for security-sensitive service)
  - Low memory footprint - auth service handles every request
  - Excellent crypto/TLS support in standard library
  - Small binary output (alpine image approximately 15MB)
  - Fast startup time
- [ ] Document Node.js for Chat Service
  - Event-driven non-blocking I/O is ideal for WebSocket connections
  - ws library is mature and battle-tested
  - amqplib for RabbitMQ is the de-facto Node.js choice
  - Team familiarity (legacy Node.js services existed first)
- [ ] Document Python/FastAPI for Dashboard Service
  - FastAPI async support fits data aggregation workloads
  - prometheus-fastapi-instrumentator provides automatic HTTP metrics with one line
  - Python ecosystem strength for metrics and analytics
  - Pika library for RabbitMQ is stable
- [ ] Reference ADR-001 technology freedom principle
- [ ] Note trade-offs: multiple languages mean multiple dependency managers and cognitive overhead

## Files to Change
- adrs/ADR-007-language-choices.md (create new)

## Estimated Effort
Easy - 1 hour
"@

# ================================================================
# ISSUE 10
# ================================================================
Write-Host "  Issue #10: Complete missing OpenAPI specs..." -ForegroundColor Gray
New-Issue `
    -Title "[DOCS] Complete missing OpenAPI specs for Chat, User, and Dashboard services" `
    -Labels "priority:important,member:B,area:documentation" `
    -Body @"
## Problem
docs/api-spec/chat-api.yaml, user-api.yaml, and dashboard-api.yaml are empty files. Only auth-api.yaml is complete. Three of four API specs are missing.

## Acceptance Criteria
All specs must use OpenAPI 3.0.3 format matching the style of the existing auth-api.yaml.

### chat-api.yaml - Endpoints to document:
- [ ] POST /rooms - Create room (body: name, description)
- [ ] GET /rooms - List all rooms
- [ ] POST /rooms/{roomId}/join - Join a room
- [ ] POST /rooms/{roomId}/leave - Leave a room
- [ ] POST /rooms/{roomId}/messages - Send message (body: content; userId from JWT header)
- [ ] GET /rooms/{roomId}/messages - Get messages (query: cursor, limit)
- [ ] PUT /rooms/{roomId}/messages/{messageId} - Edit message
- [ ] DELETE /rooms/{roomId}/messages/{messageId} - Delete message

### user-api.yaml - Endpoints to document:
- [ ] GET /users/me - Get own profile
- [ ] PATCH /users/me - Update own profile (body: name, bio, avatar)
- [ ] GET /users - List all users (admin only)
- [ ] GET /users/search?q= - Search users by name/email
- [ ] GET /users/{id} - Get user by ID
- [ ] PATCH /users/{id}/role - Update user role (admin only)

### dashboard-api.yaml - Endpoints to document:
- [ ] GET /dashboard/active-users - Returns current active WebSocket user count
- [ ] GET /dashboard/message-volume - Returns time-series array of message counts (last 60 minutes)
- [ ] GET /dashboard/system-health - Returns health status of all downstream services

### All specs must include:
- [ ] Request body schemas with required fields
- [ ] Response schemas (200, 400, 401, 403, 404, 500)
- [ ] Security scheme referencing Bearer JWT
- [ ] At least one example per endpoint

## Files to Change
- docs/api-spec/chat-api.yaml
- docs/api-spec/user-api.yaml
- docs/api-spec/dashboard-api.yaml

## Estimated Effort
Medium - 3 to 4 hours total
"@

# ================================================================
# ISSUE 11
# ================================================================
Write-Host "  Issue #11: Configure HTTPS/TLS in API Gateway..." -ForegroundColor Gray
New-Issue `
    -Title "[SECURITY] Configure HTTPS/TLS termination in API Gateway (NGINX)" `
    -Labels "priority:critical,member:B,area:security,area:infrastructure" `
    -Body @"
## Problem
api-gateway/nginx.conf only listens on port 8080 (HTTP). The security requirement explicitly states HTTPS must be enforced. No TLS certificates are configured.

## Acceptance Criteria
- [ ] Generate self-signed certificate for development:
  mkdir -p api-gateway/certs
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout api-gateway/certs/server.key -out api-gateway/certs/server.crt -subj "/CN=localhost"

- [ ] Update api-gateway/nginx.conf:
  - Add server block listening on port 443 with SSL
  - ssl_certificate /etc/nginx/certs/server.crt
  - ssl_certificate_key /etc/nginx/certs/server.key
  - Add port 80 server block that redirects to HTTPS: return 301 https://$host$request_uri
  - Add ssl_protocols TLSv1.2 TLSv1.3
  - Add ssl_ciphers HIGH:!aNULL:!MD5

- [ ] Update infrastructure/docker-compose.yml:
  - Expose ports 443:443 and 80:80 on api-gateway
  - Mount ../api-gateway/certs:/etc/nginx/certs:ro

- [ ] Add api-gateway/certs/ to .gitignore (never commit private keys)
- [ ] Test: curl -k https://localhost/health returns 200

## Files to Change
- api-gateway/nginx.conf
- infrastructure/docker-compose.yml
- api-gateway/certs/ (create, gitignored)
- .gitignore

## Estimated Effort
Medium - 2 to 3 hours

## Security Note
Self-signed certs cause browser warnings - acceptable for demo/submission. Production would use Let's Encrypt.
"@

# ================================================================
# ISSUE 12
# ================================================================
Write-Host "  Issue #12: Write deployment diagram..." -ForegroundColor Gray
New-Issue `
    -Title "[DOCS] Write deployment diagram (PlantUML) showing Azure cloud hosting" `
    -Labels "priority:critical,member:B,area:documentation" `
    -Body @"
## Problem
diagrams/deployment-diagram.puml is an empty file. Phase 2 requires a deployment model showing how the system would be hosted on a cloud platform. This is a required deliverable.

## Acceptance Criteria
- [ ] Complete diagrams/deployment-diagram.puml using PlantUML deployment diagram syntax
- [ ] Show all 4 microservices mapped to Azure services:
  - Auth Service -> Azure Container Apps
  - User Service -> Azure Container Apps
  - Chat Service -> Azure Container Apps
  - Dashboard Service -> Azure Container Apps
- [ ] Show data stores:
  - PostgreSQL -> Azure Database for PostgreSQL Flexible Server
  - MongoDB -> MongoDB Atlas or Azure Cosmos DB for MongoDB
  - Redis -> Azure Cache for Redis
  - RabbitMQ -> Azure Service Bus (with note: self-hosted RabbitMQ used in dev)
  - OpenSearch -> self-hosted on Azure VM or Azure OpenSearch
- [ ] Show networking:
  - API Gateway (NGINX) as single entry point behind Azure Application Gateway or Azure Front Door
  - All services in a VNet with private subnets
  - Only port 443 exposed publicly
- [ ] Show observability:
  - Prometheus + Grafana in a monitoring container group
- [ ] Include a legend explaining the dev-to-production mapping
- [ ] Render to PNG and commit: plantuml diagrams/deployment-diagram.puml

## Files to Change
- diagrams/deployment-diagram.puml
- diagrams/deployment-diagram.png (generated)

## Estimated Effort
Medium - 2 to 3 hours
"@

# ================================================================
# ISSUE 13
# ================================================================
Write-Host "  Issue #13: Add Prometheus alerting rules..." -ForegroundColor Gray
New-Issue `
    -Title "[OBSERVABILITY] Add Prometheus alerting rules for critical events" `
    -Labels "priority:important,member:A,area:observability" `
    -Body @"
## Problem
prometheus.yml has the alerting section commented out and no alerting rules file exists. The grading rubric requires alerts configured for critical events.

## Acceptance Criteria
- [ ] Create infrastructure/prometheus/alerts.yml with rules:

  Service Down (critical):
    alert: ServiceDown
    expr: up == 0
    for: 1m
    severity: critical
    summary: Service is down

  High Error Rate (warning):
    alert: HighErrorRate
    expr: rate of 5xx responses > 5% over 5 minutes
    for: 5m
    severity: warning

  High p95 Latency (warning):
    alert: HighLatency
    expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 0.5
    for: 5m
    severity: warning

  RabbitMQ Queue Depth High (warning):
    alert: RabbitMQQueueDeep
    expr: rabbitmq_queue_messages_ready > 100
    for: 2m
    severity: warning

- [ ] Update infrastructure/prometheus/prometheus.yml to reference the rules file:
  rule_files:
    - /etc/prometheus/alerts.yml

- [ ] Mount alerts.yml in the Prometheus service in docker-compose.yml
- [ ] Verify rules appear in Prometheus UI under Alerts tab

## Files to Change
- infrastructure/prometheus/alerts.yml (create)
- infrastructure/prometheus/prometheus.yml
- infrastructure/docker-compose.yml (add volume mount for alerts.yml)

## Estimated Effort
Low - 1 to 2 hours

## Dependencies
Issue #1 (Prometheus service must be running)
"@

# ================================================================
# ISSUE 14
# ================================================================
Write-Host "  Issue #14: Enable RabbitMQ Prometheus plugin..." -ForegroundColor Gray
New-Issue `
    -Title "[INFRA] Enable RabbitMQ Prometheus plugin in docker-compose" `
    -Labels "priority:important,member:A,area:infrastructure,area:observability" `
    -Body @"
## Problem
The Grafana dashboard has a RabbitMQ Queue Depth panel querying rabbitmq_queue_messages_ready, but the docker-compose rabbitmq service uses rabbitmq:3-management-alpine which does not have the Prometheus plugin enabled. The metric endpoint at rabbitmq:15692/metrics does not exist.

## Acceptance Criteria
- [ ] Change rabbitmq image in docker-compose.yml to rabbitmq:3.13-management (non-alpine) OR create a custom Dockerfile that enables rabbitmq_prometheus plugin
- [ ] Verify http://localhost:15692/metrics returns Prometheus-format metrics after startup
- [ ] Verify rabbitmq_queue_messages_ready metric exists
- [ ] Prometheus target rabbitmq:15692 shows UP in Prometheus UI

## Files to Change
- infrastructure/docker-compose.yml
- infrastructure/rabbitmq/Dockerfile (optional, only if custom image approach)

## Estimated Effort
Easy - 30 minutes

## Dependencies
Issue #1 (Prometheus must be running to verify)
"@

# ================================================================
# ISSUE 15
# ================================================================
Write-Host "  Issue #15: Add dependency observability metrics..." -ForegroundColor Gray
New-Issue `
    -Title "[OBSERVABILITY] Add dependency observability metrics (MongoDB, Redis, RabbitMQ latency histograms)" `
    -Labels "priority:important,member:C,area:observability,area:backend" `
    -Body @"
## Problem
Zero Prometheus metrics track dependency health. Chat service MongoDB queries, Redis operations, and RabbitMQ publish latency have no observability. The Dashboard service circuit breaker tracks failures internally but never emits Prometheus metrics. This is the main reason the observability bonus score is low.

## Acceptance Criteria

### Chat Service (Node.js)
- [ ] Add Histogram mongodb_operation_duration_seconds with label operation (insert, find, update, delete)
  - Wrap createMessage, getMessages, updateMessage, deleteMessage in chat_repository.js
  - Use Date.now() before/after the mongoose call then histogram.observe(duration)
- [ ] Add Histogram rabbitmq_publish_duration_seconds
  - Wrap publishMessageCreated() in broker_service.js
- [ ] Add Counter rabbitmq_publish_errors_total
  - Increment on publish failure or channel not ready

### Auth Service (Go)
- [ ] Add Histogram redis_operation_duration_seconds with label operation (save_session, get_session, delete_session, blacklist_token)
  - Wrap calls in services/auth-service/internal/services/redis_service.go
- [ ] Add Counter google_oauth_requests_total with label status (success/failure)
  - Instrument ExchangeCode call in auth_service.go

### Dashboard Service (Python)
- [ ] Add Histogram rabbitmq_consumer_processing_duration_seconds
  - Time each message processed in events_consumer.py
- [ ] Add Counter circuit_breaker_state_changes_total with label state (open/closed)
  - Emit from CircuitBreaker.on_failure() and cooldown recovery
- [ ] Fix: use redis.asyncio.Redis instead of synchronous redis.Redis (currently blocking the event loop)

## Files to Change
- services/chat-service/internal/repository/chat_repository.js
- services/chat-service/internal/services/broker_service.js
- services/chat-service/internal/services/metrics_service.js
- services/auth-service/internal/services/redis_service.go
- services/auth-service/internal/services/auth_service.go
- services/dashboard-service/internal/services/events_consumer.py
- services/dashboard-service/internal/services/system_service.py

## Estimated Effort
High - 1 to 2 days

## Dependencies
- Issue #1 (Prometheus must be running to verify)
- Issue #3 (Auth metrics infrastructure must exist first)
"@

# ================================================================
# ISSUE 16
# ================================================================
Write-Host "  Issue #16: Write Phase 2 Final Report..." -ForegroundColor Gray
New-Issue `
    -Title "[DOCS] Write Phase 2 Final Report (docs/phase2-report.md)" `
    -Labels "priority:critical,member:B,area:documentation" `
    -Body @"
## Problem
docs/phase2-report.md is an empty file. A final written report is a required submission artifact for Phase 2.

## Acceptance Criteria
Write this LAST after all other issues are resolved so it accurately reflects the final state.

### Required Sections:

1. Architecture Summary
   - Overview of the 4-microservice design
   - Key architectural decisions (reference ADRs 001 to 007)
   - Technology stack table (service, language, framework, DB, port)
   - C4 model summary with links to diagrams

2. Implementation Challenges and Solutions
   - Migration from Node.js to Go for Auth/User services (why, what was hard)
   - WebSocket at-scale limitations (in-memory socketsByRoom - document as known limitation)
   - Docker networking issue (env_file pointing to .env.example - document fix)
   - OAuth2 CSRF issue discovered and fixed (static state param to random nonce)

3. Performance Evaluation
   - k6 load test results (1000 VUs ramp on chat, auth stress test results)
   - p95 latency, error rate, throughput
   - Comparison against SLO targets (p95 < 200ms, 99.9% availability)
   - Bottlenecks identified

4. Observability
   - Screenshots of Grafana dashboard panels
   - Screenshot of Prometheus targets page showing all UP
   - Screenshot of OpenSearch with log entries

5. Security
   - OAuth2 flow description
   - JWT RS256 validation at gateway level
   - HTTPS configuration
   - Rate limiting behavior

6. Microservices Complexity Reflection
   - What was harder than a monolith (distributed tracing, service discovery, network failures)
   - What was better (independent deployability, language freedom)
   - What we would do differently (Kubernetes from the start, shared proto definitions)

7. Known Limitations
   - Single-instance WebSocket (no Redis pub/sub for horizontal scaling)
   - No distributed tracing implemented
   - Self-signed TLS certificate (not Let's Encrypt)

## Files to Change
- docs/phase2-report.md

## Estimated Effort
High - 4 to 8 hours (requires all other work to be done first)

## Notes
Write in a shared Google Doc first, then convert to Markdown.
"@

# ================================================================
# ISSUE 17
# ================================================================
Write-Host "  Issue #17: Add circuit breakers to Auth, User, Chat..." -ForegroundColor Gray
New-Issue `
    -Title "[BACKEND] Add circuit breakers and retry logic to Auth, User, and Chat services" `
    -Labels "priority:important,member:C,area:backend" `
    -Body @"
## Problem
Only the Dashboard service implements circuit breakers. Auth service (Google OAuth calls), User service (PostgreSQL), and Chat service (RabbitMQ, MongoDB) have no resilience patterns. The ADR mentions 3 retries with 100ms/200ms/400ms exponential backoff but only Dashboard implements this.

## Acceptance Criteria

### Chat Service - RabbitMQ Circuit Breaker (HIGHEST PRIORITY)
- [ ] broker_service.js currently crashes if RabbitMQ is unavailable at startup
- [ ] Implement retry logic in connectBroker():
  - Retry up to 5 times with exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
  - Throw error after all retries exhausted
- [ ] Add simple in-memory circuit breaker for publish operations:
  - Track consecutive failures
  - After 5 failures: open circuit, return false immediately
  - After 30 second cooldown: attempt one probe request (half-open)

### Auth Service - Google OAuth Retry (Go)
- [ ] Add retry around oauthCfg.Exchange(ctx, code) in auth_service.go:
  - Retry up to 3 times with 100ms/200ms/400ms backoff
  - Only retry on network errors (not on invalid_grant)
  - Use context deadline of 5 seconds total

### User Service - GORM Connection Resilience
- [ ] Configure GORM connection pool in user_repository.go:
  - SetMaxOpenConns(25)
  - SetMaxIdleConns(5)
  - SetConnMaxLifetime(5 minutes)
- [ ] Add retry logic around db.First() and db.Save() for transient connection errors

### Update ADR-001
- [ ] Document the resilience patterns in adrs/ADR-001-microservices.md

## Files to Change
- services/chat-service/internal/services/broker_service.js
- services/auth-service/internal/services/auth_service.go
- services/user-service/internal/repository/user_repository.go
- adrs/ADR-001-microservices.md

## Estimated Effort
Medium - 3 to 4 hours
"@

# ================================================================
# ISSUE 18
# ================================================================
Write-Host "  Issue #18: Configure test coverage reporting..." -ForegroundColor Gray
New-Issue `
    -Title "[TESTING] Configure test coverage reporting for all services (target: 80%)" `
    -Labels "priority:important,member:A,area:testing" `
    -Body @"
## Problem
The requirement is 80% unit test coverage but no coverage reports are generated anywhere. Without measurement the 80% claim cannot be verified.

## Acceptance Criteria

### Go Services (Auth + User)
- [ ] Auth service: add coverage commands to Makefile or scripts:
  go test -coverprofile=coverage.out ./internal/...
  go tool cover -html=coverage.out -o coverage.html
  go tool cover -func=coverage.out | grep total
- [ ] User service: same pattern
- [ ] Both must show at least 80% total coverage
- [ ] If below 80%: add missing test cases (likely repository layer)

### Node.js Chat Service
- [ ] Add Jest coverage config to services/chat-service/package.json:
  collectCoverage: true
  coverageDirectory: coverage
  coverageThreshold: { global: { lines: 80 } }
  coveragePathIgnorePatterns: [/node_modules/, /src/]
- [ ] Fix coverage gaps: add tests for getMessages, editMessage, deleteMessage, chat_repository.js

### Python Dashboard Service
- [ ] Add pytest-cov to services/dashboard-service/tests/requirements-test.txt
- [ ] Run: pytest --cov=internal --cov-report=html --cov-fail-under=80
- [ ] Add tests for system_service.py CircuitBreaker (currently 0% covered)
- [ ] Add tests for dashboard_handler.py routes

### Root Scripts
- [ ] Create root-level Makefile with target: make coverage
- [ ] Create scripts/coverage.ps1 for Windows team members

## Files to Change
- services/auth-service/Makefile (or README)
- services/user-service/Makefile (or README)
- services/chat-service/package.json
- services/dashboard-service/tests/requirements-test.txt
- Makefile (root, create if not exists)

## Estimated Effort
Low to Medium - 2 to 3 hours (config is easy; writing missing tests takes longer)
"@

# ================================================================
# ISSUE 19
# ================================================================
Write-Host "  Issue #19: Fix env_file localhost bug..." -ForegroundColor Gray
New-Issue `
    -Title "[INFRA] Fix docker-compose env_file pointing to .env.example (RabbitMQ/Redis localhost bug)" `
    -Labels "priority:critical,member:A,area:infrastructure" `
    -Body @"
## Problem
CRITICAL SILENT BUG: docker-compose.yml uses env_file pointing to .env.example files. These files contain placeholder values like RABBITMQ_URL=amqp://localhost:5672 instead of Docker network hostnames (rabbitmq, redis). Chat and Dashboard services start but immediately fail to connect to RabbitMQ and Redis.

## Acceptance Criteria
- [ ] Create services/chat-service/.env (gitignored) with correct Docker network values:
  RABBITMQ_URL=amqp://rabbitmq:5672
  REDIS_URL=redis://redis:6379
  MONGODB_URL=mongodb://mongo:27017/chatdb
  PORT=3002

- [ ] Create services/dashboard-service/.env (gitignored) with correct values:
  RABBITMQ_URL=amqp://rabbitmq:5672
  REDIS_URL=redis://redis:6379
  PORT=3004

- [ ] Update infrastructure/docker-compose.yml to use .env instead of .env.example for both services
- [ ] Keep .env.example files as templates with updated comments
- [ ] Add services/**/.env to .gitignore
- [ ] Verify Chat service connects to RabbitMQ and MongoDB successfully after docker compose up
- [ ] Verify Dashboard service connects to RabbitMQ and Redis successfully

## Files to Change
- infrastructure/docker-compose.yml
- services/chat-service/.env (create, gitignored)
- services/dashboard-service/.env (create, gitignored)
- .gitignore

## Estimated Effort
Easy - 30 minutes

## Priority
Fix this in the same session as Issue #1. Without this fix, services appear to start but fail silently.
"@

# ================================================================
# ISSUE 20
# ================================================================
Write-Host "  Issue #20: Fix Chat service userId security bug..." -ForegroundColor Gray
New-Issue `
    -Title "[SECURITY] Fix Chat service authorization: extract userId from JWT headers not request body" `
    -Labels "priority:important,member:C,area:security,area:backend" `
    -Body @"
## Problem
SECURITY VULNERABILITY: chat_handler.js accepts userId from the request body for edit and delete operations. Any authenticated user can edit or delete any other user's messages by passing a different userId in the request body. The API Gateway forwards the validated JWT user ID in the X-User-Id header - the handler must use that header instead.

## Root Cause
Current vulnerable code:
  const { userId, content } = req.body;
  if (msg.userId !== userId) return 403
  // userId is attacker-controlled - anyone can pass any userId

## Acceptance Criteria
- [ ] Update chat_handler.js editMessage and deleteMessage handlers:
  const userId = req.headers['x-user-id']; // Set by API Gateway from JWT
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

- [ ] Update createMessage similarly - userId must come from the header, not the body
- [ ] Update API spec (Issue #10) to reflect that userId is NOT a body parameter
- [ ] Add unit test that verifies a user cannot edit/delete another user's message
- [ ] Verify API Gateway correctly sets X-User-Id header from JWT sub claim (check jwt_auth.lua)

## Files to Change
- services/chat-service/internal/handlers/chat_handler.js
- services/chat-service/tests/chat_handler_and_broker.test.js (add auth test)

## Estimated Effort
Easy - 1 hour

## Security Impact
Without this fix any logged-in user can delete all messages in the system.
"@

# ================================================================
# ISSUE 21
# ================================================================
Write-Host "  Issue #21: Fix OAuth2 CSRF static state parameter..." -ForegroundColor Gray
New-Issue `
    -Title "[SECURITY] Fix OAuth2 CSRF vulnerability: replace static state parameter with random nonce" `
    -Labels "priority:important,member:C,area:security,area:backend" `
    -Body @"
## Problem
auth_service.go hardcodes the string "state" as the OAuth2 state parameter in AuthCodeURL("state"). A static state value means CSRF protection is effectively absent. An attacker can craft a callback URL with state=state and trick a victim into completing the OAuth flow under the attacker's session.

## Acceptance Criteria
- [ ] Generate a cryptographically random nonce per login request using crypto/rand
  - Create generateState() function returning hex-encoded 16 random bytes
- [ ] Store the nonce in Redis with a short TTL (5 minutes) before redirecting:
  - Key: oauth_state:{state}
  - Value: "1"
  - TTL: 5 minutes
- [ ] In HandleGoogleCallback(), verify the returned state exists in Redis:
  - If not found: return error "invalid or expired OAuth state"
  - If found: delete the key (one-time use) then continue
- [ ] Add unit test verifying that a callback with an invalid state returns an error
- [ ] Add unit test verifying that a valid state is accepted and then deleted (cannot be reused)

## Files to Change
- services/auth-service/internal/services/auth_service.go
- services/auth-service/internal/services/auth_service_test.go

## Estimated Effort
Easy - 1 to 2 hours
"@

# ================================================================
# ISSUE 22
# ================================================================
Write-Host "  Issue #22: Run k6 load tests and commit results..." -ForegroundColor Gray
New-Issue `
    -Title "[TESTING] Run k6 load tests, capture results, and fix empty integration tests" `
    -Labels "priority:important,member:C,area:testing" `
    -Body @"
## Problem
k6 scripts exist for chat load (1000 VUs), auth stress, and dashboard metrics but no results are present. The results directory is excluded from git. The Phase 2 report requires performance data. The root k6-scenarios.js is also empty. Integration test files for chat and user are empty.

## Acceptance Criteria

### Fix k6-scenarios.js root file
- [ ] tests/load/k6-scenarios.js should import and re-export scenarios from sub-files:
  export { default as chatLoad } from './scenarios/chat-load.js'
  export { default as authStress } from './scenarios/auth-stress.js'
  export { default as dashboardMetrics } from './scenarios/dashboard-metrics.js'

### Run load tests (requires full stack running)
- [ ] Start full docker-compose stack
- [ ] Run chat load test: k6 run tests/load/scenarios/chat-load.js
- [ ] Run auth stress test: k6 run tests/load/scenarios/auth-stress.js
- [ ] Run dashboard metrics test: k6 run tests/load/scenarios/dashboard-metrics.js

### Capture and commit results
- [ ] Create tests/load/results/summary.md with:
  - Test date and stack version
  - For each test: VUs, duration, p50/p95/p99 latency, error rate, throughput
  - Comparison against SLO: p95 < 200ms target
  - Identified bottlenecks
- [ ] Save k6 JSON output: k6 run --out json=results/chat-load-results.json

### Fix empty integration test files
- [ ] tests/integration/chat.test.js - add at minimum:
  - POST /rooms returns 201
  - POST /rooms/:id/messages returns 201
  - GET /rooms/:id/messages returns 200 with pagination
- [ ] tests/integration/user.test.js - add at minimum:
  - GET /users/me returns 200
  - PATCH /users/me returns 200

## Files to Change
- tests/load/k6-scenarios.js
- tests/load/results/summary.md (create)
- tests/integration/chat.test.js
- tests/integration/user.test.js

## Estimated Effort
Medium - 3 to 4 hours
"@

# ================================================================
# ISSUE 23
# ================================================================
Write-Host "  Issue #23: Fix Grafana dashboard panels..." -ForegroundColor Gray
New-Issue `
    -Title "[OBSERVABILITY] Fix Grafana dashboard: add missing panels and correct PromQL queries" `
    -Labels "priority:important,member:A,area:observability" `
    -Body @"
## Problem
The Grafana dashboard JSON has 6 panels but several issues:
1. Auth/User services produce no metrics so panels show no data
2. chat_active_users metric EXISTS but has NO dashboard panel
3. chat_messages_total rate has NO dashboard panel
4. No p99 latency panel (only p95 exists)
5. CPU/Memory panels require node-exporter (Issue #2)
6. RabbitMQ panel requires plugin (Issue #14)

## Acceptance Criteria
- [ ] Add panel: Active WebSocket Users using metric chat_active_users
- [ ] Add panel: Messages Per Minute using rate(chat_messages_total[1m]) * 60
- [ ] Add panel: p99 Response Time using histogram_quantile(0.99, ...)
- [ ] Fix HTTP Request Rate panel PromQL to use correct label names for both FastAPI (handler) and prom-client (path) - use job label to distinguish
- [ ] Fix HTTP Error Rate panel label differences between FastAPI (status_code) and prom-client (code)
- [ ] Add Service Status panel using up{job=~"auth|chat|user|dashboard"}
- [ ] Verify all panels load without No Data errors after Issues #1 to #4 are complete
- [ ] Export updated dashboard JSON from Grafana UI and save to system-overview.json

## Files to Change
- infrastructure/grafana/dashboards/system-overview.json

## Estimated Effort
Medium - 2 to 3 hours

## Dependencies
- Issue #1 (Grafana must be running)
- Issue #2 (node-exporter for CPU/memory panels)
- Issue #3 and #4 (Auth/User metrics)
- Issue #14 (RabbitMQ metrics)
"@

# ================================================================
# ISSUE 24
# ================================================================
Write-Host "  Issue #24: Add restart policies and clean up Chat service..." -ForegroundColor Gray
New-Issue `
    -Title "[INFRA] Add restart policies to docker-compose and clean up Chat service dead code" `
    -Labels "priority:nice-to-have,member:A,area:infrastructure,area:backend" `
    -Body @"
## Problem
1. No restart policy on any docker-compose service. If a container crashes it stays down until manually restarted. For a demo this is risky.
2. Chat service has dead code. The src/ directory contains re-export shims pointing to internal/. The package.json main field points to src/server.js but the real entry is cmd/main.js.

## Acceptance Criteria

### Restart Policies
- [ ] Add restart: unless-stopped to ALL services in docker-compose.yml:
  - auth-service, user-service, chat-service, dashboard-service
  - api-gateway, postgres, mongo, redis, rabbitmq, opensearch
  - prometheus, grafana, node-exporter, redis-exporter, filebeat (once added)

### Chat Service Cleanup
- [ ] Update services/chat-service/package.json:
  - Change main from src/server.js to cmd/main.js
  - Change start script from node src/server.js to node cmd/main.js
- [ ] Delete services/chat-service/src/ directory (it only contains re-exports)
- [ ] Verify docker compose up chat-service still works after cleanup
- [ ] Add comment in cmd/main.js explaining the Go-style directory structure

## Files to Change
- infrastructure/docker-compose.yml
- services/chat-service/package.json
- services/chat-service/src/ (delete)

## Estimated Effort
Easy - 1 hour
"@