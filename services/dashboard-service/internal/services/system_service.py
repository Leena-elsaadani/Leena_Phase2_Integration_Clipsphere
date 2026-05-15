from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
from prometheus_client import Counter

circuit_breaker_state_changes_total = Counter(
    "circuit_breaker_state_changes_total",
    "Circuit breaker transitions to open or closed",
    ["state"],
)


import threading

class CircuitBreaker:
    def __init__(self, threshold: int = 3, cooldown_seconds: int = 10) -> None:
        self.threshold = threshold
        self.cooldown_seconds = cooldown_seconds
        self.failures = 0
        self.opened_at: float | None = None
        self._lock = threading.Lock()

    def can_call(self) -> bool:
        with self._lock:
            if self.opened_at is None:
                return True
            return (time.time() - self.opened_at) >= self.cooldown_seconds

    def on_success(self) -> None:
        with self._lock:
            was_open = self.opened_at is not None
            self.failures = 0
            self.opened_at = None
        if was_open:
            circuit_breaker_state_changes_total.labels("closed").inc()

    def on_failure(self) -> None:
        with self._lock:
            self.failures += 1
            if self.failures >= self.threshold:
                if self.opened_at is None:
                    circuit_breaker_state_changes_total.labels("open").inc()
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
