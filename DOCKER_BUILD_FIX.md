# Docker Build Hang Fix: auth-service and user-service

## Problem Diagnosis

The `RUN go mod download` hang was caused by:

1. **Missing go.sum file** - Docker only copied go.mod, not go.sum
   - Go re-verifies all dependencies from scratch (slow/unreliable)
   - Network timeouts more likely
   
2. **No explicit Go proxy fallback** - Using default proxy only
   - Single point of failure for network issues
   
3. **No verbose logging** - Can't diagnose what's happening
   - Build appears stuck with no error messages
   
4. **Poor Docker layer caching** - Rebuilds on every code change
   - Dependencies downloaded every time

## Solution Applied

### Updated Dockerfiles

Both `services/user-service/Dockerfile` and `services/auth-service/Dockerfile` now have:

```dockerfile
FROM golang:1.24-alpine AS builder

WORKDIR /app
# Copy dependency files first for better layer caching
COPY go.mod go.sum ./
# Set Go proxy with fallback and download with verbose logging
RUN --mount=type=cache,target=/go/pkg/mod \
    env GOPROXY=https://proxy.golang.org,https://goproxy.io,direct \
    go mod download -x
# Copy source code
COPY cmd ./cmd
COPY internal ./internal
# Build with CGO disabled for Alpine compatibility
RUN CGO_ENABLED=0 GOOS=linux go build -o /[service-name] ./cmd/main.go
```

### Key Improvements

| Change | Benefit |
|--------|---------|
| `COPY go.mod go.sum ./` | Ensures hash verification from cache instead of re-fetching all dependencies |
| `--mount=type=cache,target=/go/pkg/mod` | Docker BuildKit cache mount speeds up repeated builds |
| `GOPROXY=https://proxy.golang.org,https://goproxy.io,direct` | Fallback proxies prevent single point of failure |
| `go mod download -x` | Verbose output shows exactly what's being downloaded |
| Source code copied last | Only rebuilds when code changes, not on dependency changes |

## Rebuild Instructions

### PowerShell (Windows)

```powershell
# Run from project root
.\rebuild-go-services.ps1
```

### Manual Step-by-Step (if script fails)

```powershell
# 1. Clean Docker cache
docker builder prune -f

# 2. Build auth-service
docker compose -f infrastructure/docker-compose.yml build --no-cache auth-service

# 3. Build user-service
docker compose -f infrastructure/docker-compose.yml build --no-cache user-service

# 4. Start both services
docker compose -f infrastructure/docker-compose.yml up -d auth-service user-service

# 5. Wait for healthchecks
Start-Sleep -Seconds 20

# 6. Check status
docker compose -f infrastructure/docker-compose.yml ps
```

## Verification Commands

### Check service health
```powershell
docker compose -f infrastructure/docker-compose.yml ps | Select-String "auth-service|user-service"
```

Expected: Both services show `(healthy)` status

### Test auth-service metrics
```powershell
docker exec infrastructure-auth-service-1 wget -qO- http://127.0.0.1:3001/metrics
```

Expected: Prometheus metrics including `auth_service_http_requests_total`, `auth_service_http_request_duration_seconds`

### Test user-service metrics
```powershell
docker exec infrastructure-user-service-1 wget -qO- http://127.0.0.1:3003/metrics
```

Expected: Prometheus metrics including `user_service_http_requests_total`, `user_service_http_request_duration_seconds`

### Check build logs (if rebuild hangs again)
```powershell
docker compose -f infrastructure/docker-compose.yml build auth-service 2>&1 | Select-String "go mod download"
```

## Files Modified

- `services/auth-service/Dockerfile` - Fixed go.mod→go.sum copy, added GOPROXY, added verbose logging
- `services/user-service/Dockerfile` - Same fixes as auth-service
- No changes to Go source code required
- go.mod and go.sum already in place and up-to-date

## Troubleshooting

If build still hangs:

1. **Check Docker Desktop is using BuildKit**
   ```powershell
   docker buildx version  # Should show BuildKit
   ```

2. **Clear all Docker caches**
   ```powershell
   docker system prune -a -f
   ```

3. **Check network connectivity**
   ```powershell
   docker run --rm alpine wget -qO- https://proxy.golang.org/google.golang.org/protobuf/@v/list
   ```

4. **Try direct build with timeout**
   ```powershell
   docker compose -f infrastructure/docker-compose.yml build --no-cache --progress=plain auth-service
   ```
   (Watch for actual error messages instead of just hanging)
