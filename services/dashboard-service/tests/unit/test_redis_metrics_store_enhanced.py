import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from internal.services.redis_metrics_store import RedisMetricsStore


def _patch_async_redis(monkeypatch, fake):
    """Helper to patch async redis with fake redis."""
    monkeypatch.setattr(
        "internal.services.redis_metrics_store.redis.Redis",
        lambda **kwargs: fake,
    )


class TestRedisMetricsStoreInitialization:
    def test_redis_metrics_store_initialization_defaults(self, monkeypatch):
        """Test RedisMetricsStore initialization with default settings."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        assert store.active_users_key == "dashboard:active_users"
        assert store.message_count_key == "dashboard:message_count"
        assert store.message_volume_zset == "dashboard:message_volume"

    def test_redis_metrics_store_initialization_with_env_vars(self, monkeypatch):
        """Test RedisMetricsStore initialization with environment variables."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        monkeypatch.setenv("REDIS_HOST", "customhost")
        monkeypatch.setenv("REDIS_PORT", "6380")
        monkeypatch.setenv("REDIS_DB", "1")
        monkeypatch.setenv("REDIS_PASSWORD", "secret")

        store = RedisMetricsStore()

        # Store should use environment variables
        assert store.client is not None

    def test_redis_metrics_store_initialization_with_password(self, monkeypatch):
        """Test RedisMetricsStore initialization with password."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        monkeypatch.setenv("REDIS_PASSWORD", "mypassword")

        store = RedisMetricsStore()

        assert store.client is not None


class TestEventKeyGeneration:
    def test_event_key_generation_message_created(self):
        """Test event key generation for message.created event."""
        store = RedisMetricsStore()
        payload = {
            "messageId": "msg123",
            "userId": "user456",
            "timestamp": "1710000000"
        }

        key = store._event_key("message.created", payload)

        assert key.startswith("dashboard:event:")
        assert len(key) > len("dashboard:event:")

    def test_event_key_generation_without_message_id(self):
        """Test event key generation when messageId is missing."""
        store = RedisMetricsStore()
        payload = {
            "userId": "user456",
            "timestamp": "1710000000"
        }

        key = store._event_key("message.created", payload)

        assert key.startswith("dashboard:event:")
        # Should handle missing messageId gracefully

    def test_event_key_generation_without_user_id(self):
        """Test event key generation when userId is missing."""
        store = RedisMetricsStore()
        payload = {
            "messageId": "msg123",
            "timestamp": "1710000000"
        }

        key = store._event_key("message.created", payload)

        assert key.startswith("dashboard:event:")

    def test_event_key_generation_consistency(self):
        """Test event key generation is consistent for same input."""
        store = RedisMetricsStore()
        payload = {
            "messageId": "msg123",
            "userId": "user456",
            "timestamp": "1710000000"
        }

        key1 = store._event_key("message.created", payload)
        key2 = store._event_key("message.created", payload)

        assert key1 == key2

    def test_event_key_generation_different_events(self):
        """Test event key generation differs for different events."""
        store = RedisMetricsStore()
        payload = {
            "messageId": "msg123",
            "userId": "user456",
            "timestamp": "1710000000"
        }

        key1 = store._event_key("message.created", payload)
        key2 = store._event_key("user.connected", payload)

        assert key1 != key2


class TestIsNewEvent:
    @pytest.mark.asyncio
    async def test_is_new_event_first_time(self, monkeypatch):
        """Test is_new_event returns True for first occurrence."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "messageId": "msg123",
            "userId": "user456",
            "timestamp": "1710000000"
        }

        result = await store.is_new_event("message.created", payload)

        assert result is True

    @pytest.mark.asyncio
    async def test_is_new_event_duplicate(self, monkeypatch):
        """Test is_new_event returns False for duplicate event."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "messageId": "msg123",
            "userId": "user456",
            "timestamp": "1710000000"
        }

        # First occurrence
        await store.is_new_event("message.created", payload)
        # Second occurrence
        result = await store.is_new_event("message.created", payload)

        assert result is False

    @pytest.mark.asyncio
    async def test_is_new_event_expiry(self, monkeypatch):
        """Test is_new_event expires after TTL."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "messageId": "msg123",
            "userId": "user456",
            "timestamp": "1710000000"
        }

        # First occurrence
        await store.is_new_event("message.created", payload)

        # Wait for expiry (TTL is 7200 seconds = 2 hours)
        # For testing, we can't easily wait 2 hours, but we can verify the key was set with expiry
        key = store._event_key("message.created", payload)
        ttl = await fake.ttl(key)

        # TTL should be positive (not -1 which means no expiry, not -2 which means key doesn't exist)
        assert ttl > 0


