#!/bin/bash
# Docker rebuild commands for Go services with hang fix

# 1. Clean build cache (recommended after Dockerfile changes)
echo "Cleaning Docker build cache for Go services..."
docker builder prune -f

# 2. Rebuild auth-service with verbose output
echo ""
echo "Building auth-service..."
docker compose -f infrastructure/docker-compose.yml build --no-cache auth-service

# 3. Rebuild user-service with verbose output
echo ""
echo "Building user-service..."
docker compose -f infrastructure/docker-compose.yml build --no-cache user-service

# 4. Start services to verify they work
echo ""
echo "Starting services..."
docker compose -f infrastructure/docker-compose.yml up -d auth-service user-service

# 5. Verify services are healthy
echo ""
echo "Waiting 15 seconds for healthchecks to run..."
sleep 15
echo ""
echo "Service status:"
docker compose -f infrastructure/docker-compose.yml ps | grep -E "auth-service|user-service"

# 6. Verify metrics endpoints respond
echo ""
echo "Testing auth-service metrics endpoint..."
docker exec infrastructure-auth-service-1 wget -qO- http://127.0.0.1:3001/metrics | head -5

echo ""
echo "Testing user-service metrics endpoint..."
docker exec infrastructure-user-service-1 wget -qO- http://127.0.0.1:3003/metrics | head -5

echo ""
echo "Build and verification complete!"
