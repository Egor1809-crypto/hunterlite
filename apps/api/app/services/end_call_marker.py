"""Explicit LLM disconnect markers and terminal stage directions.

Only affirmative, standalone closing actions at the end of a reply count.
Threats, questions, quoted actions and ordinary farewells keep the existing
weighted decision path. Remove machine/stage markers before display and TTS.
"""
from __future__ import annotations

import re
from typing import Final

# Match the marker with surrounding whitespace, case-insensitive. The
# marker MUST appear as a standalone bracketed token — embedded use like
# ``"... and don't [end_call] me"`` still matches but that's acceptable:
# the LLM is instructed to use it only at end-of-reply, and even an
# accidental match strips harmlessly.
_END_CALL_RE: Final[re.Pattern[str]] = re.compile(
    r"\s*\[END_CALL\]\s*",
    flags=re.IGNORECASE,
)


_ACTION = (
    r"(?:прерывает разговор|завершает (?:разговор|звонок)|"
    r"клад[её]т трубку|вешает трубку|отключается)"
)
_CLOSING_ACTION_RE = re.compile(
    rf"(?:^|(?<=[.!…])\s+)(?:\(\s*{_ACTION}\s*\)|\[\s*{_ACTION}\s*\]|\*\s*{_ACTION}\s*\*)[.!…]?\s*$",
    re.IGNORECASE,
)


def detect_end_call(text: str) -> bool:
    """Detect a machine marker or an affirmative closing stage action."""
    if not text:
        return False
    return bool(_END_CALL_RE.search(text) or _CLOSING_ACTION_RE.search(text))


def strip_end_call(text: str) -> str:
    """Return ``text`` with all ``[END_CALL]`` markers removed.

    Multi-marker / lowercase / extra-whitespace forms are normalised to a
    single space and the result is trimmed.
    """
    if not text:
        return text
    out = _CLOSING_ACTION_RE.sub("", _END_CALL_RE.sub(" ", text))
    # Collapse double spaces introduced by the strip.
    out = re.sub(r"[ \t]{2,}", " ", out)
    return out.strip()


def detect_and_strip(text: str) -> tuple[bool, str]:
    """One-shot: ``(has_marker, text_without_marker)``."""
    has = detect_end_call(text)
    return has, strip_end_call(text) if has else text


__all__ = ["detect_end_call", "strip_end_call", "detect_and_strip"]
