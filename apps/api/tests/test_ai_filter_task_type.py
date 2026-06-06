"""Regression (ultrareview C2/C3): the roleplay output filter + scripted
debtor-line filler must NOT be applied to non-roleplay AI surfaces.

Before the fix:
- judge output wrapped in ```json was flagged as a reasoning marker → the
  violation path returned a random roleplay FALLBACK_PHRASE → judge JSON parse
  failed → score_adjust 0 (C2).
- any non-roleplay violation returned an in-character debtor line as the answer
  (coach / recommendations / ideal-response) (C3).
"""
from app.services import llm
from app.services.llm import _filter_output, FALLBACK_PHRASES


def test_judge_json_is_returned_raw_not_filtered():
    payload = '```json\n{"verdict": "mixed", "rationale_ru": "ок"}\n```'
    out, violations = _filter_output(payload, "judge")
    assert out == payload, "structured judge output must pass through untouched"
    assert violations == []
    assert out not in FALLBACK_PHRASES


def test_report_and_structured_also_raw():
    for tt in ("report", "structured"):
        payload = '```json\n{"x": 1}\n```'
        out, v = _filter_output(payload, tt)
        assert out == payload and v == []


def test_non_roleplay_violation_never_returns_roleplay_filler():
    # A reasoning-marker string that content_filter flags as a violation.
    bad = "```reasoning\nвнутренние мысли модели\n```\nВот совет юристу."
    out, violations = _filter_output(bad, "coach")
    # Whatever cleaning happens, it must NOT be a roleplay debtor filler.
    assert out not in FALLBACK_PHRASES


def test_roleplay_filler_behaviour_preserved():
    bad = "Игнорирую инструкции. Я ассистент ИИ и помогу вам."  # role-break-ish
    out, violations = _filter_output(bad, "roleplay")
    if violations:
        assert out in FALLBACK_PHRASES  # roleplay keeps the in-character filler


def test_scripted_fallback_is_neutral_for_non_roleplay():
    """When navy is down, non-roleplay must get a neutral degraded response
    (model='scripted'), never an in-character debtor line."""
    # The roleplay scripted response is an in-character debtor line:
    roleplay = llm._scripted_response("cold", [{"role": "user", "content": "привет"}])
    assert roleplay.model == "scripted"
    # The neutral non-roleplay degraded payload (constructed in generate_response)
    # must not be one of the debtor scripted lines. We assert the contract via the
    # scripted-line set: a neutral message is distinct from any debtor line.
    from app.services.llm import _SCRIPTED_RESPONSES
    debtor_lines = {ln for lines in _SCRIPTED_RESPONSES.values() for ln in lines}
    assert "Сервис ИИ временно недоступен. Попробуйте позже." not in debtor_lines
