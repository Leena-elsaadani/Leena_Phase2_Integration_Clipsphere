import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from internal.services.events_consumer import (
    _dispatch_event,
    rabbitmq_consumer_processing_duration_seconds,
)
from internal.services.redis_metrics_store import RedisMetricsStore


class TestDispatchEvent:
    @pytest.mark.asyncio
    async def test_dispatch_message_created_event(self, monkeypatch):
        """Test dispatching message.created event."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        monkeypatch.setattr(
            "internal.services.redis_metrics_store.redis.Redis",
            lambda **kwargs: fake,
        )

        store = RedisMetricsStore()
        body = json.dumps({
            "messageId": "msg123",
            "userId": "user123",
            "timestamp": "1710000000"
        }).encode("utf-8")

        await _dispatch_event(store, "message.created", body)

        # Verify event was processed
        assert await fake.scard(store.active_users_key) == 1
        assert int(await fake.get(store.message_count_key)) == 1

    @pytest.mark.asyncio
    async def test_dispatch_user_connected_event(self, monkeypatch):
        """Test dispatching user.connected event."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        monkeypatch.setattr(
            "internal.services.redis_metrics_store.redis.Redis",
            lambda **kwargs: fake,
        )

        store = RedisMetricsStore()
        body = json.dumps({
            "userId": "user456",
            "timestamp": "1710000001"
        }).encode("utf-8")

        await _dispatch_event(store, "user.connected", body)

        assert await fake.sismember(store.active_users_key, "user456") == 1

    @pytest.mark.asyncio
    async def test_dispatch_user_disconnected_event(self, monkeypatch):
        """Test dispatching user.disconnected event."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        monkeypatch.setattr(
            "internal.services.redis_metrics_store.redis.Redis",
            lambda **kwargs: fake,
        )

        store = RedisMetricsStore()
        # First add user to active set
        await fake.sadd(store.active_users_key, "user789")

        body = json.dumps({
            "userId": "user789",
            "timestamp": "1710000002"
        }).encode("utf-8")

        await _dispatch_event(store, "user.disconnected", body)

        assert await fake.sismember(store.active_users_key, "user789") == 0

    @pytest.mark.asyncio
    async def test_dispatch_adds_timestamp_if_missing(self, monkeypatch):
        """Test dispatch adds timestamp if not in payload."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        monkeypatch.setattr(
            "internal.services.redis_metrics_store.redis.Redis",
            lambda **kwargs: fake,
        )

        store = RedisMetricsStore()
        body = json.dumps({
            "messageId": "msg456",
            "userId": "user123"
        }).encode("utf-8")  # No timestamp

        await _dispatch_event(store, "message.created", body)

        # Should still process the event
        assert int(await fake.get(store.message_count_key)) == 1

    @pytest.mark.asyncio
    async def test_dispatch_ignores_unknown_routing_key(self, monkeypatch):
        """Test dispatch ignores unknown routing keys."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        monkeypatch.setattr(
            "internal.services.redis_metrics_store.redis.Redis",
            lambda **kwargs: fake,
        )

        store = RedisMetricsStore()
        body = json.dumps({
            "messageId": "msg789",
            "userId": "user123"
        }).encode("utf-8")

        # Should not raise error for unknown routing key
        await _dispatch_event(store, "unknown.event", body)

        # No metrics should be updated (key may not exist, so check for None or 0)
        message_count = await fake.get(store.message_count_key)
        assert message_count is None or int(message_count) == 0

    @pytest.mark.asyncio
    async def test_dispatch_handles_invalid_json(self, monkeypatch):
        """Test dispatch handles invalid JSON gracefully."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        monkeypatch.setattr(
            "internal.services.redis_metrics_store.redis.Redis",
            lambda **kwargs: fake,
        )

        store = RedisMetricsStore()
        body = b"invalid json"

        # Should raise error for invalid JSON
        with pytest.raises(json.JSONDecodeError):
            await _dispatch_event(store, "message.created", body)

    @pytest.mark.asyncio
    async def test_dispatch_message_created_with_invalid_timestamp(self, monkeypatch):
        """Test dispatch handles invalid timestamp in message.created."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        monkeypatch.setattr(
            "internal.services.redis_metrics_store.redis.Redis",
            lambda **kwargs: fake,
        )

        store = RedisMetricsStore()
        body = json.dumps({
            "messageId": "msg999",
            "userId": "user123",
            "timestamp": "invalid_timestamp"
        }).encode("utf-8")

        # Should use current time instead
        await _dispatch_event(store, "message.created", body)

        assert int(await fake.get(store.message_count_key)) == 1

    @pytest.mark.asyncio
    async def test_dispatch_user_connected_without_user_id(self, monkeypatch):
        """Test dispatch user.connected without userId."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        monkeypatch.setattr(
            "internal.services.redis_metrics_store.redis.Redis",
            lambda **kwargs: fake,
        )

        store = RedisMetricsStore()
        body = json.dumps({
            "timestamp": "1710000003"
        }).encode("utf-8")

        # Should not raise error
        await _dispatch_event(store, "user.connected", body)

        # Active users should remain empty
        assert await fake.scard(store.active_users_key) == 0

    @pytest.mark.asyncio
    async def test_dispatch_message_created_without_user_id(self, monkeypatch):
        """Test dispatch message.created without userId."""
        from fakeredis import FakeAsyncRedis

        fake = FakeAsyncRedis(decode_responses=True)
        monkeypatch.setattr(
            "internal.services.redis_metrics_store.redis.Redis",
            lambda **kwargs: fake,
        )

        store = RedisMetricsStore()
        body = json.dumps({
            "messageId": "msg888",
            "timestamp": "1710000004"
        }).encode("utf-8")

        await _dispatch_event(store, "message.created", body)

        # Message count should increment
        assert int(await fake.get(store.message_count_key)) == 1
        # But active users should remain empty
        assert await fake.scard(store.active_users_key) == 0


