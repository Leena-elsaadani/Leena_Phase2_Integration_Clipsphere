from __future__ import annotations

import hashlib
import os
import time

import redis.asyncio as redis


class RedisMetricsStore:
    def __init__(self) -> None:
        kwargs: dict = {
            "host": os.getenv("REDIS_HOST", "redis"),
            "port": int(os.getenv("REDIS_PORT", "6379")),
            "db": int(os.getenv("REDIS_DB", "0")),
            "decode_responses": True,
        }
        pw = os.getenv("REDIS_PASSWORD")
        if pw:
            kwargs["password"] = pw
        self.client = redis.Redis(**kwargs)
        self.active_users_key = "dashboard:active_users"
        self.message_count_key = "dashboard:message_count"
        self.message_volume_zset = "dashboard:message_volume"

    def _event_key(self, event_type: str, payload: dict) -> str:
        raw = f"{event_type}:{payload.get('messageId','')}:{payload.get('userId','')}:{payload.get('timestamp','')}"
        return "dashboard:event:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()

    async def is_new_event(self, event_type: str, payload: dict) -> bool:
        key = self._event_key(event_type, payload)
        created = await self.client.set(key, "1", nx=True, ex=7200)
        return bool(created)

    async def on_message_created(self, payload: dict) -> None:
        if not await self.is_new_event("message.created", payload):
            return
        user_id = payload.get("userId")
        if user_id:
            await self.client.sadd(self.active_users_key, user_id)
        await self.client.incr(self.message_count_key)
        ts = payload.get("timestamp")
        try:
            epoch = int(float(ts))
        except Exception:
            epoch = int(time.time())
        bucket = epoch - (epoch % 60)
        await self.client.zincrby(self.message_volume_zset, 1, str(bucket))

    async def on_user_connected(self, payload: dict) -> None:
        if not await self.is_new_event("user.connected", payload):
            return
        user_id = payload.get("userId")
        if user_id:
            await self.client.sadd(self.active_users_key, user_id)

    async def on_user_disconnected(self, payload: dict) -> None:
        if not await self.is_new_event("user.disconnected", payload):
            return
        user_id = payload.get("userId")
        if user_id:
            await self.client.srem(self.active_users_key, user_id)

    async def active_user_count(self) -> int:
        return int(await self.client.scard(self.active_users_key))

    async def message_points(self) -> list[dict[str, int | str]]:
        rows = await self.client.zrange(self.message_volume_zset, -120, -1, withscores=True)
        return [{"ts": k, "count": int(v)} for k, v in rows]
