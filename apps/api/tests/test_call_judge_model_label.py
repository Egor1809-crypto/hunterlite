"""Regression: call-scoring verdict card must report the REAL judge model.

The end-of-call rubric judge (``call_pipeline._judge_invoke``) deliberately
runs on ``settings.call_llm_model`` (claude-haiku-4.5) — NOT deepseek — because
the named "judge" model on navy is a reasoning model that times out under
6-way concurrency and returns all-zero scores (see ``_judge_invoke`` docstring,
§11). Before this fix ``score_call`` hardcoded ``"model_used":
"deepseek-v4-pro"`` in BOTH the empty-guard branch and the real-scoring branch,
so every call's JudgeVerdictCard mislabelled the model that produced the score.

The empty-guard branch returns synchronously without any LLM/network call, so
this regression is verifiable offline.
"""

from pathlib import Path

from app.config import settings
from app.services.call_pipeline import score_call

_SRC = Path(__file__).parent.parent / "app" / "services" / "call_pipeline.py"


async def test_empty_call_reports_real_judge_model():
    # 0 substantive user turns → empty guard fires; no LLM is invoked.
    out = await score_call(session_id="t", user_messages=[""], assistant_messages=[])
    judge = out["scoring_details"]["judge"]
    assert judge["model_used"] == settings.call_llm_model
    # Pin the specific regression: the old hardcoded literal must be gone.
    assert judge["model_used"] != "deepseek-v4-pro"


def test_source_has_no_hardcoded_judge_model_literal():
    """Static guard so the hardcoded label cannot silently return."""
    src = _SRC.read_text(encoding="utf-8")
    assert '"model_used": "deepseek-v4-pro"' not in src, (
        "call_pipeline must report settings.call_llm_model, not a hardcoded model."
    )