class TestOnMessageCreated:
    @pytest.mark.asyncio
    async def test_on_message_created_basic(self, monkeypatch):
        """Test basic message created event processing."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "messageId": "msg123",
            "userId": "user123",
            "timestamp": "1710000000"
        }

        await store.on_message_created(payload)

        assert await fake.scard(store.active_users_key) == 1
        assert int(await fake.get(store.message_count_key)) == 1

    @pytest.mark.asyncio
    async def test_on_message_created_without_user_id(self, monkeypatch):
        """Test message created without userId."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "messageId": "msg456",
            "timestamp": "1710000001"
        }

        await store.on_message_created(payload)

        # Message count should increment
        assert int(await fake.get(store.message_count_key)) == 1
        # But active users should remain empty
        assert await fake.scard(store.active_users_key) == 0

    @pytest.mark.asyncio
    async def test_on_message_created_invalid_timestamp(self, monkeypatch):
        """Test message created with invalid timestamp uses current time."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "messageId": "msg789",
            "userId": "user123",
            "timestamp": "invalid"
        }

        await store.on_message_created(payload)

        # Should still process the event
        assert int(await fake.get(store.message_count_key)) == 1

    @pytest.mark.asyncio
    async def test_on_message_created_updates_volume_zset(self, monkeypatch):
        """Test message created updates volume zset."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "messageId": "msg999",
            "userId": "user123",
            "timestamp": "1710000000"
        }

        await store.on_message_created(payload)

        # Check that zset was updated
        points = await store.message_points()
        assert len(points) == 1

    @pytest.mark.asyncio
    async def test_on_message_created_time_bucket_rounding(self, monkeypatch):
        """Test message created rounds timestamp to minute bucket."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "messageId": "msg000",
            "userId": "user123",
            "timestamp": "1710000035"  # 35 seconds into minute
        }

        await store.on_message_created(payload)

        points = await store.message_points()
        assert len(points) == 1
        # The bucket should be rounded down to the minute
        expected_bucket = 1710000000  # Round down to minute
        assert points[0]["ts"] == str(expected_bucket)


class TestOnUserConnected:
    @pytest.mark.asyncio
    async def test_on_user_connected_basic(self, monkeypatch):
        """Test basic user connected event processing."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "userId": "user123",
            "timestamp": "1710000000"
        }

        await store.on_user_connected(payload)

        assert await fake.sismember(store.active_users_key, "user123") == 1

    @pytest.mark.asyncio
    async def test_on_user_connected_duplicate(self, monkeypatch):
        """Test user connected for same user twice."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "userId": "user456",
            "timestamp": "1710000001"
        }

        await store.on_user_connected(payload)
        await store.on_user_connected(payload)

        # Should still be only one entry (sets don't allow duplicates)
        assert await fake.scard(store.active_users_key) == 1

    @pytest.mark.asyncio
    async def test_on_user_connected_without_user_id(self, monkeypatch):
        """Test user connected without userId."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "timestamp": "1710000002"
        }

        await store.on_user_connected(payload)

        # Should not add to active users
        assert await fake.scard(store.active_users_key) == 0


class TestOnUserDisconnected:
    @pytest.mark.asyncio
    async def test_on_user_disconnected_basic(self, monkeypatch):
        """Test basic user disconnected event processing."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        # First add user to active set
        await fake.sadd(store.active_users_key, "user789")

        payload = {
            "userId": "user789",
            "timestamp": "1710000003"
        }

        await store.on_user_disconnected(payload)

        assert await fake.sismember(store.active_users_key, "user789") == 0

    @pytest.mark.asyncio
    async def test_on_user_disconnected_not_active(self, monkeypatch):
        """Test user disconnected when user not in active set."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "userId": "user999",
            "timestamp": "1710000004"
        }

        # Should not raise error
        await store.on_user_disconnected(payload)

        assert await fake.scard(store.active_users_key) == 0

    @pytest.mark.asyncio
    async def test_on_user_disconnected_without_user_id(self, monkeypatch):
        """Test user disconnected without userId."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()
        payload = {
            "timestamp": "1710000005"
        }

        # Should not raise error
        await store.on_user_disconnected(payload)


class TestActiveUserCount:
    @pytest.mark.asyncio
    async def test_active_user_count_empty(self, monkeypatch):
        """Test active user count when no users."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        count = await store.active_user_count()

        assert count == 0

    @pytest.mark.asyncio
    async def test_active_user_count_with_users(self, monkeypatch):
        """Test active user count with multiple users."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        # Add multiple users
        await fake.sadd(store.active_users_key, "user1", "user2", "user3")

        count = await store.active_user_count()

        assert count == 3

    @pytest.mark.asyncio
    async def test_active_user_count_after_disconnect(self, monkeypatch):
        """Test active user count after user disconnects."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        # Add users
        await fake.sadd(store.active_users_key, "user1", "user2")
        assert await store.active_user_count() == 2

        # Remove one user
        await fake.srem(store.active_users_key, "user1")
        assert await store.active_user_count() == 1


