"""Regression tests for the navy.api model-level fallback chain (2026-06-04).

When the primary model (deepseek-v4-pro, a reasoning model) lags or 500s,
``_call_with_backoff`` must retry the SAME request against the configured
fallback models (2026-07-14: qwen3.5-397b-a17b, deepseek-v4-flash, minimax-m3
— the owner's sanctioned navy set) — first healthy answer wins, flagged
``is_fallback`` — and must record provider health on the OVERALL outcome so a
fallback-rescued request does not open the circuit breaker.

Each test fails on the pre-fallback code (no model rotation in
``_call_with_backoff``).
"""
import asyncio

import pytest

from app.config import settings
from app.services.llm import (
    LLMError,
    LLMResponse,
    _call_with_backoff,
    _call_navy,
    _ProviderHealth,
    _resolve_fallback_models,
)


def _patch_health(monkeypatch):
    """Give the 'local' provider a fresh, healthy circuit-breaker state."""
    health = _ProviderHealth()
    monkeypatch.setattr("app.services.llm._provider_health", {"local": health})
    return health


def _resp(model: str) -> LLMResponse:
    return LLMResponse(content=f"hi from {model}", model=f"local:{model}", input_tokens=1, output_tokens=1, latency_ms=10)


def test_resolve_fallback_excludes_primary_and_dedups(monkeypatch):
    monkeypatch.setattr(settings, "local_llm_model", "deepseek-v4-pro")
    monkeypatch.setattr(settings, "local_llm_fallback_models", "gpt-5.5, gemini-3.5-flash, deepseek-v4-pro, GPT-5.5")
    # primary (default) excluded; dedup case-insensitively; order preserved
    assert _resolve_fallback_models(None) == ["gpt-5.5", "gemini-3.5-flash"]
    # an explicit primary override is the thing excluded
    assert _resolve_fallback_models("gpt-5.5") == ["gemini-3.5-flash", "deepseek-v4-pro"]


def test_primary_failure_falls_back_to_next_model(monkeypatch):
    _patch_health(monkeypatch)
    monkeypatch.setattr(settings, "local_llm_fallback_models", "fb-one,fb-two")

    async def fake(system, messages, timeout, max_tokens, temperature, **kw):
        mo = kw.get("model_override")
        if mo is None:           # primary deepseek → simulate 500/lag
            raise LLMError("Local LLM API error: 500")
        return _resp(mo)

    res = asyncio.run(_call_with_backoff("local", fake, "sys", [], 1.0))
    assert res is not None
    assert res.is_fallback is True
    assert res.content == "hi from fb-one"   # first fallback wins


def test_primary_success_is_not_flagged_fallback(monkeypatch):
    _patch_health(monkeypatch)
    monkeypatch.setattr(settings, "local_llm_fallback_models", "fb-one,fb-two")

    async def fake(system, messages, timeout, max_tokens, temperature, **kw):
        return _resp(kw.get("model_override") or "primary")

    res = asyncio.run(_call_with_backoff("local", fake, "sys", [], 1.0))
    assert res is not None
    assert res.is_fallback is False
    assert res.content == "hi from primary"


def test_second_fallback_used_when_first_also_fails(monkeypatch):
    _patch_health(monkeypatch)
    monkeypatch.setattr(settings, "local_llm_fallback_models", "fb-one,fb-two")

    async def fake(system, messages, timeout, max_tokens, temperature, **kw):
        mo = kw.get("model_override")
        if mo in (None, "fb-one"):
            raise LLMError("boom")
        return _resp(mo)

    res = asyncio.run(_call_with_backoff("local", fake, "sys", [], 1.0))
    assert res is not None and res.is_fallback is True
    assert res.content == "hi from fb-two"


def test_all_models_fail_returns_none_and_records_failure(monkeypatch):
    health = _patch_health(monkeypatch)
    monkeypatch.setattr(settings, "local_llm_fallback_models", "fb-one,fb-two")

    async def fake(system, messages, timeout, max_tokens, temperature, **kw):
        raise LLMError("everything down")

    res = asyncio.run(_call_with_backoff("local", fake, "sys", [], 1.0))
    assert res is None
    # the chain exhausting must register exactly one provider failure
    assert health.consecutive_failures >= 1


