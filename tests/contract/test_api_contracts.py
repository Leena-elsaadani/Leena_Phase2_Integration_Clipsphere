import os

import pytest
import requests
from jsonschema import validate


BASE = os.getenv("CONTRACT_BASE_URL", "http://localhost:8080")
TOKEN = os.getenv("TEST_VALID_JWT", "")


def _up() -> bool:
    try:
        return requests.get(f"{BASE}/health", timeout=2).status_code == 200
    except requests.RequestException:
        return False


pytestmark = pytest.mark.skipif(not _up(), reason="Gateway unavailable for contract checks")


AUTH_VALIDATE_SCHEMA = {
    "type": "object",
    "required": ["valid", "user"],
    "properties": {"valid": {"type": "boolean"}, "user": {"type": "object"}},
}

USER_ME_SCHEMA = {"type": "object"}

USER_SEARCH_SCHEMA = {
    "type": "object",
    "required": ["users"],
    "properties": {"users": {"type": "array"}},
}

ROOMS_SCHEMA = {
    "type": "object",
    "required": ["rooms"],
    "properties": {"rooms": {"type": "array"}},
}

MESSAGES_SCHEMA = {
    "type": "object",
    "required": ["messages"],
    "properties": {"messages": {"type": "array"}},
}


def _headers():
    if not TOKEN:
        pytest.skip("Set TEST_VALID_JWT to execute protected contract checks.")
    return {"Authorization": f"Bearer {TOKEN}"}


def test_auth_service_contracts():
    login = requests.get(f"{BASE}/auth/google/login", timeout=5)
    assert login.status_code in (200, 302)

    if TOKEN:
        res = requests.get(f"{BASE}/auth/validate", headers={"Authorization": f"Bearer {TOKEN}"}, timeout=5)
        assert res.status_code in (200, 401)
        if res.status_code == 200:
            validate(instance=res.json(), schema=AUTH_VALIDATE_SCHEMA)

    logout = requests.post(f"{BASE}/auth/logout", json={}, timeout=5)
    assert logout.status_code in (200, 401)


def test_user_service_contracts():
    me = requests.get(f"{BASE}/users/me", headers=_headers(), timeout=5)
    assert me.status_code in (200, 404)
    if me.status_code == 200:
        validate(instance=me.json(), schema=USER_ME_SCHEMA)

    search = requests.get(f"{BASE}/users/search?q=test", headers=_headers(), timeout=5)
    assert search.status_code == 200
    validate(instance=search.json(), schema=USER_SEARCH_SCHEMA)


def test_chat_service_contracts():
    rooms = requests.get(f"{BASE}/rooms", headers=_headers(), timeout=5)
    assert rooms.status_code == 200
    validate(instance=rooms.json(), schema=ROOMS_SCHEMA)

    room = requests.post(f"{BASE}/rooms", headers=_headers(), json={"name": "contract-room"}, timeout=5)
    assert room.status_code in (200, 201)
    room_id = room.json().get("id")
    assert room_id

    messages = requests.get(f"{BASE}/rooms/{room_id}/messages", headers=_headers(), timeout=5)
    assert messages.status_code == 200
    validate(instance=messages.json(), schema=MESSAGES_SCHEMA)