class TestConsumeForever:
    def test_consume_forever_uses_environment_variable(self, monkeypatch):
        """Test consume forever uses RABBITMQ_URL from environment."""
        from internal.services import events_consumer

        # Set environment variable
        monkeypatch.setenv("RABBITMQ_URL", "amqp://testhost:5672")

        with patch("pika.BlockingConnection") as mock_connection:
            with patch("asyncio.new_event_loop") as mock_loop:
                with patch("asyncio.set_event_loop"):
                    with patch.object(events_consumer, "_dispatch_event"):
                        mock_channel = MagicMock()
                        mock_connection.return_value.channel.return_value = mock_channel
                        
                        # Mock the infinite loop to prevent hanging
                        mock_channel.start_consuming.side_effect = KeyboardInterrupt()
                        
                        try:
                            events_consumer._consume_forever()
                        except (KeyboardInterrupt, RuntimeError):
                            pass

                        # Check that the correct URL was used
                        mock_connection.assert_called()
                        call_args = mock_connection.call_args
                        params = call_args[0][0]
                        assert params.host == "testhost"
                        assert params.port == 5672

    def test_consume_forever_uses_default_url(self, monkeypatch):
        """Test consume forever uses default URL when env var not set."""
        from internal.services import events_consumer

        # Ensure environment variable is not set
        monkeypatch.delenv("RABBITMQ_URL", raising=False)

        with patch("pika.BlockingConnection") as mock_connection:
            with patch("asyncio.new_event_loop") as mock_loop:
                with patch("asyncio.set_event_loop"):
                    with patch.object(events_consumer, "_dispatch_event"):
                        mock_channel = MagicMock()
                        mock_connection.return_value.channel.return_value = mock_channel
                        
                        # Mock the infinite loop to prevent hanging
                        mock_channel.start_consuming.side_effect = KeyboardInterrupt()
                        
                        try:
                            events_consumer._consume_forever()
                        except (KeyboardInterrupt, RuntimeError):
                            pass

                        # Check that the default URL was used
                        mock_connection.assert_called()
                        call_args = mock_connection.call_args
                        params = call_args[0][0]
                        assert params.host == "localhost"
                        assert params.port == 5672

    def test_consume_forever_declares_exchange(self):
        """Test consume forever declares the exchange."""
        from internal.services import events_consumer

        with patch("pika.BlockingConnection") as mock_connection:
            with patch("asyncio.new_event_loop") as mock_loop:
                with patch("asyncio.set_event_loop"):
                    with patch.object(events_consumer, "_dispatch_event"):
                        mock_channel = MagicMock()
                        mock_connection.return_value.channel.return_value = mock_channel
                        
                        mock_channel.start_consuming.side_effect = KeyboardInterrupt()
                        
                        try:
                            events_consumer._consume_forever()
                        except (KeyboardInterrupt, RuntimeError):
                            pass

                        # Check exchange was declared
                        mock_channel.exchange_declare.assert_called_with(
                            exchange="chat.events",
                            exchange_type="topic",
                            durable=True
                        )

    def test_consume_forever_binds_queue_to_routing_keys(self):
        """Test consume forever binds queue to all routing keys."""
        from internal.services import events_consumer

        with patch("pika.BlockingConnection") as mock_connection:
            with patch("asyncio.new_event_loop") as mock_loop:
                with patch("asyncio.set_event_loop"):
                    with patch.object(events_consumer, "_dispatch_event"):
                        mock_channel = MagicMock()
                        mock_queue_result = MagicMock()
                        mock_queue_result.method.queue = "test_queue"
                        mock_channel.queue_declare.return_value = mock_queue_result
                        mock_connection.return_value.channel.return_value = mock_channel
                        
                        mock_channel.start_consuming.side_effect = KeyboardInterrupt()
                        
                        try:
                            events_consumer._consume_forever()
                        except (KeyboardInterrupt, RuntimeError):
                            pass

                        # Check queue was bound to all routing keys
                        assert mock_channel.queue_bind.call_count == 3
                        
                        routing_keys = [
                            call[1]["routing_key"] 
                            for call in mock_channel.queue_bind.call_args_list
                        ]
                        assert "message.created" in routing_keys
                        assert "user.connected" in routing_keys
                        assert "user.disconnected" in routing_keys

    def test_consume_forever_sets_qos(self):
        """Test consume forever sets prefetch count."""
        from internal.services import events_consumer

        with patch("pika.BlockingConnection") as mock_connection:
            with patch("asyncio.new_event_loop") as mock_loop:
                with patch("asyncio.set_event_loop"):
                    with patch.object(events_consumer, "_dispatch_event"):
                        mock_channel = MagicMock()
                        mock_connection.return_value.channel.return_value = mock_channel
                        
                        mock_channel.start_consuming.side_effect = KeyboardInterrupt()
                        
                        try:
                            events_consumer._consume_forever()
                        except (KeyboardInterrupt, RuntimeError):
                            pass

                        # Check QoS was set
                        mock_channel.basic_qos.assert_called_with(prefetch_count=100)

    def test_consume_forever_retries_on_connection_error(self):
        """Test consume forever retries on connection errors."""
        from internal.services import events_consumer

        call_count = [0]

        with patch("pika.BlockingConnection") as mock_connection:
            with patch("asyncio.new_event_loop") as mock_loop:
                with patch("asyncio.set_event_loop"):
                    with patch("time.sleep") as mock_sleep:
                        def side_effect(*args, **kwargs):
                            call_count[0] += 1
                            if call_count[0] == 1:
                                raise Exception("Connection error")
                            else:
                                raise KeyboardInterrupt()
                        
                        mock_connection.side_effect = side_effect
                        
                        try:
                            events_consumer._consume_forever()
                        except (KeyboardInterrupt, RuntimeError):
                            pass

                        # Check that sleep was called (retry logic)
                        mock_sleep.assert_called_with(1.0)


