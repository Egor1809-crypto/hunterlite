"""A declared client disconnect must close input before scoring finishes."""
import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest

from app.ws import training


@pytest.mark.asyncio
async def test_disconnect_blocks_parallel_input_while_canonical_finalizer_is_pending(monkeypatch):
    state = {"session_id": uuid.uuid4(), "active": True}
    ws = object()
    emitted = []
    finalizing = asyncio.Event()
    release = asyncio.Event()

    async def send(_ws, kind, data):
        emitted.append((kind, data))

    async def finalize(_ws, data, current):
        assert current["call_outcome"] == "hangup"
        finalizing.set()
        await release.wait()
        current["active"] = False
        await send(_ws, "session.ended", {"status": "completed"})

    activity = AsyncMock()
    finalizer = AsyncMock(side_effect=finalize)
    monkeypatch.setattr(training, "_send", send)
    monkeypatch.setattr(training, "_handle_session_end", finalizer)
    monkeypatch.setattr(training, "update_activity", activity)
    task = asyncio.create_task(training._finish_ai_hangup(ws, state, "До свидания.", "cold"))
    await finalizing.wait()
    try:
        await asyncio.gather(
            training._handle_text_message(ws, {"content": "Алло, вы тут?"}, state),
            training._handle_audio_chunk(ws, {"audio": "ignored"}, state),
            training._handle_audio_end(ws, {}, state),
        )
        assert emitted[0][0] == "client.hangup"
        assert emitted[0][1]["call_can_continue"] is False
        errors = [data["code"] for kind, data in emitted if kind == "error"]
        assert errors == ["session_completed"] * 3
        activity.assert_not_awaited()
    finally:
        release.set()
        await task
    finalizer.assert_awaited_once()
    assert emitted[-1][0] == "session.ended"
    assert state["_should_stop"] is True
