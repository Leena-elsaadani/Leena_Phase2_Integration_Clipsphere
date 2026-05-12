# PowerShell rebuild commands for Go services with hang fix

Write-Host "Cleaning Docker build cache for Go services..." -ForegroundColor Cyan
docker builder prune -f

Write-Host "`nBuilding auth-service..." -ForegroundColor Cyan
docker compose -f infrastructure/docker-compose.yml build --no-cache auth-service
if ($LASTEXITCODE -ne 0) {
    Write-Host "auth-service build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nBuilding user-service..." -ForegroundColor Cyan
docker compose -f infrastructure/docker-compose.yml build --no-cache user-service
if ($LASTEXITCODE -ne 0) {
    Write-Host "user-service build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nStarting services..." -ForegroundColor Cyan
docker compose -f infrastructure/docker-compose.yml up -d auth-service user-service

Write-Host "`nWaiting 20 seconds for healthchecks to pass..." -ForegroundColor Cyan
Start-Sleep -Seconds 20

Write-Host "`nService status:" -ForegroundColor Cyan
docker compose -f infrastructure/docker-compose.yml ps | Select-String "auth-service|user-service"

Write-Host "`nTesting auth-service metrics endpoint..." -ForegroundColor Cyan
docker exec infrastructure-auth-service-1 wget -qO- http://127.0.0.1:3001/metrics 2>$null | Select-String "auth_service_http_requests_total" -First 1

Write-Host "`nTesting user-service metrics endpoint..." -ForegroundColor Cyan
docker exec infrastructure-user-service-1 wget -qO- http://127.0.0.1:3003/metrics 2>$null | Select-String "user_service_http_requests_total" -First 1

Write-Host "`nBuild and verification complete!" -ForegroundColor Green
