"""Regression (ultrareview C4/C5):
- C4: the scenario classifier must default to a NON-reasoning model (else it
  burns the token budget and is dead 100% of the time).
- C5: the legal radar must run the AI fallback when nothing RELEVANT was found,
  not only when RSS returned literally nothing (sub-threshold RSS items used to
  skip AI → 0 updates forever).
"""
import asyncio

import app.services.legal_radar as radar
from app.config import settings


def test_classifier_default_is_non_reasoning():
    assert settings.tz5_classifier_model == "gemini-3.5-flash"


def test_radar_runs_ai_fallback_on_subthreshold_rss(monkeypatch):
    ai_called = {"n": 0}

    async def fake_rss():
        # RSS returns items, but ALL below the >0.3 relevance threshold.
        return [{"relevance_score": 0.1, "title": "x", "summary": "y"}]

    async def fake_ai():
        ai_called["n"] += 1
        return [{"relevance_score": 0.9, "title": "ФЗ-127 поправка", "summary": "важно"}]

    saved_with = {"items": None}

    async def fake_save(db, relevant):
        saved_with["items"] = relevant
        return len(relevant)

    monkeypatch.setattr(radar, "_try_rss_sources", fake_rss)
    monkeypatch.setattr(radar, "_ai_generate_updates", fake_ai)
    monkeypatch.setattr(radar, "_save_updates", fake_save)

    saved = asyncio.run(radar.fetch_updates(db=None))

    assert ai_called["n"] == 1, "AI fallback must fire when RSS yields nothing RELEVANT"
    assert saved == 1
    assert saved_with["items"] and saved_with["items"][0]["relevance_score"] == 0.9
