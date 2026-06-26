"""Regression: chat mode (text-only) must NOT be treated as a voice/TTS mode.

The "typing → long pause → message dumps at once" bug was caused by chat
sessions running the voice TTS pipeline (synthesizing per-sentence audio the FE
mutes) and holding the final ``character.response`` behind a 5-15s TTS-tail
wait. The fix routes the chat-vs-voice decision through ``_is_voice_mode`` and
gates every TTS site in ``_generate_character_reply`` on it. This pins that
predicate so chat ("chat"/empty/unset) stays text-only and only call/center
enable TTS — regardless of casing.
"""

import pytest

from app.ws.training import _is_voice_mode


@pytest.mark.parametrize(
    "mode,expected",
    [
        ("chat", False),
        ("", False),
        ("call", True),
        ("center", True),
        # Case-insensitive: a stored "Call"/"CENTER" must still enable voice,
        # never silently mute a real call.
        ("Call", True),
        ("CENTER", True),
        ("CHAT", False),
    ],
)
def test_is_voice_mode_value(mode, expected):
    assert _is_voice_mode({"session_mode": mode}) is expected


def test_is_voice_mode_missing_key_defaults_to_chat():
    # No session_mode at all → text-only chat (TTS gated off).
    assert _is_voice_mode({}) is False
    assert _is_voice_mode({"session_mode": None}) is False
