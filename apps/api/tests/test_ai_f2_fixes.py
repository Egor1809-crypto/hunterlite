"""Regression (ultrareview F2 majors):
- content_filter None-guard (M15): filter_*(None) must degrade, not TypeError.
- exam_grader required-cap (M2): set-equality, not substring — "kp1" must NOT be
  considered covered just because "kp10" is in `covered`.
- output cap (M6): MAX_AI_RESPONSE_LENGTH is large enough for legal answers.
"""
from app.services.content_filter import filter_user_input, filter_ai_output, MAX_AI_RESPONSE_LENGTH
from app.services.exam_grader import _enforce_required, ExamGrade, _REQUIRED_MISS_CAP


def test_filter_none_guard():
    assert filter_user_input(None) == ("", [])
    assert filter_ai_output(None) == ("", [])
    assert filter_user_input("") == ("", [])
    assert filter_ai_output("") == ("", [])


def test_output_cap_fits_legal_answers():
    assert MAX_AI_RESPONSE_LENGTH >= 6000


def test_required_cap_uses_set_equality_not_substring():
    # covered has only "kp10"; required is "kp1". Substring match would wrongly
    # treat "kp1" as covered ("kp1" in "kp10") → cap wouldn't fire.
    g = ExamGrade(score=10.0, max_score=10.0, percent=100, covered=["kp10"], missed=[])
    points = [{"id": "kp1", "required": True}, {"id": "kp10", "required": False}]
    capped = _enforce_required(g, points, max_score=10.0)
    assert capped.percent <= _REQUIRED_MISS_CAP, "missing required kp1 must cap the score"


def test_required_cap_passes_when_required_truly_covered():
    g = ExamGrade(score=10.0, max_score=10.0, percent=100, covered=["kp1", "kp2"], missed=[])
    points = [{"id": "kp1", "required": True}]
    capped = _enforce_required(g, points, max_score=10.0)
    assert capped.percent == 100
