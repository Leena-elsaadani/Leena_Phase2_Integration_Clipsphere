import asyncio

from fakeredis import FakeAsyncRedis

from internal.services.redis_metrics_store import RedisMetricsStore


def _patch_async_redis(monkeypatch, fake: FakeAsyncRedis) -> None:
    monkeypatch.setattr(
        "internal.services.redis_metrics_store.redis.Redis",
        lambda **kwargs: fake,
    )


def test_message_created_updates_metrics(monkeypatch):
    async def _run() -> None:
        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)
        store = RedisMetricsStore()
        payload = {"messageId": "m1", "userId": "u1", "timestamp": "1710000000"}
        await store.on_message_created(payload)

        assert await fake.scard(store.active_users_key) == 1
        assert int(await fake.get(store.message_count_key)) == 1
        points = await store.message_points()
        assert len(points) == 1
        assert points[0]["count"] == 1

    asyncio.run(_run())


def test_user_connected_event_processed(monkeypatch):
    async def _run() -> None:
        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)
        store = RedisMetricsStore()
        await store.on_user_connected({"userId": "u2", "timestamp": "1710000001"})
        assert await fake.sismember(store.active_users_key, "u2") == 1

    asyncio.run(_run())


def test_event_idempotency(monkeypatch):
    async def _run() -> None:
        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)
        store = RedisMetricsStore()
        payload = {"messageId": "same", "userId": "u1", "timestamp": "1710000100"}
        await store.on_message_created(payload)
        await store.on_message_created(payload)
        assert int(await fake.get(store.message_count_key)) == 1

    asyncio.run(_run())
