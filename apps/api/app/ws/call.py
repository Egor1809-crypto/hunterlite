"""Push-to-talk calls: cancellable turns, durable history and streamed TTS.

The receive loop remains free for heartbeat, interruption and hangup.
Every turn response carries its ID; reconnecting restores saved history.
Provider outages are surfaced explicitly and never graded as wrong answers.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import json
import logging
import time
import uuid

from sqlalchemy import select
from starlette.websockets import WebSocket, WebSocketDisconnect

from app.database import async_session
from app.models.training import Message, MessageRole, TrainingSession
from app.services.call_pipeline import (
    CallProviderError,
    build_persona_prompt,
    derive_gender,
    is_junk,
    llm_stream,
    pop_complete_sentence,
    score_call,
    strip_hangup_marker,
    stt_transcribe,
    tts_sentence,
    voice_for_gender,
    wants_hangup,
)

# Reuse the training-WS auth verbatim — same JWT/blacklist/JTI checks.
from app.ws.training import (
    _acquire_session_lock,
    _authenticate_first_message,
    _refresh_session_lock,
    _release_session_lock,
)

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


class _TurnSocket:
    """Attach a turn ID to every reply so the client can discard obsolete audio."""

    def __init__(self, ws, turn_id, state):
        self.ws, self.turn_id, self.state = ws, turn_id, state

    async def send_json(self, frame):
        if not await _refresh_session_lock(self.state["session_id"], self.state["ws_id"]):
            raise asyncio.CancelledError()
        await self.ws.send_json(
            {**frame, "data": {**frame.get("data", {}), "turn_id": self.turn_id}}
        )


async def _save_history(state: dict) -> None:
    if state.get("ws_id") and not await _refresh_session_lock(state["session_id"], state["ws_id"]):
        return
    async with async_session() as db:
        row = await db.execute(
            select(TrainingSession)
            .where(TrainingSession.id == state["session_id"])
            .with_for_update()
        )
        session = row.scalar_one_or_none()
        if (
            session is not None
            and str(getattr(session.status, "value", session.status)) == "active"
        ):
            previous = (session.scoring_details or {}).get("_call_history", [])
            history = list(state["history"])
            if history[: len(previous)] != previous:
                raise CallProviderError(
                    "Разговор продолжен в другой вкладке. Перезагрузите страницу."
                )
            for index, item in enumerate(history[len(previous) :], start=len(previous)):
                db.add(
                    Message(
                        id=uuid.uuid5(state["session_id"], f"call:{index}"),
                        session_id=state["session_id"],
                        role=MessageRole(item["role"]),
                        content=item["content"],
                        sequence_number=index + 1,
                    )
                )
            session.scoring_details = {**(session.scoring_details or {}), "_call_history": history}
            await db.commit()


async def _handle_user_turn(
    ws: WebSocket, state: dict, webm_bytes: bytes, mime: str = "audio/webm"
) -> None:
    """Cancellable turn with bounded streaming synthesis and honest error states."""
    started = time.monotonic()
    reply_parts: list[str] = []
    try:
        async with asyncio.timeout(40):
            text = await stt_transcribe(webm_bytes, mime=mime)
            logger.info(
                "call latency session=%s stage=stt ms=%d",
                state["session_id"],
                (time.monotonic() - started) * 1000,
            )
            if not text.strip() or is_junk(text):
                await _send(
                    ws,
                    "error",
                    {
                        "code": "speech_not_detected",
                        "message": (
                            "Не удалось разобрать речь. "
                            "Поднесите микрофон ближе и повторите реплику."
                        ),
                    },
                )
                await _send(ws, "turn_end", {})
                return
            state["history"].append({"role": "user", "content": text})
            state["user_messages"].append(text)
            await _send(ws, "transcript", {"role": "user", "text": text})
            # Persist the user's words before an unreliable provider call.
            await _save_history(state)
            queue: asyncio.Queue = asyncio.Queue(maxsize=3)
            raw_reply = ""

            async def produce():
                nonlocal raw_reply
                buf = ""
                async for token in llm_stream(state["history"], state["system_prompt"]):
                    raw_reply += token
                    buf += token
                    while True:
                        sentence, rest = pop_complete_sentence(buf)
                        if not sentence:
                            break
                        buf = rest
                        spoken = strip_hangup_marker(sentence)
                        if spoken:
                            await queue.put(spoken)
                tail = strip_hangup_marker(buf).strip()
                if tail:
                    await queue.put(tail)
                await queue.put(None)

            producer = asyncio.create_task(produce())
            idx = 0
            try:
                while True:
                    # Race queue retrieval against provider failure: no blocked
                    # consumer when the stream dies without sending a sentinel.
                    item = asyncio.create_task(queue.get())
                    try:
                        done, _ = await asyncio.wait(
                            {item, producer}, return_when=asyncio.FIRST_COMPLETED
                        )
                        if producer in done and producer.exception() is not None:
                            await producer
                        spoken = await item
                    finally:
                        if not item.done():
                            item.cancel()
                            await asyncio.gather(item, return_exceptions=True)
                    if spoken is None:
                        break
                    audio = await tts_sentence(spoken, state["voice"])
                    reply_parts.append(spoken)
                    await _send(ws, "sentence", {"index": idx, "text": spoken, "audio_b64": audio})
                    if not audio:
                        await _send(
                            ws,
                            "error",
                            {
                                "code": "audio_unavailable",
                                "message": "Озвучка недоступна. Ответ клиента показан текстом.",
                            },
                        )
                    idx += 1
                await producer
            finally:
                if not producer.done():
                    producer.cancel()
                await asyncio.gather(producer, return_exceptions=True)
            if not reply_parts:
                raise CallProviderError(
                    "Сервис ИИ вернул пустой ответ. Попробуйте продолжить разговор."
                )
            if wants_hangup(raw_reply):
                state["call_outcome"] = "hangup"
                await _send(ws, "client_hangup", {"text": " ".join(reply_parts)})
    except TimeoutError:
        await _send(
            ws,
            "error",
            {
                "code": "turn_timeout",
                "message": (
                    "Ответ занял слишком много времени. Продолжите разговор или завершите звонок."
                ),
            },
        )
    except CallProviderError as exc:
        await _send(ws, "error", {"code": "provider_unavailable", "message": str(exc)})
    finally:
        if reply_parts:
            reply = " ".join(reply_parts)
            state["history"].append({"role": "assistant", "content": reply})
            state["assistant_messages"].append(reply)
        try:
            await _save_history(state)
        except Exception:
            logger.exception("call: failed to save transcript session=%s", state["session_id"])
        logger.info(
            "call latency session=%s stage=turn ms=%d",
            state["session_id"],
            (time.monotonic() - started) * 1000,
        )
    await _send(ws, "turn_end", {})


async def _do_end_call(ws: WebSocket, state: dict) -> None:
    """Score the call, persist to the TrainingSession, send the score frame."""
    result = await score_call(
        session_id=str(state["session_id"]),
        user_messages=state["user_messages"],
        assistant_messages=state["assistant_messages"],
        history=state["history"],
    )
    total = result.get("total")
    scoring_details = result.get("scoring_details", {})

    # Persist score_total + scoring_details (mirror training.py column writes).
    try:
        async with async_session() as db:
            row = await db.execute(
                select(TrainingSession)
                .where(TrainingSession.id == state["session_id"])
                .with_for_update()
            )
            session = row.scalar_one_or_none()
            if (
                session is not None
                and str(getattr(session.status, "value", session.status)) == "active"
            ):
                session.score_total = float(total) if total is not None else None
                session.scoring_details = {
                    **scoring_details,
                    "_call_history": list(state["history"]),
                }
                # Провести звонок через единый контракт завершения (TZ-1 §3):
                # ставит status=completed / ended_at / terminal_outcome и эмитит
                # канонический session.completed DomainEvent. Без этого звонок
                # оставался status=active и выпадал из /history/unified и CRM
                # (в отличие от чат-тренинга). Результат отправляем только после
                # успешной фиксации завершения в базе.
                try:
                    from app.services.completion_policy import (
                        CompletedVia,
                        TerminalReason,
                        finalize_training_session,
                        outcome_from_raw,
                    )

                    _raw_outcome = state.get("call_outcome")
                    _reason = (
                        TerminalReason.client_farewell_detected
                        if _raw_outcome == "hangup"
                        else TerminalReason.user_ended
                    )
                    await finalize_training_session(
                        db,
                        session=session,
                        outcome=outcome_from_raw(_raw_outcome),
                        reason=_reason,
                        completed_via=CompletedVia.ws,
                        manager_id=session.user_id,
                        emit_followup=False,
                        emit_crm=False,
                        emit_gamification=False,
                    )
                except Exception:
                    logger.warning(
                        "call: completion_policy finalize failed for %s",
                        state["session_id"],
                        exc_info=True,
                    )
                    raise
                await db.commit()
    except Exception:
        logger.exception("call: failed to persist score for session %s", state["session_id"])
        await _send(
            ws,
            "error",
            {"message": "Не удалось сохранить результат. Откройте звонок и завершите его ещё раз."},
        )
        return

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
    except (TimeoutError, WebSocketDisconnect):
        await ws.close(code=1008)
        return

    user_id = await _authenticate_first_message(ws, raw)
    if user_id is None:
        await ws.close(code=1008)
        return
    await _send(ws, "auth.success", {})

    state: dict | None = None
    turn_task: asyncio.Task | None = None
    last_turn_id = 0
    ws_id = uuid.uuid4().hex
    locked_session = None

    async def cancel_turn():
        nonlocal turn_task
        if turn_task is not None:
            if not turn_task.done():
                turn_task.cancel()
            await asyncio.gather(turn_task, return_exceptions=True)
            turn_task = None

    try:
        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=_RECV_WAIT_S)
            except TimeoutError:
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

            if state is not None and not await _refresh_session_lock(state["session_id"], ws_id):
                await cancel_turn()
                await _send(
                    ws,
                    "error",
                    {
                        "message": (
                            "Разговор открыт в другой вкладке или соединение недоступно. "
                            "Перезагрузите страницу."
                        )
                    },
                )
                await ws.close(code=4003)
                break
            if mtype == "ping":
                await _send(ws, "pong", {})
                continue
            if mtype == "interrupt":
                await cancel_turn()
                continue
            if mtype == "auth.refresh":
                await _send(ws, "auth.refresh_error", {"reason": "use_rest"})
                continue

            # ── start: restore history, build persona prompt and send ready ──
            if mtype in {"start", "session.resume"}:
                await cancel_turn()
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

                if str(getattr(session.status, "value", session.status)) != "active":
                    await _send(ws, "score", {"result": {"total": session.score_total}})
                    break
                if locked_session and locked_session != session_id:
                    await _release_session_lock(locked_session, ws_id)
                if locked_session != session_id and not await _acquire_session_lock(
                    session_id, ws_id
                ):
                    await _send(
                        ws,
                        "error",
                        {
                            "message": (
                                "Этот звонок уже открыт в другой вкладке. "
                                "Закройте её и повторите подключение."
                            )
                        },
                    )
                    await ws.close(code=4003)
                    break
                locked_session = session_id
                custom_params = session.custom_params or {}
                persona_name = (
                    custom_params.get("persona_name") or custom_params.get("full_name") or "Клиент"
                )
                persona_brief = str(custom_params.get("persona_brief") or "")
                emotion_preset = custom_params.get("emotion_preset")

                system_prompt = build_persona_prompt(custom_params, persona_name, emotion_preset)
                gender = derive_gender(persona_name, persona_brief)
                voice = voice_for_gender(gender)

                # Cached fillers are optional; synthesizing 16 of them must
                # never delay accepting a call.
                history = (session.scoring_details or {}).get("_call_history", [])
                history = [
                    m
                    for m in history
                    if isinstance(m, dict)
                    and m.get("role") in {"user", "assistant"}
                    and isinstance(m.get("content"), str)
                ]
                state = {
                    "session_id": session_id,
                    "ws_id": ws_id,
                    "history": list(history),
                    "system_prompt": system_prompt,
                    "voice": voice,
                    "gender": gender,
                    "user_messages": [m["content"] for m in history if m["role"] == "user"],
                    "assistant_messages": [
                        m["content"] for m in history if m["role"] == "assistant"
                    ],
                }

                await _send(
                    ws,
                    "ready",
                    {
                        "client_name": persona_name,
                        "history": history,
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
                if not isinstance(audio_b64, str) or len(audio_b64) > 16_000_000:
                    await _send(
                        ws,
                        "error",
                        {"message": "Запись слишком длинная. Отправьте более короткую реплику."},
                    )
                    continue
                turn_id = data.get("turn_id", last_turn_id + 1)
                if not isinstance(turn_id, int) or turn_id <= last_turn_id:
                    continue
                last_turn_id = turn_id
                try:
                    webm_bytes = base64.b64decode(audio_b64, validate=True)
                except (binascii.Error, ValueError):
                    await _send(ws, "error", {"message": "Не удалось декодировать аудио."})
                    continue
                await cancel_turn()

                async def run_turn(current_state, audio, media_type, current_id):
                    socket = _TurnSocket(ws, current_id, current_state)
                    try:
                        await _handle_user_turn(socket, current_state, audio, media_type)
                    except Exception:
                        logger.exception("call: turn handling failed")
                        await _send(
                            socket,
                            "error",
                            {"message": "Ошибка обработки реплики. Попробуйте ещё раз."},
                        )
                        await _send(socket, "turn_end", {})

                turn_task = asyncio.create_task(
                    run_turn(state, webm_bytes, data.get("mime", "audio/webm"), turn_id)
                )
                continue

            # ── end_call: score, persist, send result, break ──
            if mtype == "end_call":
                await cancel_turn()
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
        await cancel_turn()
        if locked_session:
            await _release_session_lock(locked_session, ws_id)
        try:
            await ws.close()
        except Exception:
            pass
