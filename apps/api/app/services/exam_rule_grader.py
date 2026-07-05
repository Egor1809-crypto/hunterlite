"""Deterministic (rule-based) grading for non-AI exam item types.

EXAM_TZ §3/§5: mcq, multi_select, numeric, sequencing, matching
are graded synchronously and deterministically here — no LLM. Each grader takes
the item's ``answer_key`` + the user's ``raw_answer`` and returns a partial
0..points score so weighted scoring (sum(score)/sum(max)) works uniformly with
the AI graders.

Pure functions, no I/O — unit-tested in tests/test_exam_rule_grader.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Item types graded here (everything that is NOT free-text / AI-graded).
RULE_TYPES = frozenset({"mcq", "multi_select", "numeric", "sequencing", "matching"})


@dataclass(frozen=True)
class RuleGrade:
    score: float
    max_score: float
    passed: bool
    detail: dict = field(default_factory=dict)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def grade_mcq(answer_key: dict, raw_answer: Any, points: float) -> RuleGrade:
    correct = answer_key.get("correct_option_id")
    chosen = raw_answer if isinstance(raw_answer, str) else (raw_answer or {})
    ok = bool(correct) and chosen == correct
    return RuleGrade(points if ok else 0.0, points, ok, {"correct_option_id": correct, "chosen": chosen})


def grade_multi_select(answer_key: dict, raw_answer: Any, points: float) -> RuleGrade:
    correct = set(answer_key.get("correct_option_ids") or [])
    chosen = set(raw_answer or []) if isinstance(raw_answer, (list, set, tuple)) else set()
    if not correct:
        return RuleGrade(0.0, points, False, {"correct_option_ids": list(correct)})
    tp = len(correct & chosen)
    fp = len(chosen - correct)
    # reward true positives, penalise false positives, never below 0
    frac = _clamp((tp - fp) / len(correct), 0.0, 1.0)
    score = round(points * frac, 2)
    return RuleGrade(score, points, score == points, {"correct_option_ids": sorted(correct), "chosen": sorted(chosen)})


def grade_numeric(answer_key: dict, raw_answer: Any, points: float) -> RuleGrade:
    target = answer_key.get("value")
    tol = float(answer_key.get("tolerance", 0) or 0)
    try:
        # Accept "30", "30 дней", 30, 30.0
        if isinstance(raw_answer, str):
            cleaned = raw_answer.replace(",", ".").strip().split()[0]
            user = float(cleaned)
        else:
            user = float(raw_answer)
    except (TypeError, ValueError, IndexError):
        return RuleGrade(0.0, points, False, {"value": target, "parsed": None})
    ok = target is not None and abs(user - float(target)) <= tol
    return RuleGrade(points if ok else 0.0, points, ok, {"value": target, "parsed": user, "tolerance": tol})


def grade_sequencing(answer_key: dict, raw_answer: Any, points: float) -> RuleGrade:
    correct = list(answer_key.get("order") or [])
    user = list(raw_answer or []) if isinstance(raw_answer, (list, tuple)) else []
    if not correct:
        return RuleGrade(0.0, points, False, {"order": correct})
    matches = sum(1 for i, sid in enumerate(correct) if i < len(user) and user[i] == sid)
    frac = matches / len(correct)
    score = round(points * frac, 2)
    return RuleGrade(score, points, matches == len(correct), {"order": correct, "user_order": user, "matched": matches})


def grade_matching(answer_key: dict, raw_answer: Any, points: float) -> RuleGrade:
    pairs = dict(answer_key.get("pairs") or {})
    user = dict(raw_answer or {}) if isinstance(raw_answer, dict) else {}
    if not pairs:
        return RuleGrade(0.0, points, False, {"pairs": pairs})
    correct = sum(1 for left, right in pairs.items() if user.get(left) == right)
    frac = correct / len(pairs)
    score = round(points * frac, 2)
    return RuleGrade(score, points, correct == len(pairs), {"pairs": pairs, "user_pairs": user, "matched": correct})


_DISPATCH = {
    "mcq": grade_mcq,
    "multi_select": grade_multi_select,
    "numeric": grade_numeric,
    "sequencing": grade_sequencing,
    "matching": grade_matching,
}


def grade_rule_item(item_type: str, answer_key: dict, raw_answer: Any, points: float) -> RuleGrade:
    """Dispatch to the grader for ``item_type``. Unknown type → zero (defensive)."""
    fn = _DISPATCH.get(item_type)
    if fn is None:
        return RuleGrade(0.0, float(points), False, {"error": f"unknown rule type {item_type}"})
    return fn(answer_key or {}, raw_answer, float(points))
