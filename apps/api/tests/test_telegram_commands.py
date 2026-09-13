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


@pytest.mark.asyncio
async def test_network_failure_retries_same_reply_without_rerunning_handler(monkeypatch):
    from aiogram.exceptions import TelegramNetworkError
    from aiogram.methods import SendMessage

    from app.telegram import transport

    method = SendMessage(chat_id=1, text="Аккаунт привязан")
    request = AsyncMock(side_effect=[TelegramNetworkError(method, "timeout"), "delivered"])
    monkeypatch.setattr(transport.asyncio, "sleep", AsyncMock())
    result = await transport.RetryTransientRequests()(request, None, method)
    assert result == "delivered" and request.await_count == 2
    assert all(call.args[1] is method for call in request.await_args_list)


@pytest.mark.asyncio
async def test_bot_retry_is_bounded_and_does_not_retry_permanent_errors(monkeypatch):
    from aiogram.exceptions import TelegramForbiddenError, TelegramNetworkError
    from aiogram.methods import SendMessage

    from app.telegram import transport

    method = SendMessage(chat_id=1, text="Статус")
    monkeypatch.setattr(transport.asyncio, "sleep", AsyncMock())
    request = AsyncMock(side_effect=TelegramNetworkError(method, "timeout"))
    with pytest.raises(TelegramNetworkError):
        await transport.RetryTransientRequests()(request, None, method)
    assert request.await_count == 3
    request = AsyncMock(side_effect=TelegramForbiddenError(method, "blocked"))
    with pytest.raises(TelegramForbiddenError):
        await transport.RetryTransientRequests()(request, None, method)
    assert request.await_count == 1


@pytest.mark.asyncio
async def test_polling_keeps_its_own_retry_policy():
    from aiogram.exceptions import TelegramNetworkError
    from aiogram.methods import GetUpdates

    from app.telegram.transport import RetryTransientRequests

    method = GetUpdates()
    request = AsyncMock(side_effect=TelegramNetworkError(method, "timeout"))
    with pytest.raises(TelegramNetworkError):
        await RetryTransientRequests()(request, None, method)
    assert request.await_count == 1
