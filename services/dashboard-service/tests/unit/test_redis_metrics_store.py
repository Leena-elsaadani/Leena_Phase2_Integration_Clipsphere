import fakeredis

from internal.services.redis_metrics_store import RedisMetricsStore


def make_store(monkeypatch):
    fake_client = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr("redis.Redis", lambda *args, **kwargs: fake_client)
    return RedisMetricsStore(), fake_client


def test_message_created_updates_metrics(monkeypatch):
    store, client = make_store(monkeypatch)
    payload = {"messageId": "m1", "userId": "u1", "timestamp": "1710000000"}
    store.on_message_created(payload)

    assert client.scard(store.active_users_key) == 1
    assert int(client.get(store.message_count_key)) == 1
    points = store.message_points()
    assert len(points) == 1
    assert points[0]["count"] == 1


def test_user_connected_event_processed(monkeypatch):
    store, client = make_store(monkeypatch)
    store.on_user_connected({"userId": "u2", "timestamp": "1710000001"})
    assert client.sismember(store.active_users_key, "u2") == 1


def test_event_idempotency(monkeypatch):
    store, client = make_store(monkeypatch)
    payload = {"messageId": "same", "userId": "u1", "timestamp": "1710000100"}
    store.on_message_created(payload)
    store.on_message_created(payload)
    assert int(client.get(store.message_count_key)) == 1
