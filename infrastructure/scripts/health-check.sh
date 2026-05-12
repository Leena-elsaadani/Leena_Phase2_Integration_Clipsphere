#!/bin/sh
# health-check.sh
# Checks the /health endpoint of every service and reports status.
# Usage: ./infrastructure/scripts/health-check.sh
# Exit code: 0 = all healthy, 1 = one or more unhealthy

set -e

GATEWAY=${API_GATEWAY_URL:-http://localhost:8080}

SERVICES="
  auth-service|http://localhost:3001/health
  user-service|http://localhost:3003/health
  chat-service|http://localhost:3002/health
  dashboard-service|http://localhost:8100/health
"

ALL_OK=true

echo "================================================"
echo " Service Health Check — $(date)"
echo "================================================"

for entry in $SERVICES; do
  NAME=$(echo "$entry" | cut -d'|' -f1)
  URL=$(echo "$entry"  | cut -d'|' -f2)

  # curl: -s silent, -o /dev/null discard body, -w write HTTP code, --max-time 3
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$URL" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓  $NAME  ($URL) → $HTTP_CODE OK"
  else
    echo "  ✗  $NAME  ($URL) → $HTTP_CODE UNHEALTHY"
    ALL_OK=false
  fi
done

echo ""

# Infrastructure checks
for svc in "postgres:5432" "redis:6379" "rabbitmq:5672"; do
  HOST=$(echo "$svc" | cut -d: -f1)
  PORT=$(echo "$svc" | cut -d: -f2)
  if nc -z "$HOST" "$PORT" 2>/dev/null; then
    echo "  ✓  $HOST:$PORT reachable"
  else
    echo "  ✗  $HOST:$PORT UNREACHABLE"
    ALL_OK=false
  fi
done

echo "================================================"

if [ "$ALL_OK" = "true" ]; then
  echo " All services healthy ✓"
  exit 0
else
  echo " One or more services UNHEALTHY ✗"
  exit 1
fi