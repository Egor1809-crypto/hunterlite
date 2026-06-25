"""Voice-call streaming cascade — STT → streaming-LLM → per-sentence TTS.

CALL_REBUILD_TZ §1, §4, §6, §7. This module is the navy.api glue for the
rebuilt voice-call mode (`app/ws/call.py`). It is intentionally small and
linear — no VAD, no one-turn-lock, no emotion FSM. Turn boundaries are
push-to-talk on the frontend; this module only converts one webm turn into
streamed sentence audio and, at end of call, scores the transcript.

navy.api is UNSTABLE (documented spikes 11-139s), so every network call is
wrapped in ``asyncio.wait_for`` with a per-leg timeout and degrades
gracefully (filler / «повторите, пожалуйста») rather than raising.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from io import BytesIO
from typing import AsyncGenerator

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


# ─── navy.api base / headers (copy-ready, TZ §"NAVY CALLS") ───────────────
def _navy_base() -> str:
    b = settings.local_llm_url.rstrip("/")
    return b if b.endswith("/v1") else b + "/v1"


_HEADERS = {"Authorization": f"Bearer {settings.local_llm_api_key}"}


# ─── STT ──────────────────────────────────────────────────────────────────
async def stt_transcribe(webm_bytes: bytes) -> str:
    """Transcribe one webm turn via navy /v1/audio/transcriptions (multipart).

    gpt-4o-transcribe REJECTS verbose_json — only json/text. On timeout or
    any error returns "" so the caller asks the user to repeat.
    """
    if not webm_bytes:
        return ""

    async def _do() -> str:
        files = {"file": ("turn.webm", BytesIO(webm_bytes), "audio/webm")}
        data = {
            "model": settings.call_stt_model,
            "language": "ru",
            "response_format": "json",
        }
        async with httpx.AsyncClient(timeout=settings.call_stt_timeout) as client:
            r = await client.post(
                f"{_navy_base()}/audio/transcriptions",
                files=files,
                data=data,
                headers=_HEADERS,
            )
            r.raise_for_status()
            return str(r.json().get("text", "") or "")

    try:
        return await asyncio.wait_for(_do(), timeout=settings.call_stt_timeout)
    except asyncio.TimeoutError:
        logger.warning("call STT timed out after %.1fs", settings.call_stt_timeout)
        return ""
    except Exception:
        logger.warning("call STT failed", exc_info=True)
        return ""


# Cyrillic letters — STT junk = empty / single-char / no Cyrillic at all
# (e.g. «谢谢», «Tuo», «.»). Real Russian turns always carry Cyrillic.
_CYRILLIC_RE = re.compile(r"[а-яёА-ЯЁ]")


def is_junk(text: str) -> bool:
    """True if STT output is non-speech noise that must be dropped.

    Drops: empty, a lone «.», single-char results, and anything without a
    single Cyrillic letter (foreign-language hallucinations like «谢谢»/«Tuo»).
    """
    s = (text or "").strip()
    if not s:
        return True
    stripped = s.strip(".…·•- ")
    if len(stripped) <= 1:
        return True
    if not _CYRILLIC_RE.search(s):
        return True
    return False


# ─── LLM streaming (SSE) ───────────────────────────────────────────────────
async def llm_stream(
    history: list[dict],
    system_prompt: str,
) -> AsyncGenerator[str, None]:
    """Stream assistant tokens from navy /v1/chat/completions (SSE).

    Yields content tokens as they arrive. Reads ``r.aiter_lines()`` and
    parses ``data:`` chunks; ``[DONE]`` ends the stream. Malformed chunks
    are skipped (guarded JSONDecodeError/KeyError/IndexError). The whole
    stream is bounded by ``call_llm_timeout``; on timeout/error it stops
    yielding (the caller falls back gracefully on an empty reply).
    """
    payload = {
        "model": settings.call_llm_model,
        "stream": True,
        "max_tokens": 220,
        "temperature": 0.8,
        "messages": [{"role": "system", "content": system_prompt}, *history],
    }

    async def _gen() -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient(timeout=settings.call_llm_timeout) as client:
            async with client.stream(
                "POST",
                f"{_navy_base()}/chat/completions",
                json=payload,
                headers=_HEADERS,
            ) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    chunk = line[len("data:"):].strip()
                    if not chunk:
                        continue
                    if chunk == "[DONE]":
                        break
                    try:
                        parsed = json.loads(chunk)
                        token = parsed["choices"][0]["delta"].get("content")
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
                    if token:
                        yield token

    try:
        gen = _gen()
        while True:
            try:
                token = await asyncio.wait_for(
                    gen.__anext__(), timeout=settings.call_llm_timeout
                )
            except StopAsyncIteration:
                break
            yield token
    except asyncio.TimeoutError:
        logger.warning("call LLM stream timed out after %.1fs", settings.call_llm_timeout)
        return
    except Exception:
        logger.warning("call LLM stream failed", exc_info=True)
        return


# ─── TTS (per sentence) ────────────────────────────────────────────────────
async def tts_sentence(sentence: str, voice_id: str) -> str | None:
    """Synthesize one sentence via navy /v1/audio/speech → base64 mp3.

    Returns None on timeout/error so the caller can skip audio for that
    sentence gracefully (text still shown). Input capped at 4096 chars.
    """
    text = (sentence or "").strip()
    if not text:
        return None

    async def _do() -> str:
        payload = {
            "model": settings.call_tts_model,
            "input": text[:4096],
            "voice": voice_id,
            "response_format": "mp3",
        }
        async with httpx.AsyncClient(timeout=settings.call_tts_timeout) as client:
            r = await client.post(
                f"{_navy_base()}/audio/speech",
                json=payload,
                headers=_HEADERS,
            )
            r.raise_for_status()
            return base64.b64encode(r.content).decode()

    try:
        return await asyncio.wait_for(_do(), timeout=settings.call_tts_timeout)
    except asyncio.TimeoutError:
        logger.warning("call TTS timed out after %.1fs", settings.call_tts_timeout)
        return None
    except Exception:
        logger.warning("call TTS failed", exc_info=True)
        return None


# ─── Sentence boundary detection (streaming flush) ─────────────────────────
# Abbreviations / patterns we must NOT split on. The terminator must be a
# real end-of-sentence, not «Dr.», «т.е.», «т.д.», or a decimal «3.14».
_ABBREV_TAILS = ("dr", "т.е", "т.д", "т.к", "т.п", "напр", "см", "ул", "г")
_MIN_SENTENCE_CHARS = 10


def pop_complete_sentence(buf: str) -> tuple[str | None, str]:
    """Detect a complete sentence in ``buf``; return (sentence|None, rest).

    A boundary is a ``[.!?…]`` followed by whitespace or end-of-string.
    Guards:
      - decimals («3.14») — digit on both sides of «.» is not a boundary;
      - abbreviations («Dr.», «т.е.», «т.д.») — known tails are skipped;
      - minimum length — require ≥10 chars before the terminator to flush
        (avoids «Да.» fragments that strand TTS on 3-char clips).
    """
    if not buf:
        return None, buf

    for m in re.finditer(r"[.!?…]+", buf):
        end = m.end()
        # Must be followed by whitespace or EOL to count as a boundary.
        if end < len(buf) and not buf[end].isspace():
            continue
        term_start = m.start()
        # Decimal guard: digit immediately before AND after the dot.
        if (
            buf[term_start] == "."
            and term_start > 0
            and buf[term_start - 1].isdigit()
            and end < len(buf)
            and buf[end].isdigit()
        ):
            continue
        candidate = buf[:end]
        # Abbreviation guard: check the token ending at the terminator.
        last_token = re.split(r"\s+", candidate.strip())[-1].lower().rstrip(".")
        if last_token in _ABBREV_TAILS:
            continue
        if len(candidate.strip()) < _MIN_SENTENCE_CHARS:
            continue
        sentence = candidate.strip()
        rest = buf[end:].lstrip()
        return sentence, rest

    return None, buf


# ─── Hangup marker ─────────────────────────────────────────────────────────
# Unified with the prompt (§6 section 8): the persona appends «[КЛАДУ ТРУБКУ]»
# when ending the call. We detect + strip it so it never reaches TTS/display.
_HANGUP_RE = re.compile(r"\s*\[\s*КЛАДУ\s+ТРУБКУ\s*\]\s*", flags=re.IGNORECASE)


def wants_hangup(text: str) -> bool:
    """True iff the assistant text carries the «[КЛАДУ ТРУБКУ]» marker."""
    if not text or "[" not in text:
        return False
    return bool(_HANGUP_RE.search(text))


def strip_hangup_marker(text: str) -> str:
    """Remove «[КЛАДУ ТРУБКУ]» markers; collapse leftover whitespace."""
    if not text:
        return text
    out = _HANGUP_RE.sub(" ", text)
    return re.sub(r"\s{2,}", " ", out).strip()


# ─── Gender heuristic → voice ──────────────────────────────────────────────
_FEMALE_SUFFIXES = ("ова", "ева", "ёва", "ина", "ына", "ская", "цкая", "вна", "чна")
_FEMALE_FIRSTNAME_ENDINGS = ("а", "я")
# Common male names ending in -а/-я that the simple suffix rule misfires on.
_MALE_NAME_EXCEPTIONS = {"никита", "илья", "фома", "савва", "лука", "кузьма", "данила", "гаврила"}


def derive_gender(persona_name: str, persona_brief: str) -> str:
    """Heuristic «male»/«female» from the persona's Russian name.

    Female markers: surname endings -ова/-ева/-ина/-ская/-вна, or a first
    name ending in -а/-я (with a small male-name exception set). Defaults to
    «male» when ambiguous (matches the male voice default).
    """
    name = (persona_name or "").strip().lower()
    if not name:
        # Fall back to scanning the brief for a feminine patronymic/surname.
        brief = (persona_brief or "").lower()
        if re.search(r"[а-яё]+(ова|ева|ёва|ина|ская|вна)\b", brief):
            return "female"
        return "male"

    tokens = [t for t in re.split(r"\s+", name) if t]
    for tok in tokens:
        if tok.endswith(_FEMALE_SUFFIXES):
            return "female"

    first = tokens[0] if tokens else name
    if first in _MALE_NAME_EXCEPTIONS:
        return "male"
    if first.endswith(_FEMALE_FIRSTNAME_ENDINGS):
        return "female"
    return "male"


def voice_for_gender(gender: str) -> str:
    """Resolve voice_id from gender (female → female voice, else male)."""
    if gender == "female":
        return settings.call_tts_voice_female
    return settings.call_tts_voice_male


# ─── Persona Agent Playbook system prompt (§6, 9 sections) ─────────────────
def build_persona_prompt(
    custom_params: dict,
    persona_name: str,
    emotion_preset: str | None,
) -> str:
    """Build the 9-section Agent Playbook system prompt (§6).

    Section 3 (grounding) embeds ``custom_params["persona_brief"]`` VERBATIM —
    that dossier is the SINGLE source of facts. The persona must never invent
    city/age/work beyond it. Output format is enforced as 1-3 short
    conversational Russian sentences, no markdown / hashtags / stage
    directions. Section 8 lets the persona end a rude call with the marker
    «[КЛАДУ ТРУБКУ]».
    """
    cp = custom_params or {}
    name = (persona_name or cp.get("persona_name") or "должник").strip()
    brief = str(cp.get("persona_brief") or "").strip()
    preset = (emotion_preset or cp.get("emotion_preset") or "настороженный").strip()

    if not brief:
        brief = (
            "(досье не задано — отвечай уклончиво, НЕ называй никаких конкретных "
            "фактов о себе: ни города, ни возраста, ни работодателя, ни сумм)"
        )

    return (
        f"1. РОЛЬ: Ты — {name}. Ты реальный человек-должник, которому звонит юрист по "
        f"банкротству физлиц. Ты НЕ ассистент, НЕ ИИ, НЕ бот. Никогда не выходи из роли.\n\n"
        f"2. ХАРАКТЕР И ТОН: Твоё состояние — {preset}. Говоришь коротко, по-телефонному, "
        f"как живой человек в разговоре, а не как текст в чате.\n\n"
        f"3. ТВОЁ ДОСЬЕ (ЕДИНСТВЕННЫЙ источник фактов о тебе — НЕ выдумывай НИЧЕГО сверх него):\n"
        # NB: персона-досье — НЕ wiki-RAG контент, поэтому используется отдельный
        # делимитер, а не wiki-маркеры изоляции (те эмитятся только каноническим
        # UnifiedRAGResult.to_prompt; см. test_rag_invariants).
        f"[ДОСЬЕ_НАЧАЛО]\n{brief}\n[ДОСЬЕ_КОНЕЦ]\n\n"
        f"4. ХОД РАЗГОВОРА: Тебе звонит юрист по поводу твоих долгов. Сначала ты относишься "
        f"с недоверием («откуда у вас мой номер?», «кто вы такой?»). По мере того как юрист "
        f"внушает доверие и грамотно объясняет — постепенно раскрываешься и отвечаешь честнее.\n\n"
        f"5. ВОЗРАЖЕНИЯ: Ты сомневаешься в законности банкротства, боишься потерять имущество, "
        f"спрашиваешь, сколько это стоит и какие гарантии. Выдвигай эти возражения естественно.\n\n"
        f"6. ГРУНТИНГ (КРИТИЧНО): Если какого-то факта нет в досье — отвечай уклончиво или "
        f"«не помню», но НИКОГДА не изобретай город, возраст, работодателя, суммы долга или "
        f"состав семьи. Называй ТОЛЬКО то, что прямо есть в досье выше.\n\n"
        f"7. ФОРМАТ ОТВЕТА: 1-3 коротких предложения. Разговорный русский. БЕЗ markdown, БЕЗ "
        f"хештегов, БЕЗ списков, БЕЗ ремарок в скобках или звёздочках, БЕЗ описания действий. "
        f"Только прямая речь должника.\n\n"
        f"8. ЗАВЕРШЕНИЕ: Если юрист груб, хамит или ведёт себя непрофессионально — ты можешь "
        f"закончить разговор короткой фразой прощания и в самом конце ответа добавить маркер "
        f"[КЛАДУ ТРУБКУ]. В обычном вежливом разговоре маркер НЕ добавляй.\n\n"
        f"9. ПРИМЕР (коротко, НЕ копируй дословно): Юрист: «Здравствуйте, я звоню по вашим "
        f"долгам». Ты: «Да? А откуда у вас мой номер?»"
    )


# ─── End-of-call scoring (§7 rubric, deterministic aggregation) ────────────
# (criterion_ru, kind, weight). kind: "binary" (cap 1) or "scale5" (cap 5).
_RUBRIC: list[tuple[str, str, int]] = [
    ("Представился и обозначил цель", "binary", 10),
    ("Установил контакт, не давил грубо", "scale5", 20),
    ("Выявил состав/причину долга", "binary", 15),
    ("Отработал возражения", "scale5", 25),
    ("Предложил корректное решение", "scale5", 20),
    ("Не нарушил закон / без ложных гарантий", "binary", 10),
]

_JUDGE_TIMEOUT_S = 25.0


async def _judge_invoke(prompt: str) -> str:
    """Rubric-judge invoke — DIRECT navy call on the fast call LLM
    (``claude-haiku-4.5``), NOT the shared ``task_type="judge"`` path.

    2026-06-09 re-measurement (§11): the named «fast» judge model on navy is
    in fact a reasoning model taking 30-85s/call and timing out under 6-way
    concurrency → all-zero scores. ``claude-haiku-4.5`` judges the same rubric
    in ~2-3s/criterion (≈3s for all 6 concurrent) with adequate accuracy.
    Scoring is end-of-call (not real-time, §7), but must stay reliable — this
    path does. Returns raw content (may be ```json-fenced; caller strips it).
    """
    payload = {
        "model": settings.call_llm_model,
        "temperature": 0.2,
        "max_tokens": 200,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Ты строгий экзаменатор звонков юриста по банкротству физлиц. "
                    "Возвращай ТОЛЬКО JSON, без markdown."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=settings.call_llm_timeout) as client:
        r = await client.post(
            f"{_navy_base()}/chat/completions", json=payload, headers=_HEADERS
        )
        r.raise_for_status()
        data = r.json()
        return (data["choices"][0]["message"]["content"] or "")


def _criterion_cap(kind: str) -> int:
    return 1 if kind == "binary" else 5


def _verdict_from_total(total: float) -> str:
    """Map an aggregate 0-100 score to a JudgeVerdictCard verdict label."""
    if total >= 85:
        return "excellent"
    if total >= 70:
        return "good"
    if total >= 45:
        return "mixed"
    if total >= 25:
        return "poor"
    return "red_flag"


async def _judge_criterion(
    criterion_ru: str,
    kind: str,
    transcript: str,
) -> tuple[int, str]:
    """Run ONE LLM judge for a single rubric criterion.

    Returns (raw_score, rationale_ru). raw_score is clamped to the kind's
    cap. Fail-soft: any error/timeout/parse-failure → (0, degradation note).
    """
    from app.services.scoring_llm_judge import _strip_code_fence

    cap = _criterion_cap(kind)
    scale_desc = (
        "0 или 1 (0 — не выполнено, 1 — выполнено)"
        if kind == "binary"
        else "целое от 0 до 5 (0 — провал, 5 — образцово)"
    )
    prompt = (
        "Ты — строгий экзаменатор звонков юриста по банкротству физлиц должнику.\n"
        f"Оцени ТОЛЬКО один критерий: «{criterion_ru}».\n"
        f"Шкала: {scale_desc}.\n\n"
        "Транскрипт звонка (M[i] — реплики юриста, которого ты оцениваешь; "
        "К — реплики должника):\n"
        "[ТРАНСКРИПТ_НАЧАЛО]\n"
        f"{transcript}\n"
        "[ТРАНСКРИПТ_КОНЕЦ]\n\n"
        "Верни СТРОГО JSON без пояснений и без markdown-обёртки, ровно в формате:\n"
        '{"score": <число>, "rationale_ru": "<краткое обоснование на русском>"}'
    )

    try:
        content = await asyncio.wait_for(
            _judge_invoke(prompt), timeout=_JUDGE_TIMEOUT_S
        )
    except Exception:
        logger.warning("call judge failed for criterion=%r — fail-soft", criterion_ru, exc_info=True)
        return 0, "Оценка недоступна (сбой судьи)."

    try:
        parsed = json.loads(_strip_code_fence(content))
        raw = int(parsed.get("score", 0))
        rationale = str(parsed.get("rationale_ru", "") or "").strip()
    except (json.JSONDecodeError, TypeError, ValueError):
        logger.warning("call judge parse failed for criterion=%r", criterion_ru)
        return 0, "Не удалось разобрать ответ судьи."

    raw = max(0, min(cap, raw))
    if not rationale:
        rationale = "Без комментария."
    return raw, rationale


async def score_call(
    *,
    session_id: str,
    user_messages: list[str],
    assistant_messages: list[str],
) -> dict:
    """Score a finished call via per-criterion LLM judges (§7).

    Contract:
      - ONE LLM judge per rubric criterion, run concurrently (asyncio.gather).
      - Deterministic aggregation IN CODE: total = Σ (score/cap)*weight,
        clamped to [0, 100].
      - EMPTY GUARD: fewer than 2 user turns of ≥2 words → {total: 0,
        _empty: true} (no LLM spend on an empty/garbage call).
      - Returns {total, scoring_details} where scoring_details carries a
        "judge" block (rendered by the existing /results JudgeVerdictCard)
        and a "_call_rubric" per-criterion breakdown.
    """
    from app.services.scoring_llm_judge import _format_transcript

    # Empty guard — count substantive user turns (≥2 words).
    substantive = sum(
        1 for m in (user_messages or []) if len((m or "").split()) >= 2
    )
    if substantive < 2:
        return {
            "total": 0,
            "_empty": True,
            "scoring_details": {
                "_empty": True,
                "judge": {
                    "verdict": "red_flag",
                    "score_adjust": 0,
                    "rationale_ru": (
                        "Звонок пустой или слишком короткий (меньше двух "
                        "содержательных реплик юриста) — оценка не начислена."
                    ),
                    "red_flags": [],
                    "strengths": [],
                    "model_used": settings.call_llm_model,
                    "latency_ms": 0,
                },
                "_call_rubric": [],
            },
        }

    transcript = _format_transcript(user_messages, assistant_messages)

    results = await asyncio.gather(
        *(
            _judge_criterion(criterion_ru, kind, transcript)
            for (criterion_ru, kind, _weight) in _RUBRIC
        )
    )

    total = 0.0
    rubric_rows: list[dict] = []
    for (criterion_ru, kind, weight), (raw, rationale) in zip(_RUBRIC, results):
        cap = _criterion_cap(kind)
        earned = (raw / cap) * weight if cap else 0.0
        total += earned
        rubric_rows.append(
            {
                "criterion": criterion_ru,
                "kind": kind,
                "score": raw,
                "cap": cap,
                "weight": weight,
                "earned": round(earned, 1),
                "rationale_ru": rationale,
            }
        )

    total_clamped = int(max(0, min(100, round(total))))
    verdict = _verdict_from_total(total_clamped)

    strengths = [
        {"label": r["criterion"], "message_index": -1, "excerpt": ""}
        for r in rubric_rows
        if (r["score"] / r["cap"]) >= 0.6
    ]
    red_flags = [
        {"label": r["criterion"], "message_index": -1, "excerpt": "", "fix_example": ""}
        for r in rubric_rows
        if (r["score"] / r["cap"]) < 0.4
    ]
    rationale_ru = "; ".join(
        f"{r['criterion']}: {r['score']}/{r['cap']}" for r in rubric_rows
    )

    scoring_details = {
        "judge": {
            "verdict": verdict,
            "score_adjust": 0,
            "rationale_ru": rationale_ru,
            "red_flags": red_flags,
            "strengths": strengths,
            "model_used": settings.call_llm_model,
            "latency_ms": 0,
        },
        "_call_rubric": rubric_rows,
    }

    return {"total": total_clamped, "scoring_details": scoring_details}
