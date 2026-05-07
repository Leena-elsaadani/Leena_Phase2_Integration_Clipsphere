import os
import time

import pytest
import requests


GATEWAY_BASE = os.getenv("GATEWAY_BASE_URL", "http://localhost:8080")
VALID_TOKEN = os.getenv("TEST_VALID_JWT", "")
BLACKLISTED_TOKEN = os.getenv("TEST_BLACKLISTED_JWT", "")


def _up(url: str) -> bool:
    try:
        r = requests.get(url, timeout=2)
        return r.status_code < 500
    except requests.RequestException:
        return False


pytestmark = pytest.mark.skipif(
    not _up(f"{GATEWAY_BASE}/health"),
    reason="Gateway not reachable; start docker compose before running integration tests.",
)


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_auth_gateway_blacklist_flow():
    if not VALID_TOKEN or not BLACKLISTED_TOKEN:
        pytest.skip("Set TEST_VALID_JWT and TEST_BLACKLISTED_JWT for gateway auth integration flow.")

    ok = requests.get(f"{GATEWAY_BASE}/users/me", headers=_auth_headers(VALID_TOKEN), timeout=5)
    assert ok.status_code in (200, 404), ok.text

    denied = requests.get(
        f"{GATEWAY_BASE}/users/me", headers=_auth_headers(BLACKLISTED_TOKEN), timeout=5
    )
    assert denied.status_code == 401


def test_chat_to_dashboard_event_flow():
    if not VALID_TOKEN:
        pytest.skip("Set TEST_VALID_JWT for chat/dashboard integration flow.")

    create_room = requests.post(
        f"{GATEWAY_BASE}/rooms",
        headers=_auth_headers(VALID_TOKEN),
        json={"name": f"it-room-{int(time.time())}", "ownerId": "it-user"},
        timeout=8,
    )
    assert create_room.status_code in (200, 201), create_room.text
    room_id = create_room.json()["id"]

    send_msg = requests.post(
        f"{GATEWAY_BASE}/rooms/{room_id}/messages",
        headers=_auth_headers(VALID_TOKEN),
        json={"userId": "it-user", "content": "integration message"},
        timeout=8,
    )
    assert send_msg.status_code == 200, send_msg.text

    # allow RabbitMQ consumer to process and update Redis-backed dashboard state
    time.sleep(2)
    metrics = requests.get(
        f"{GATEWAY_BASE}/dashboard/message-volume", headers=_auth_headers(VALID_TOKEN), timeout=8
    )
    assert metrics.status_code == 200, metrics.text
    assert "points" in metrics.json()


def test_gateway_user_headers_and_rbac():
    if not VALID_TOKEN:
        pytest.skip("Set TEST_VALID_JWT for gateway/user integration flow.")

    me = requests.get(f"{GATEWAY_BASE}/users/me", headers=_auth_headers(VALID_TOKEN), timeout=8)
    assert me.status_code in (200, 404)

    # As a non-admin token this should normally be forbidden.
    admin_action = requests.delete(
        f"{GATEWAY_BASE}/users/some-user-id", headers=_auth_headers(VALID_TOKEN), timeout=8
    )
    assert admin_action.status_code in (401, 403)
