"""Regression for the call voice/filler quality pass.

- ``voice_for_gender`` prefers the env ElevenLabs pool (ELEVENLABS_VOICE_IDS_*)
  and picks the FIRST id deterministically, so the filler and every sentence of
  a call share ONE stable voice; falls back to CALL_TTS_VOICE_* when the env
  pool is empty.
- ``random_filler`` never returns the same filler twice in a row when there are
  alternatives (the "smarter" no-repeat touch), and never locks up on a
  single-item pool.
"""

import pytest

from app.config import settings
from app.services import call_fillers, call_pipeline


def test_voice_for_gender_prefers_env_pool(monkeypatch):
    monkeypatch.setattr(settings, "elevenlabs_voice_ids_male", "M1,M2")
    monkeypatch.setattr(settings, "elevenlabs_voice_ids_female", "F1,F2")
    # Deterministic first id → stable per gender (no rotation, no drift).
    assert call_pipeline.voice_for_gender("male") == "M1"
    assert call_pipeline.voice_for_gender("female") == "F1"


def test_voice_for_gender_falls_back_when_pool_empty(monkeypatch):
    monkeypatch.setattr(settings, "elevenlabs_voice_ids_male", "")
    monkeypatch.setattr(settings, "elevenlabs_voice_ids_female", "")
    monkeypatch.setattr(settings, "call_tts_voice_male", "CALL_M")
    monkeypatch.setattr(settings, "call_tts_voice_female", "CALL_F")
    assert call_pipeline.voice_for_gender("male") == "CALL_M"
    assert call_pipeline.voice_for_gender("female") == "CALL_F"


def test_random_filler_no_immediate_repeat():
    orig_cache = dict(call_fillers._FILLER_CACHE)
    orig_last = dict(call_fillers._LAST_FILLER)
    try:
        call_fillers._FILLER_CACHE["male"] = ["a", "b", "c"]
        call_fillers._LAST_FILLER.pop("male", None)
        prev = None
        for _ in range(30):
            pick = call_fillers.random_filler("male")
            assert pick in ("a", "b", "c")
            assert pick != prev, "filler repeated back-to-back"
            prev = pick
    finally:
        call_fillers._FILLER_CACHE.clear()
        call_fillers._FILLER_CACHE.update(orig_cache)
        call_fillers._LAST_FILLER.clear()
        call_fillers._LAST_FILLER.update(orig_last)


def test_random_filler_single_item_no_lockup():
    orig_cache = dict(call_fillers._FILLER_CACHE)
    orig_last = dict(call_fillers._LAST_FILLER)
    try:
        call_fillers._FILLER_CACHE["female"] = ["only"]
        call_fillers._LAST_FILLER.pop("female", None)
        # Single-item pool: returns it every time, no crash / no infinite loop.
        assert call_fillers.random_filler("female") == "only"
        assert call_fillers.random_filler("female") == "only"
    finally:
        call_fillers._FILLER_CACHE.clear()
        call_fillers._FILLER_CACHE.update(orig_cache)
        call_fillers._LAST_FILLER.clear()
        call_fillers._LAST_FILLER.update(orig_last)


def test_random_filler_empty_pool_returns_none():
    orig_cache = dict(call_fillers._FILLER_CACHE)
    try:
        call_fillers._FILLER_CACHE.pop("male", None)
        assert call_fillers.random_filler("male") is None
    finally:
        call_fillers._FILLER_CACHE.clear()
        call_fillers._FILLER_CACHE.update(orig_cache)
