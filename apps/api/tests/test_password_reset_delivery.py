from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.api.auth import ForgotPasswordRequest, _send_reset_email, forgot_password


@pytest.mark.asyncio
async def test_unconfigured_mail_rejects_without_looking_up_account():
    db = AsyncMock()
    with patch("app.api.auth.settings", SimpleNamespace(smtp_configured=False)):
        for email in ("known@example.com", "unknown@example.com"):
            with pytest.raises(HTTPException) as error:
                await forgot_password.__wrapped__(SimpleNamespace(), ForgotPasswordRequest(email=email), db)
            assert error.value.status_code == 503
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_no_reset_secret_is_logged_without_mail(caplog):
    with patch("app.api.auth.settings", SimpleNamespace(smtp_configured=False)):
        assert not await _send_reset_email("person@example.com", "User", "https://legalhunter.pro/reset-password?token=secret-value")
    assert "secret-value" not in caplog.text


@pytest.mark.asyncio
async def test_smtp_failure_is_not_success_or_a_logged_token(caplog):
    settings = SimpleNamespace(smtp_configured=True, smtp_host="smtp.example.com", smtp_port=465,
        smtp_user="sender@example.com", smtp_password="fake-test-value", smtp_from_name="LegalHunter", smtp_use_tls=True)
    with patch("app.api.auth.settings", settings), patch("aiosmtplib.send", AsyncMock(side_effect=RuntimeError("token=secret-value"))):
        assert not await _send_reset_email("person@example.com", "User", "https://legalhunter.pro/reset-password?token=secret-value")
    assert "secret-value" not in caplog.text
