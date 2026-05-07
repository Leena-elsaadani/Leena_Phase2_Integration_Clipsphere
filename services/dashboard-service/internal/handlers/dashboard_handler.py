from fastapi import FastAPI

from internal.services.system_service import CircuitBreaker, fetch_with_retry
from internal.services.redis_metrics_store import RedisMetricsStore


def register_handlers(app: FastAPI) -> None:
    store = RedisMetricsStore()
    auth_breaker = CircuitBreaker()
    user_breaker = CircuitBreaker()
    chat_breaker = CircuitBreaker()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/dashboard/active-users")
    async def active_users() -> dict[str, int]:
        return {"activeUsers": store.active_user_count()}

    @app.get("/dashboard/message-volume")
    async def message_volume() -> dict[str, list[dict[str, int | str]]]:
        return {"points": store.message_points()}

    @app.get("/dashboard/system-health")
    async def system_health() -> dict[str, dict[str, str]]:
        result: dict[str, dict[str, str]] = {}
        checks = [
            ("auth-service", "http://auth-service:3001/health", auth_breaker),
            ("user-service", "http://user-service:3003/health", user_breaker),
            ("chat-service", "http://chat-service:3002/health", chat_breaker),
        ]
        for name, url, breaker in checks:
            try:
                await fetch_with_retry(url, breaker)
                result[name] = {"status": "up"}
            except Exception:
                result[name] = {"status": "down"}
        return {"services": result}
