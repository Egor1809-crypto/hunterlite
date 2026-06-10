"""Voice-call WebSocket handler — rebuilt streaming cascade (CALL_REBUILD_TZ §4).

One WebSocket endpoint (`/ws/call`). Session state lives in memory for the
lifetime of the connection (history, persona, voice). No shared training-WS,
no emotion FSM, no VAD, no one-turn-lock — turn boundaries are push-to-talk
from the frontend; each `audio` frame is one full turn.

Per-turn flow (handle_user_turn):
  1. send a filler immediately (masks STT+LLM latency);
  2. STT the webm; junk → ask to repeat, end turn;
  3. stream the LLM, flushing each completed sentence to TTS as it lands;
  4. flush the tail; persona may hang up via «[КЛАДУ ТРУБКУ]».

On `end_call` we score the transcript (§7), persist score_total +
scoring_details to the TrainingSession, send the result, and break.

Server→client message shapes (each is `{type, data}`):
  ready          {client_name, client_card}
  filler         {audio_b64, mime:"audio/mpeg"}
  transcript     {role:"user", text}
  sentence       {index, text, audio_b64}
  turn_end       {}
  client_hangup  {text}
  score          {result:{total, rubric, verdict}}
  error          {message}
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import json
import logging
import uuid

from sqlalchemy import select
from starlette.websockets import WebSocket, WebSocketDisconnect

from app.database import async_session
from app.models.training import TrainingSession
from app.services import call_fillers
from app.services.call_pipeline import (
    build_persona_prompt,
    derive_gender,
    is_junk,
    llm_stream,
    pop_complete_sentence,
    score_call,
    stt_transcribe,
    strip_hangup_marker,
    tts_sentence,
    voice_for_gender,
    wants_hangup,
)
# Reuse the training-WS auth verbatim — same JWT/blacklist/JTI checks.
from app.ws.training import _authenticate_first_message

logger = logging.getLogger(__name__)

_AUTH_WAIT_S = 10.0
_RECV_WAIT_S = 600.0  # generous idle bound for a held-open call socket


async def _send(ws: WebSocket, t: str, d: dict) -> None:
    """Send a typed JSON frame, swallowing disconnects (mirror of training._send)."""
    try:
        await ws.send_json({"type": t, "data": d})
    except Exception:
        logger.debug("call WS send failed type=%s", t)


def _build_client_card(persona_name: str, custom_params: dict) -> dict:
    """Small inline client card for the FE 'ready' frame (persona-derived)."""
    cp = custom_params or {}
    return {
        "name": persona_name,
        "brief": str(cp.get("persona_brief") or "")[:2000],
        "emotion_preset": cp.get("emotion_preset"),
    }


async def _handle_user_turn(ws: WebSocket, state: dict, webm_bytes: bytes) -> None:
    """One conversational turn: filler → STT → streamed LLM/TTS → end (§4.2)."""
    # 1. filler IMMEDIATELY (while STT+LLM think) — from the prewarmed cache.
    filler_b64 = call_fillers.random_filler(state["gender"])
    if filler_b64:
        await _send(ws, "filler", {"audio_b64": filler_b64, "mime": "audio/mpeg"})

    # 2. STT (timeout + fallback). Junk/empty → ask to repeat, end turn.
    text = await stt_transcribe(webm_bytes)
    if not text.strip() or is_junk(text):
        repeat = "Извините, не расслышал, повторите?"
        audio = await tts_sentence(repeat, state["voice"])
        await _send(ws, "sentence", {"index": 0, "text": repeat, "audio_b64": audio})
        await _send(ws, "turn_end", {})
        return

    state["history"].append({"role": "user", "content": text})
    state["user_messages"].append(text)
    await _send(ws, "transcript", {"role": "user", "text": text})

    # 3. LLM stream=true + per-sentence TTS as boundaries land.
    buf = ""
    idx = 0
    raw_reply = ""
    async for token in llm_stream(state["history"], state["system_prompt"]):
        buf += token
        raw_reply += token
        sentence, buf = pop_complete_sentence(buf)
        if sentence:
            spoken = strip_hangup_marker(sentence)
            if spoken:
                audio = await tts_sentence(spoken, state["voice"])
                await _send(
                    ws, "sentence", {"index": idx, "text": spoken, "audio_b64": audio}
                )
                idx += 1

    # tail flush (reply without a final terminator)
    if buf.strip():
        spoken = strip_hangup_marker(buf)
        if spoken:
            audio = await tts_sentence(spoken, state["voice"])
            await _send(
                ws, "sentence", {"index": idx, "text": spoken, "audio_b64": audio}
            )
            idx += 1

    clean_reply = strip_hangup_marker(raw_reply)
    # Graceful fallback if the LLM produced nothing usable.
    if not clean_reply.strip() and idx == 0:
        fallback = "Извините, не расслышал, повторите?"
        audio = await tts_sentence(fallback, state["voice"])
        await _send(ws, "sentence", {"index": 0, "text": fallback, "audio_b64": audio})
        await _send(ws, "turn_end", {})
        return

    state["history"].append({"role": "assistant", "content": clean_reply})
    state["assistant_messages"].append(clean_reply)

    # 4. persona decided to hang up?
    if wants_hangup(raw_reply):
        await _send(ws, "client_hangup", {"text": clean_reply})
    else:
        await _send(ws, "turn_end", {})


async def _do_end_call(ws: WebSocket, state: dict) -> None:
    """Score the call, persist to the TrainingSession, send the score frame."""
    result = await score_call(
        session_id=str(state["session_id"]),
        user_messages=state["user_messages"],
        assistant_messages=state["assistant_messages"],
    )
    total = result.get("total", 0)
    scoring_details = result.get("scoring_details", {})

    # Persist score_total + scoring_details (mirror training.py column writes).
    try:
        async with async_session() as db:
            row = await db.execute(
                select(TrainingSession).where(TrainingSession.id == state["session_id"])
            )
            session = row.scalar_one_or_none()
            if session is not None:
                session.score_total = float(total)
                session.scoring_details = scoring_details
                await db.commit()
    except Exception:
        logger.exception("call: failed to persist score for session %s", state["session_id"])

    rubric = (scoring_details or {}).get("_call_rubric", [])
    verdict = ((scoring_details or {}).get("judge") or {}).get("verdict", "mixed")
    await _send(
        ws,
        "score",
        {"result": {"total": total, "rubric": rubric, "verdict": verdict}},
    )


async def call_websocket(ws: WebSocket) -> None:
    """Entry point for the `/ws/call` endpoint (registered in main.py)."""
    await ws.accept()

    # ── First-message auth (reuse training._authenticate_first_message) ──
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=_AUTH_WAIT_S)
    except (asyncio.TimeoutError, WebSocketDisconnect):
        await ws.close(code=1008)
        return

    user_id = await _authenticate_first_message(ws, raw)
    if user_id is None:
        await ws.close(code=1008)
        return
    await _send(ws, "auth.success", {})

    state: dict | None = None

    try:
        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=_RECV_WAIT_S)
            except asyncio.TimeoutError:
                logger.info("call WS idle timeout for user %s", user_id)
                break
            except WebSocketDisconnect:
                break

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send(ws, "error", {"message": "Некорректный формат сообщения."})
                continue

            mtype = msg.get("type")
            data = msg.get("data") or {}

            # ── start: load persona, build prompt, prewarm fillers, send ready ──
            if mtype == "start":
                session_id_raw = data.get("session_id")
                try:
                    session_id = uuid.UUID(str(session_id_raw))
                except (ValueError, TypeError):
                    await _send(ws, "error", {"message": "Некорректный session_id."})
                    continue

                async with async_session() as db:
                    row = await db.execute(
                        select(TrainingSession).where(TrainingSession.id == session_id)
                    )
                    session = row.scalar_one_or_none()

                if session is None or session.user_id != user_id:
                    await _send(ws, "error", {"message": "Сессия не найдена."})
                    continue

                custom_params = session.custom_params or {}
                persona_name = (
                    custom_params.get("persona_name")
                    or custom_params.get("full_name")
                    or "Клиент"
                )
                persona_brief = str(custom_params.get("persona_brief") or "")
                emotion_preset = custom_params.get("emotion_preset")

                system_prompt = build_persona_prompt(
                    custom_params, persona_name, emotion_preset
                )
                gender = derive_gender(persona_name, persona_brief)
                voice = voice_for_gender(gender)

                # Prewarm fillers for this gender (best-effort, non-fatal).
                try:
                    await call_fillers.prewarm_fillers(gender)
                except Exception:
                    logger.warning("call: filler prewarm failed", exc_info=True)

                state = {
                    "session_id": session_id,
                    "history": [],
                    "system_prompt": system_prompt,
                    "voice": voice,
                    "gender": gender,
                    "user_messages": [],
                    "assistant_messages": [],
                }

                await _send(
                    ws,
                    "ready",
                    {
                        "client_name": persona_name,
                        "client_card": _build_client_card(persona_name, custom_params),
                    },
                )
                continue

            # ── audio: one full turn (base64 webm) ──
            if mtype == "audio":
                if state is None:
                    await _send(ws, "error", {"message": "Сначала начните звонок (start)."})
                    continue
                audio_b64 = data.get("audio_b64") or ""
                try:
                    webm_bytes = base64.b64decode(audio_b64)
                except (binascii.Error, ValueError):
                    await _send(ws, "error", {"message": "Не удалось декодировать аудио."})
                    continue
                try:
                    await _handle_user_turn(ws, state, webm_bytes)
                except Exception:
                    logger.exception("call: turn handling failed")
                    await _send(ws, "error", {"message": "Ошибка обработки реплики."})
                    await _send(ws, "turn_end", {})
                continue

            # ── end_call: score, persist, send result, break ──
            if mtype == "end_call":
                if state is None:
                    await _send(ws, "error", {"message": "Звонок не начат."})
                    break
                try:
                    await _do_end_call(ws, state)
                except Exception:
                    logger.exception("call: end_call scoring failed")
                    await _send(ws, "error", {"message": "Ошибка при подсчёте оценки."})
                break

            await _send(ws, "error", {"message": f"Неизвестный тип сообщения: {mtype}"})
    except WebSocketDisconnect:
        logger.info("call WS disconnected for user %s", user_id)
    except Exception:
        logger.exception("call WS handler crashed for user %s", user_id)
    finally:
        try:
            await ws.close()
        except Exception:
            pass
