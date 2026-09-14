import asyncio
import base64
import io
import wave
from unittest.mock import AsyncMock

import pytest

from app.services import live_transcription as live
from app.services.client_identity import CATALOG, client_identity


def frame(sequence=1, turn=1):
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x01\x00" * 16000)
    return {
        "turn_id": turn,
        "sequence": sequence,
        "audio_b64": base64.b64encode(out.getvalue()).decode(),
    }


@pytest.mark.asyncio
async def test_captions_arrive_before_final_audio(monkeypatch):
    monkeypatch.setattr(live, "stt_transcribe", AsyncMock(return_value="Какая сумма долга?"))
    send = AsyncMock()
    captions = live.LiveTranscription(send)
    captions.offer(frame(), 0)
    await captions.task
    assert send.call_args.args[0] == {
        "type": "transcript_partial",
        "data": {"turn_id": 1, "sequence": 1, "text": "Какая сумма долга?"},
    }
    assert live.stt_transcribe.call_args.kwargs["mime"] == "audio/wav"


@pytest.mark.asyncio
async def test_fast_snapshots_skip_stale_requests(monkeypatch):
    clock = [0.0]
    monkeypatch.setattr(live.time, "monotonic", lambda: clock[0])
    entered, release = asyncio.Event(), asyncio.Event()
    count = 0

    async def stt(*args, **kw):
        nonlocal count
        count += 1
        if count == 1:
            entered.set()
            await release.wait()
        return "Распознанная речь"

    monkeypatch.setattr(live, "stt_transcribe", stt)
    send = AsyncMock()
    captions = live.LiveTranscription(send)
    captions.offer(frame(1), 0)
    await entered.wait()
    for seq in range(2, 9):
        clock[0] += 1.5
        captions.offer(frame(seq), 0)
    release.set()
    await captions.task
    assert count == 2
    assert [c.args[0]["data"]["sequence"] for c in send.call_args_list] == [1, 8]


@pytest.mark.asyncio
async def test_interrupt_cancels_captions_and_completed_turn_rejects_preview(monkeypatch):
    entered = asyncio.Event()

    async def stt(*args, **kw):
        entered.set()
        await asyncio.Future()

    monkeypatch.setattr(live, "stt_transcribe", stt)
    send = AsyncMock()
    captions = live.LiveTranscription(send)
    captions.offer(frame(), 0)
    await entered.wait()
    await asyncio.wait_for(captions.cancel(), 0.3)
    send.assert_not_called()
    assert captions.pending is None
    captions.offer(frame(sequence=2), 1)
    assert captions.task is None


@pytest.mark.asyncio
async def test_bad_or_out_of_order_audio_does_not_reach_provider(monkeypatch):
    stt = AsyncMock(return_value="Речь")
    monkeypatch.setattr(live, "stt_transcribe", stt)
    captions = live.LiveTranscription(AsyncMock())
    captions.offer({"turn_id": 1, "sequence": 1, "audio_b64": "invalid"}, 0)
    captions.offer(frame(turn=True), 0)
    assert captions.task is None
    captions.offer(frame(sequence=3), 0)
    await captions.task
    captions.offer(frame(sequence=2), 0)
    stt.assert_awaited_once()


@pytest.mark.asyncio
async def test_preview_outage_is_not_fake_text(monkeypatch):
    monkeypatch.setattr(live, "stt_transcribe", AsyncMock(side_effect=RuntimeError("offline")))
    send = AsyncMock()
    captions = live.LiveTranscription(send)
    captions.offer(frame(), 0)
    await captions.task
    assert send.call_args.args[0]["type"] == "transcript_partial_unavailable"


def test_catalog_has_stable_age_appropriate_identities():
    assert len(CATALOG) == 25
    assert client_identity("ref-galina-morozova")["age"] == 68
    assert client_identity("ref-galina-morozova")["gender"] == "female"
    assert client_identity(name="Олег Соколов")["age"] == 47
    assert client_identity(name="Неизвестный клиент")["portrait_url"] is None
    assert len({client_identity(slug)["portrait_url"] for slug in CATALOG}) == 25


@pytest.mark.asyncio
async def test_final_audio_cancels_slow_preview_without_delaying_answer(monkeypatch):
    """Exercise the actual socket dispatcher, not only the caption queue."""
    import json
    import uuid
    from contextlib import asynccontextmanager
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from app.ws import call

    uid, sid = uuid.uuid4(), uuid.uuid4()
    session = SimpleNamespace(
        id=sid, user_id=uid, custom_params={}, scoring_details={}, status="active", mode="call"
    )
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = session
    db.execute.return_value = result

    @asynccontextmanager
    async def database():
        yield db

    monkeypatch.setattr(call, "async_session", database)
    monkeypatch.setattr(call, "_authenticate_first_message", AsyncMock(return_value=uid))
    for name in ("_acquire_session_lock", "_refresh_session_lock", "_release_session_lock"):
        monkeypatch.setattr(call, name, AsyncMock(return_value=True))
    monkeypatch.setattr(call, "_do_end_call", AsyncMock())
    started, cancelled, answered = asyncio.Event(), asyncio.Event(), asyncio.Event()

    async def slow_preview(*args, **kwargs):
        started.set()
        try:
            await asyncio.Future()
        finally:
            cancelled.set()

    async def answer(socket, state, audio, mime):
        assert cancelled.is_set()
        assert state["history"] == []  # provisional text must never grade as speech
        await socket.send_json({"type": "transcript", "data": {"text": "Финальная реплика"}})
        answered.set()

    monkeypatch.setattr(live, "stt_transcribe", slow_preview)
    monkeypatch.setattr(call, "_handle_user_turn", answer)

    class Socket:
        def __init__(self):
            self.incoming, self.sent = asyncio.Queue(), []

        async def accept(self):
            pass

        async def close(self, **kwargs):
            pass

        async def receive_text(self):
            return await self.incoming.get()

        async def send_json(self, message):
            self.sent.append(message)

        async def put(self, kind, data=None):
            await self.incoming.put(json.dumps({"type": kind, "data": data or {}}))

    ws = Socket()
    await ws.put("auth")
    await ws.put("start", {"session_id": str(sid)})
    await ws.put("audio_preview", frame())
    task = asyncio.create_task(call.call_websocket(ws))
    try:
        await asyncio.wait_for(started.wait(), 1)
        await ws.put("audio", {"audio_b64": "YXVkaW8=", "turn_id": 1})
        await asyncio.wait_for(answered.wait(), 0.5)
        await ws.put("end_call")
        await asyncio.wait_for(task, 1)
        assert not any(m["type"].startswith("transcript_partial") for m in ws.sent)
        assert any(m["type"] == "transcript" for m in ws.sent)
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
