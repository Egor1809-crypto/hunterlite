"""Pre-synthesized conversational fillers for latency masking (CALL_REBUILD_TZ §5).

The single most effective latency-masking trick (peer-reviewed, arXiv
2507.22352) is to play a short conversational filler the instant the user
releases the talk button — while STT+LLM are still thinking. We synthesize a
small set per gender ONCE (lazily, on first use), cache the base64 mp3 in
process memory, and hand a random one out per turn.

If TTS fails for a filler, we skip it gracefully (return None) — a missing
filler only costs a little perceived latency, it must never break the turn.
"""
from __future__ import annotations

import asyncio
import logging
import random

from app.services.call_pipeline import tts_sentence, voice_for_gender

logger = logging.getLogger(__name__)

# §5 filler texts per gender.
_FILLER_TEXTS: dict[str, list[str]] = {
    "male": ["Так… секунду.", "Хм, ну…", "Подождите-ка."],
    "female": ["Так… минутку.", "Хм…", "Сейчас-сейчас."],
}

# In-memory cache: gender → list[base64 mp3]. Populated lazily.
_FILLER_CACHE: dict[str, list[str]] = {}
_FILLER_LOCKS: dict[str, asyncio.Lock] = {}


def _lock_for(gender: str) -> asyncio.Lock:
    lock = _FILLER_LOCKS.get(gender)
    if lock is None:
        lock = asyncio.Lock()
        _FILLER_LOCKS[gender] = lock
    return lock


async def prewarm_fillers(gender: str) -> None:
    """Synthesize and cache the filler set for ``gender`` if not already done.

    Idempotent and concurrency-safe (per-gender lock). Failures to synthesize
    an individual filler are tolerated — whatever succeeds is cached; if none
    succeed the cache for that gender stays empty and ``random_filler``
    returns None (turn proceeds without a filler).
    """
    g = "female" if gender == "female" else "male"
    if _FILLER_CACHE.get(g):
        return

    async with _lock_for(g):
        if _FILLER_CACHE.get(g):
            return
        voice = voice_for_gender(g)
        texts = _FILLER_TEXTS[g]
        results = await asyncio.gather(
            *(tts_sentence(t, voice) for t in texts),
            return_exceptions=True,
        )
        cached: list[str] = []
        for t, res in zip(texts, results):
            if isinstance(res, str) and res:
                cached.append(res)
            else:
                logger.warning("filler TTS failed for %r (gender=%s)", t, g)
        _FILLER_CACHE[g] = cached
        logger.info("prewarmed %d/%d fillers for gender=%s", len(cached), len(texts), g)


def random_filler(gender: str) -> str | None:
    """Return a random cached filler (base64 mp3) for ``gender``, or None.

    Does NOT synthesize on demand — call ``prewarm_fillers`` at session
    start. None means "no filler available", which the WS handler treats as
    "skip the filler frame".
    """
    g = "female" if gender == "female" else "male"
    pool = _FILLER_CACHE.get(g) or []
    if not pool:
        return None
    return random.choice(pool)
