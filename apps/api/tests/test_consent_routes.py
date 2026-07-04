"""Regression: the 152-ФЗ consent router must be mounted.

consent.py defined GET /consent/status and POST /consent/ and the
``check_consent_accepted`` dependency gated training-start — but the router was
never included in api_router, so both endpoints 404'd. A non-demo user could
never accept consent and was stuck at a 403 on training-start. This guards the
mount so it can't silently regress.
"""
from app.main import app


def _paths() -> set[str]:
    return {getattr(r, "path", "") for r in app.routes}


def test_consent_endpoints_are_mounted():
    paths = _paths()
    assert "/api/consent/status" in paths, "GET /api/consent/status not registered"
    assert "/api/consent/" in paths, "POST /api/consent/ not registered"


def test_consent_status_requires_auth():
    """The status endpoint exists (not 404) and is auth-gated (401/403)."""
    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        r = client.get("/api/consent/status")
        assert r.status_code != 404, "consent status route missing"
        assert r.status_code in (401, 403), f"expected auth gate, got {r.status_code}"


# ── 152-ФЗ: согласие ФИКСИРУЕТСЯ при регистрации ──────────────────────────────
# Инвариант (2026-06-19): /auth/register должен создавать запись UserConsent
# (personal_data_processing) с меткой согласия. Раньше чекбокс был только на
# клиенте и в БД ничего не писалось — не было доказательства согласия, и юзер
# ещё раз проходил ConsentGate. Тест ловит регресс к «клиентскому-только» согласию.

import pytest


@pytest.mark.asyncio
async def test_register_persists_consent(client):
    r = await client.post("/api/auth/register", json={
        "email": "consent-new@corp.example",
        "password": "Str0ng!Passw0rd",
        "full_name": "Иван Тестов",
        "consent_accepted": True,
        "marketing_accepted": False,
    })
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    # Если согласие записано при регистрации — status должен быть all_accepted=True
    # СРАЗУ, без прохождения ConsentGate.
    s = await client.get("/api/consent/status", headers={"Authorization": f"Bearer {token}"})
    assert s.status_code == 200, s.text
    body = s.json()
    assert body["all_accepted"] is True, f"consent not recorded at registration: {body}"


@pytest.mark.asyncio
async def test_register_rejects_without_consent(client):
    """Согласие проверяется на СЕРВЕРЕ: без него регистрация — 400, а не 201."""
    r = await client.post("/api/auth/register", json={
        "email": "noconsent@corp.example",
        "password": "Str0ng!Passw0rd",
        "full_name": "Без Согласия",
        "consent_accepted": False,
    })
    assert r.status_code == 400, r.text