class TestMessagePoints:
    @pytest.mark.asyncio
    async def test_message_points_empty(self, monkeypatch):
        """Test message points when no messages."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        points = await store.message_points()

        assert points == []

    @pytest.mark.asyncio
    async def test_message_points_with_data(self, monkeypatch):
        """Test message points with message data."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        # Add some points to the zset
        await fake.zadd(store.message_volume_zset, {1710000000: 10, 1710000060: 5})

        points = await store.message_points()

        assert len(points) == 2
        # Check that we got the expected data (order may vary)
        timestamps = {p["ts"] for p in points}
        counts = {p["count"] for p in points}
        assert timestamps == {"1710000000", "1710000060"}
        assert counts == {10, 5}

    @pytest.mark.asyncio
    async def test_message_points_limit(self, monkeypatch):
        """Test message points returns only last 120 points."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        # Add more than 120 points
        for i in range(150):
            await fake.zadd(store.message_volume_zset, {i: i + 1})

        points = await store.message_points()

        # Should return at most 120 points
        assert len(points) <= 120


class TestIntegrationScenarios:
    @pytest.mark.asyncio
    async def test_user_message_lifecycle(self, monkeypatch):
        """Test complete user message lifecycle."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        # User connects
        await store.on_user_connected({"userId": "user123", "timestamp": "1710000000"})
        assert await store.active_user_count() == 1

        # User sends message
        await store.on_message_created({
            "messageId": "msg1",
            "userId": "user123",
            "timestamp": "1710000001"
        })
        assert int(await fake.get(store.message_count_key)) == 1
        assert await store.active_user_count() == 1

        # User sends another message
        await store.on_message_created({
            "messageId": "msg2",
            "userId": "user123",
            "timestamp": "1710000002"
        })
        assert int(await fake.get(store.message_count_key)) == 2

        # User disconnects
        await store.on_user_disconnected({"userId": "user123", "timestamp": "1710000003"})
        assert await store.active_user_count() == 0
        # Message count should remain
        assert int(await fake.get(store.message_count_key)) == 2

    @pytest.mark.asyncio
    async def test_multiple_users_concurrent(self, monkeypatch):
        """Test multiple users interacting concurrently."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        # Multiple users connect
        users = ["user1", "user2", "user3"]
        for i, user in enumerate(users):
            await store.on_user_connected({
                "userId": user,
                "timestamp": str(1710000000 + i)
            })

        assert await store.active_user_count() == 3

        # Each user sends messages
        for i, user in enumerate(users):
            await store.on_message_created({
                "messageId": f"msg{i}",
                "userId": user,
                "timestamp": str(1710000010 + i)
            })

        assert int(await fake.get(store.message_count_key)) == 3

        # All users disconnect
        for i, user in enumerate(users):
            await store.on_user_disconnected({
                "userId": user,
                "timestamp": str(1710000020 + i)
            })

        assert await store.active_user_count() == 0

    @pytest.mark.asyncio
    async def test_event_idempotency_across_types(self, monkeypatch):
        """Test event idempotency across different event types."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        _patch_async_redis(monkeypatch, fake)

        store = RedisMetricsStore()

        payload = {
            "messageId": "msg_dup",
            "userId": "user_dup",
            "timestamp": "1710000000"
        }

        # Process same payload as different event types
        await store.on_message_created(payload)
        await store.on_user_connected(payload)
        await store.on_user_disconnected(payload)

        # Each should be processed independently
        # Message created should increment count
        assert int(await fake.get(store.message_count_key)) == 1
        # User should not be in active set (disconnect was last)
        assert await store.active_user_count() == 0
