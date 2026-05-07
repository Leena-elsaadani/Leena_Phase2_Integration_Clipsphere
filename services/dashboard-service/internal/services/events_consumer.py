from __future__ import annotations

import json
import threading
import time

import pika

from internal.services.redis_metrics_store import RedisMetricsStore


def _consume_forever() -> None:
    amqp_url = "amqp://localhost:5672"
    params = pika.URLParameters(amqp_url)
    if "RABBITMQ_URL" in __import__("os").environ:
        params = pika.URLParameters(__import__("os").environ["RABBITMQ_URL"])

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
                try:
                    payload = json.loads(body.decode("utf-8"))
                    if "timestamp" not in payload:
                        payload["timestamp"] = str(time.time())
                    if method.routing_key == "message.created":
                        store.on_message_created(payload)
                    elif method.routing_key == "user.connected":
                        store.on_user_connected(payload)
                    elif method.routing_key == "user.disconnected":
                        store.on_user_disconnected(payload)
                finally:
                    ch.basic_ack(delivery_tag=method.delivery_tag)

            channel.basic_qos(prefetch_count=100)
            channel.basic_consume(queue=q.method.queue, on_message_callback=on_message)
            channel.start_consuming()
        except Exception:
            time.sleep(1.0)


def start_consumer_thread() -> None:
    t = threading.Thread(target=_consume_forever, daemon=True)
    t.start()