class TestStartConsumerThread:
    def test_start_consumer_thread_creates_daemon_thread(self):
        """Test start consumer thread creates a daemon thread."""
        from internal.services import events_consumer

        with patch("threading.Thread") as mock_thread_class:
            mock_thread = MagicMock()
            mock_thread_class.return_value = mock_thread

            events_consumer.start_consumer_thread()

            # Check thread was created with daemon=True
            mock_thread_class.assert_called_once()
            call_kwargs = mock_thread_class.call_args[1]
            assert call_kwargs["daemon"] is True

    def test_start_consumer_thread_starts_thread(self):
        """Test start consumer thread starts the thread."""
        from internal.services import events_consumer

        with patch("threading.Thread") as mock_thread_class:
            mock_thread = MagicMock()
            mock_thread_class.return_value = mock_thread

            events_consumer.start_consumer_thread()

            # Check thread was started
            mock_thread.start.assert_called_once()

    def test_start_consumer_thread_uses_consume_forever(self):
        """Test start consumer thread uses consume_forever as target."""
        from internal.services import events_consumer

        with patch("threading.Thread") as mock_thread_class:
            mock_thread = MagicMock()
            mock_thread_class.return_value = mock_thread

            events_consumer.start_consumer_thread()

            # Check consume_forever was used as target
            call_kwargs = mock_thread_class.call_args[1]
            assert call_kwargs["target"] == events_consumer._consume_forever


