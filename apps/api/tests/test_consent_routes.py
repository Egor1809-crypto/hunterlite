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
