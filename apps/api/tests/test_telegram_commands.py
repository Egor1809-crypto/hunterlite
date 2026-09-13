from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.telegram import bot


@pytest.mark.asyncio
async def test_buy_reports_fixed_offer_without_claiming_a_grant():
    message = SimpleNamespace(answer=AsyncMock())
    await bot.cmd_buy(message)
    text = message.answer.call_args.args[0]
    assert "10 попыток" in text and "1 499 ₽" in text
    assert "00:00 по Москве" in text
    assert "Покупка пока недоступна" in text
    assert "не начисляются" in text


@pytest.mark.asyncio
async def test_button_callback_is_acknowledged():
    message = SimpleNamespace(answer=AsyncMock())
    callback = SimpleNamespace(answer=AsyncMock(), message=message)
    await bot.daily_attempts_callback(callback)
    callback.answer.assert_awaited_once()
    message.answer.assert_awaited_once()


def test_platform_links_use_supported_browser_auth():
    button = bot._web_button("Тесты", "/training?tab=tests")
    assert button.url.endswith("/training?tab=tests")
    assert button.web_app is None


@pytest.mark.asyncio
async def test_welcome_escapes_user_supplied_html():
    message = SimpleNamespace(
        from_user=SimpleNamespace(first_name="<b>Имя</b>"), answer=AsyncMock()
    )
    await bot.cmd_start(message, SimpleNamespace(args=""))
    assert "&lt;b&gt;Имя&lt;/b&gt;" in message.answer.call_args.args[0]
