from __future__ import annotations

import asyncio
import json
import threading
import time

import pika
from prometheus_client import Histogram

from internal.services.redis_metrics_store import RedisMetricsStore

rabbitmq_consumer_processing_duration_seconds = Histogram(
    "rabbitmq_consumer_processing_duration_seconds",
    "Seconds spent processing each RabbitMQ consumer message",
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)


async def _dispatch_event(store: RedisMetricsStore, routing_key: str, body: bytes) -> None:
    payload = json.loads(body.decode("utf-8"))
    if "timestamp" not in payload:
        payload["timestamp"] = str(time.time())
    if routing_key == "message.created":
        await store.on_message_created(payload)
    elif routing_key == "user.connected":
        await store.on_user_connected(payload)
    elif routing_key == "user.disconnected":
        await store.on_user_disconnected(payload)


def _consume_forever() -> None:
    amqp_url = "amqp://localhost:5672"
    params = pika.URLParameters(amqp_url)
    if "RABBITMQ_URL" in __import__("os").environ:
        params = pika.URLParameters(__import__("os").environ["RABBITMQ_URL"])

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    store = RedisMetricsStore()

    while True:
        try:
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.exchange_declare(exchange="chat.events", exchange_type="topic", durable=True)
            q = channel.queue_declare(queue="dashboard.message.created", durable=True)
            channel.queue_bind(queue=q.method.queue, exchange="chat.events", routing_key="message.created")
            channel.queue_bind(queue=q.method.queue, exchange="chat.events", routing_key="user.connected")
            channel.queue_bind(queue=q.method.queue, exchange="chat.events", routing_key="user.disconnected")

            def on_message(ch, method, _properties, body):
                start = time.perf_counter()
                try:
                    loop.run_until_complete(_dispatch_event(store, method.routing_key, body))
                except Exception:
                    pass
                finally:
                    rabbitmq_consumer_processing_duration_seconds.observe(time.perf_counter() - start)
                    ch.basic_ack(delivery_tag=method.delivery_tag)

            channel.basic_qos(prefetch_count=100)
            channel.basic_consume(queue=q.method.queue, on_message_callback=on_message)
            channel.start_consuming()
        except Exception:
            time.sleep(1.0)


def start_consumer_thread() -> None:
    t = threading.Thread(target=_consume_forever, daemon=True)
    t.start()