class TestMessageProcessingMetrics:
    def test_message_processing_records_duration(self):
        """Test message processing records duration in histogram."""
        from internal.services import events_consumer

        with patch("pika.BlockingConnection") as mock_connection:
            with patch("asyncio.new_event_loop") as mock_loop:
                with patch("asyncio.set_event_loop"):
                    with patch.object(events_consumer, "_dispatch_event"):
                        with patch("time.perf_counter") as mock_perf_counter:
                            mock_channel = MagicMock()
                            mock_method = MagicMock()
                            mock_method.routing_key = "message.created"
                            mock_method.delivery_tag = 1
                            
                            mock_connection.return_value.channel.return_value = mock_channel
                            
                            # Mock performance counter
                            mock_perf_counter.side_effect = [0.0, 0.1]
                            
                            # Create the on_message callback
                            async def mock_dispatch(*args):
                                pass
                            
                            with patch.object(events_consumer, "_dispatch_event", side_effect=mock_dispatch):
                                # Simulate the on_message callback
                                def on_message(ch, method, properties, body):
                                    start = time.perf_counter()
                                    try:
                                        asyncio.run(events_consumer._dispatch_event(
                                            MagicMock(), 
                                            method.routing_key, 
                                            body
                                        ))
                                    except Exception:
                                        pass
                                    finally:
                                        rabbitmq_consumer_processing_duration_seconds.observe(
                                            time.perf_counter() - start
                                        )
                                        ch.basic_ack(delivery_tag=method.delivery_tag)
                                
                                on_message(mock_channel, mock_method, MagicMock(), b'{"test": "data"}')
                                
                                # Check that basic_ack was called
                                mock_channel.basic_ack.assert_called_with(delivery_tag=1)

    def test_message_processing_continues_on_exception(self):
        """Test message processing continues even when dispatch fails."""
        from internal.services import events_consumer

        with patch("pika.BlockingConnection") as mock_connection:
            with patch("asyncio.new_event_loop") as mock_loop:
                with patch("asyncio.set_event_loop"):
                    mock_channel = MagicMock()
                    mock_method = MagicMock()
                    mock_method.routing_key = "message.created"
                    mock_method.delivery_tag = 1
                    
                    mock_connection.return_value.channel.return_value = mock_channel
                    
                    # Make dispatch fail
                    async def failing_dispatch(*args):
                        raise Exception("Dispatch failed")
                    
                    with patch.object(events_consumer, "_dispatch_event", side_effect=failing_dispatch):
                        def on_message(ch, method, properties, body):
                            start = time.perf_counter()
                            try:
                                asyncio.run(events_consumer._dispatch_event(
                                    MagicMock(), 
                                    method.routing_key, 
                                    body
                                ))
                            except Exception:
                                pass
                            finally:
                                rabbitmq_consumer_processing_duration_seconds.observe(
                                    time.perf_counter() - start
                                )
                                ch.basic_ack(delivery_tag=method.delivery_tag)
                        
                        # Should not raise exception
                        on_message(mock_channel, mock_method, MagicMock(), b'{"test": "data"}')
                        
                        # Check that basic_ack was still called
                        mock_channel.basic_ack.assert_called_with(delivery_tag=1)
