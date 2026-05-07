from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx


class CircuitBreaker:
    def __init__(self, threshold: int = 3, cooldown_seconds: int = 10) -> None:
        self.threshold = threshold
        self.cooldown_seconds = cooldown_seconds
        self.failures = 0
        self.opened_at: float | None = None

    def can_call(self) -> bool:
        if self.opened_at is None:
            return True
        return (time.time() - self.opened_at) >= self.cooldown_seconds

    def on_success(self) -> None:
        self.failures = 0
        self.opened_at = None

    def on_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.threshold:
            self.opened_at = time.time()


async def fetch_with_retry(url: str, breaker: CircuitBreaker) -> dict[str, Any]:
    if not breaker.can_call():
        raise RuntimeError("circuit open")

    delays = [0.1, 0.2, 0.4]
    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=2.0) as client:
        for idx, delay in enumerate(delays):
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                breaker.on_success()
                return data
            except Exception as exc:  # broad by design: network + status + parse
                last_error = exc
                breaker.on_failure()
                if idx < len(delays) - 1:
                    await asyncio.sleep(delay)
    raise RuntimeError(str(last_error) if last_error else "request failed")
