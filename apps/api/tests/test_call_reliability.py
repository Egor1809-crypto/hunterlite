"""User-visible regressions: interruptibility, honest errors, and audio formats."""

import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import call_pipeline as pipeline
from app.ws import call


@pytest.mark.asyncio
async def test_failed_judge_is_unavailable_not_zero(monkeypatch):
    monkeypatch.setattr(pipeline, "_judge_criterion", AsyncMock(return_value=(None, "Unavailable")))
    result = await pipeline.score_call(
        session_id="test", user_messages=["Первый вопрос", "Второй вопрос"], assistant_messages=[]
    )
    assert result["total"] is None
    assert result["scoring_details"]["_scoring_unavailable"] is True
    assert not result["scoring_details"].get("judge", {}).get("red_flags")


@pytest.mark.asyncio
async def test_stt_provider_error_is_not_reported_as_silence(monkeypatch):
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.post.side_effect = RuntimeError("provider failed")
    monkeypatch.setattr(pipeline.httpx, "AsyncClient", lambda **kw: client)
    with pytest.raises(Exception, match="распознав"):
        await pipeline.stt_transcribe(b"audio")


@pytest.mark.asyncio
async def test_mp4_reaches_stt_as_mp4(monkeypatch):
    response = MagicMock()
    response.json.return_value = {"text": "Здравствуйте"}
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.post.return_value = response
    monkeypatch.setattr(pipeline.httpx, "AsyncClient", lambda **kw: client)
    assert await pipeline.stt_transcribe(b"audio", mime="audio/mp4") == "Здравствуйте"
    file = client.post.call_args.kwargs["files"]["file"]
    assert file[0].endswith(".mp4")
    assert file[2] == "audio/mp4"


@pytest.mark.asyncio
async def test_ping_and_end_call_do_not_wait_for_slow_answer(monkeypatch):
    uid, sid = uuid.uuid4(), uuid.uuid4()
    session = SimpleNamespace(
        id=sid, user_id=uid, custom_params={}, scoring_details={}, status="active", mode="call"
    )
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = session
    result.scalars.return_value.all.return_value = []
    db.execute.return_value = result

    @asynccontextmanager
    async def database():
        yield db

    monkeypatch.setattr(call, "async_session", database)
    monkeypatch.setattr(call, "_authenticate_first_message", AsyncMock(return_value=uid))
    entered, cancelled, pong = asyncio.Event(), asyncio.Event(), asyncio.Event()

    async def slow(*args, **kwargs):
        entered.set()
        try:
            await asyncio.Future()
        finally:
            cancelled.set()

    monkeypatch.setattr(call, "_handle_user_turn", slow)
    monkeypatch.setattr(call, "_do_end_call", AsyncMock())
    monkeypatch.setattr(call, "_acquire_session_lock", AsyncMock(return_value=True))
    monkeypatch.setattr(call, "_refresh_session_lock", AsyncMock(return_value=True))
    monkeypatch.setattr(call, "_release_session_lock", AsyncMock())

    class Socket:
        def __init__(self):
            self.incoming = asyncio.Queue()
            self.sent = []

        async def accept(self):
            pass

        async def close(self, **kw):
            pass

        async def receive_text(self):
            return await self.incoming.get()

        async def send_json(self, data):
            self.sent.append(data)
            if data["type"] == "pong":
                pong.set()

        async def put(self, type, data=None):
            await self.incoming.put(json.dumps({"type": type, "data": data or {}}))

    ws = Socket()
    await ws.put("auth")
    await ws.put("start", {"session_id": str(sid)})
    await ws.put("audio", {"audio_b64": "YXVkaW8=", "turn_id": 1})
    task = asyncio.create_task(call.call_websocket(ws))
    try:
        await asyncio.wait_for(entered.wait(), 1)
        await ws.put("ping")
        await asyncio.wait_for(pong.wait(), 0.3)
        await ws.put("end_call")
        await asyncio.wait_for(task, 1)
        assert cancelled.is_set()
        call._do_end_call.assert_awaited_once()
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)


@pytest.mark.asyncio
async def test_failed_model_falls_back_only_before_first_token(monkeypatch):
    import httpx

    original = httpx.AsyncClient
    seen = []

    def respond(request):
        model = json.loads(request.content)["model"]
        seen.append(model)
        if model == "failed-primary":
            return httpx.Response(500, json={"error": "Unavailable"})
        return httpx.Response(
            200,
            text='data: {"choices":[{"delta":{"content":"Здравствуйте."}}]}\n\ndata: [DONE]\n\n',
        )

    monkeypatch.setattr(pipeline.settings, "call_llm_model", "failed-primary")
    monkeypatch.setattr(pipeline.settings, "local_llm_persona_model", "fallback")
    monkeypatch.setattr(
        pipeline.httpx,
        "AsyncClient",
        lambda **kw: original(transport=httpx.MockTransport(respond), **kw),
    )
    output = [part async for part in pipeline.llm_stream([], "Test persona")]
    assert output == ["Здравствуйте."]
    assert seen == ["failed-primary", "fallback"]


@pytest.mark.asyncio
async def test_malformed_judge_result_is_unavailable_not_zero(monkeypatch):
    monkeypatch.setattr(pipeline, "_judge_invoke", AsyncMock(return_value="{}"))
    score, reason = await pipeline._judge_criterion("Тест", "binary", "Менеджер: Здравствуйте")
    assert score is None and reason