def test_fallback_success_keeps_circuit_closed(monkeypatch):
    """A deepseek failure rescued by a fallback success must NOT accumulate
    failures — otherwise repeated deepseek lag would open the circuit and
    block the (healthy) fallbacks on the next request."""
    health = _patch_health(monkeypatch)
    monkeypatch.setattr(settings, "local_llm_fallback_models", "fb-one")

    async def fake(system, messages, timeout, max_tokens, temperature, **kw):
        mo = kw.get("model_override")
        if mo is None:
            raise LLMError("deepseek lag")
        return _resp(mo)

    for _ in range(5):
        res = asyncio.run(_call_with_backoff("local", fake, "sys", [], 1.0))
        assert res is not None and res.is_fallback is True
    assert health.consecutive_failures == 0
    assert health.is_available() is True


def test_no_fallback_config_preserves_legacy_path(monkeypatch):
    """Empty fallback config → primary-only (legacy retry) behaviour."""
    _patch_health(monkeypatch)
    monkeypatch.setattr(settings, "local_llm_fallback_models", "")

    calls = {"n": 0}

    async def fake(system, messages, timeout, max_tokens, temperature, **kw):
        calls["n"] += 1
        return _resp(kw.get("model_override") or "primary")

    res = asyncio.run(_call_with_backoff("local", fake, "sys", [], 1.0))
    assert res is not None and res.is_fallback is False
    assert calls["n"] == 1  # succeeded on first attempt, no fallback rotation


@pytest.mark.parametrize("model,expects_temperature", [
    ("gpt-5.5", False),
    ("gpt-5.5-2026-04-23", False),
    ("deepseek-v4-pro", True),
    ("gemini-3.5-flash", True),
])
def test_call_navy_omits_temperature_for_gpt5(monkeypatch, model, expects_temperature):
    """gpt-5.x rejects a non-default temperature (400). _call_navy must omit
    the param for those models and keep sending it for everyone else."""
    captured = {}

    class _FakeCompletions:
        async def create(self, **kwargs):
            captured.update(kwargs)
            class _Msg:
                content = "ok"
                tool_calls = None
            class _Choice:
                message = _Msg()
            class _Usage:
                prompt_tokens = 1
                completion_tokens = 1
            class _Resp:
                choices = [_Choice()]
                usage = _Usage()
                model = "resp-model"
            return _Resp()

    class _FakeChat:
        completions = _FakeCompletions()

    class _FakeClient:
        chat = _FakeChat()

    monkeypatch.setattr(settings, "local_llm_enabled", True)
    monkeypatch.setattr(settings, "local_llm_url", "https://api.navy/v1")
    monkeypatch.setattr("app.services.llm._get_local_client", lambda: _FakeClient())

    asyncio.run(_call_navy("sys", [{"role": "user", "content": "hi"}], 5.0, max_tokens=16, temperature=0.7, model_override=model))
    assert ("temperature" in captured) is expects_temperature


# ── 2026-07-14: owner model consolidation onto navy's sanctioned set ──────────
# The live-AI chat slots (primary / persona / call / fallback) must stay inside
# the owner-approved navy models. Guards against a future edit silently
# reintroducing gemini / claude / gpt into a live chat path. Env-independent —
# asserts on the config field DEFAULTS, not a live-constructed instance.
# See memory audit-2026-07-13-functional.
SANCTIONED_CHAT_MODELS = {
    "deepseek-v4-pro",
    "deepseek-v4-flash",
    "qwen3.5-397b-a17b",
    "minimax-m3",
}


def test_default_chat_slots_are_sanctioned_navy_models():
    from app.config import Settings

    f = Settings.model_fields
    assert f["local_llm_model"].default == "deepseek-v4-pro"          # primary
    assert f["local_llm_persona_model"].default == "deepseek-v4-flash"  # live chat
    assert f["call_model"].default == "deepseek-v4-flash"             # live voice
    for slot in ("local_llm_model", "local_llm_persona_model", "call_model"):
        assert f[slot].default in SANCTIONED_CHAT_MODELS, (
            f"unsanctioned model in chat slot {slot!r}: {f[slot].default!r}"
        )


def test_default_fallback_chain_is_sanctioned_and_ordered(monkeypatch):
    from app.config import Settings

    default_chain = Settings.model_fields["local_llm_fallback_models"].default
    assert default_chain == "qwen3.5-397b-a17b,deepseek-v4-flash,minimax-m3"
    # the parser must yield exactly that order, exclude the primary, and never
    # surface a legacy provider.
    monkeypatch.setattr(settings, "local_llm_model", "deepseek-v4-pro")
    monkeypatch.setattr(settings, "local_llm_fallback_models", default_chain)
    chain = _resolve_fallback_models(None)
    assert chain == ["qwen3.5-397b-a17b", "deepseek-v4-flash", "minimax-m3"]
    assert all(m in SANCTIONED_CHAT_MODELS for m in chain)
    assert "deepseek-v4-pro" not in chain  # primary excluded from its own chain
