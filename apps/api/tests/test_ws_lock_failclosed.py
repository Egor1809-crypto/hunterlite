"""Регресс BUG-4: WS session-lock — fail-CLOSED (с грейсом), не fail-open.

До фикса ``_refresh_session_lock`` при недоступном Redis возвращал ``True``
(«держим замок вслепую»). Под сбоем Redis два параллельных коннекта на одну
сессию оба «держали» замок → могли писать дубли assistant-реплик. Теперь при
Redis-ошибке возвращается ``None``; вызывающий переживает короткий флап
(``_LOCK_ERROR_GRACE`` heartbeat'ов), затем fail-closed (``session.lock_error``
+ выход из цикла → снятие замка и закрытие WS).
"""
import asyncio
import inspect
import uuid

import pytest


class _BrokenRedis:
    async def eval(self, *args, **kwargs):
        raise ConnectionError("redis down")


@pytest.mark.asyncio
async def test_refresh_returns_none_on_redis_error(monkeypatch):
    from app.ws import training
    monkeypatch.setattr("app.core.redis_pool.get_redis", lambda: _BrokenRedis())
    result = await training._refresh_session_lock(uuid.uuid4(), "ws-1")
    assert result is None, "Redis-ошибка не должна fail-open (True) — это BUG-4"


@pytest.mark.asyncio
async def test_parallel_refresh_redis_down_neither_holds_blindly(monkeypatch):
    # §4.1: настоящая гонка через asyncio.gather, а не последовательные await.
    from app.ws import training
    monkeypatch.setattr("app.core.redis_pool.get_redis", lambda: _BrokenRedis())
    sid = uuid.uuid4()
    results = await asyncio.gather(
        training._refresh_session_lock(sid, "ws-1"),
        training._refresh_session_lock(sid, "ws-2"),
    )
    # Ни один коннект не «держит» замок вслепую (оба None, не True) → под сбоем
    # Redis нет двух одновременных владельцев, пишущих дубли.
    assert results == [None, None]


def test_caller_has_grace_and_fail_closed():
    from app.ws import training
    src = inspect.getsource(training)
    assert "_LOCK_ERROR_GRACE" in src, "нет грейс-порога — фикс не завершён"
    assert "session.lock_error" in src, "нет fail-closed уведомления клиента"
    assert "_lock_redis_errors" in src, "нет счётчика подряд-ошибок для грейса"
