"""Regression fence for the 2026-06-04 training-flow rework (P1).

Customer decisions locked for this phase:
  (1) The sales deal-outcome dichotomy is gone — a consultation session ends
      with a single neutral terminal outcome ``completed``.
  (2) XP is no longer accrued / sent / displayed. The ``xp_*`` tables stay
      dormant (no migration), but nothing feeds them and ``calculate_xp``
      returns an all-zero breakdown.
  (3) Story-mode («звонки N/M» / consequences / promise fulfillment) is cut
      front AND back — the session-result projection no longer emits it.

Each test below fails on the pre-P1 code:
  * ``completed`` was not an accepted center terminal outcome (the guard only
    knew deal_agreed / deal_not_agreed / continue_next_call) → it would 400.
  * ``calculate_xp`` returned a non-zero ``grand_total`` for a good session.
  * ``get_session_result`` populated ``story`` / ``story_calls`` /
    ``promise_fulfillment`` from ``_load_story_context``.

These are unit-level (no DB) so they run in the blocking CI scope.
"""
from __future__ import annotations

import ast
import inspect
from types import SimpleNamespace

from app.api import training as training_api
from app.services.manager_progress import ManagerProgressService, XPBreakdown
from app.services.runtime_guard_engine import (
    GUARD_TERMINAL_OUTCOME_REQUIRED,
    evaluate_end_guards,
)
from app.services.session_state import (
    normalize_session_outcome,
    validate_terminal_outcome,
)


# ──────────────────────────────────────────────────────────────────────────
# Decision (1): single neutral terminal outcome ``completed``
# ──────────────────────────────────────────────────────────────────────────


def test_completed_passes_center_end_guard():
    """A center session ending with the neutral ``completed`` outcome must
    NOT raise the ``terminal_outcome_required`` guard.

    Pre-P1 this 400-ed: ``completed`` was not in ``CENTER_TERMINAL_OUTCOMES``
    (only deal_agreed / deal_not_agreed / continue_next_call were), so the
    de-gamified single «Завершить разговор» button would have failed end.
    """
    violations = evaluate_end_guards(mode="center", raw_outcome="completed")
    assert violations == []


def test_completed_normalizes_and_validates_as_terminal():
    ok, normalized = validate_terminal_outcome(mode="center", outcome="completed")
    assert ok is True
    assert normalized == "completed"
    assert normalize_session_outcome("completed") == "completed"


def test_legacy_deal_strings_collapse_to_completed_and_pass_guard():
    """In-flight clients still sending the old sales strings must normalise to
    the neutral ``completed`` outcome and pass the center guard (back-compat),
    never re-introducing a deal/no-deal distinction."""
    for legacy in ("agreed", "not_agreed", "deal_agreed", "deal_not_agreed",
                   "continue", "continue_next_call"):
        assert normalize_session_outcome(legacy) == "completed"
        assert evaluate_end_guards(mode="center", raw_outcome=legacy) == []


def test_missing_outcome_still_fails_center_guard():
    """The guard must still fire when no outcome is supplied at all — the
    rework removes the deal split, it does not remove the requirement that a
    center session end with *some* terminal outcome."""
    violations = evaluate_end_guards(mode="center", raw_outcome=None)
    assert len(violations) == 1
    assert violations[0].code == GUARD_TERMINAL_OUTCOME_REQUIRED


# ──────────────────────────────────────────────────────────────────────────
# Decision (2): XP no longer accrued
# ──────────────────────────────────────────────────────────────────────────


def _good_session_stub() -> SimpleNamespace:
    """A high-scoring, deal-outcome, chain-completed, comeback session — the
    exact shape that, under the pre-P1 formula, awarded a large XP total.

    ``calculate_xp`` is a pure staticmethod that only reads these attributes,
    so a namespace stub keeps the test DB-free and in the blocking scope.
    """
    return SimpleNamespace(
        score_total=90,
        difficulty=3,
        outcome="deal",
        traps_dodged=5,
        traps_fell=0,
        chain_completed=True,
        had_comeback=True,
        duration_seconds=600,
    )


def test_calculate_xp_returns_all_zero_breakdown():
    """XP is disabled: even a perfect deal session earns nothing.

    Pre-P1 this same stub produced a non-zero ``grand_total`` (base 90 +
    difficulty + outcome 30 + traps + chain 20 + comeback 15 + time), so the
    assertion below fails on the old code — proving the regression is caught.
    """
    breakdown = ManagerProgressService.calculate_xp(_good_session_stub())
    assert isinstance(breakdown, XPBreakdown)
    assert breakdown.grand_total == 0
    assert breakdown.session_total == 0
    assert breakdown.achievements == 0
    assert breakdown.base == 0
    assert breakdown.outcome == 0


def test_xp_breakdown_default_shape_is_intact():
    """The schema/frontend still read ``xp_breakdown.grand_total`` etc., so the
    fields must exist (all zero) rather than be removed — no KeyError / None
    blow-ups downstream."""
    breakdown = XPBreakdown()
    for field in ("base", "difficulty", "outcome", "traps", "chain",
                  "comeback", "time", "session_total", "achievements",
                  "grand_total"):
        assert getattr(breakdown, field) == 0


# ──────────────────────────────────────────────────────────────────────────
# Decision (3): story-mode cut from the session-result projection
# ──────────────────────────────────────────────────────────────────────────
#
# The behavioural read-path lives in ``_build_session_result``. A full
# DB-backed call would require constructing a TrainingSession with a
# client_story_id plus a sibling ClientStory and its calls just to observe
# the projection — heavy and brittle. The contract we must fence is narrow
# and unambiguous, so we assert it at source level on the actual function
# body (the same AST-guard style the client-domain invariants use). These
# fail on pre-P1 code, where ``_build_session_result`` called
# ``_load_story_context`` and returned ``story=story`` / ``story_calls=...``.


def _build_session_result_tree() -> ast.FunctionDef:
    src = inspect.getsource(training_api._build_session_result)
    return ast.parse(src).body[0]


def test_result_projection_does_not_load_story_context():
    """``_build_session_result`` must no longer call ``_load_story_context`` —
    the de-gamified result has no story surface for old or new sessions."""
    tree = _build_session_result_tree()
    called = {
        node.func.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    assert "_load_story_context" not in called


def test_result_projection_emits_no_story_or_promises():
    """The ``SessionResultResponse(...)`` constructed by the result projection
    must hard-set story=None, story_calls=[], promise_fulfillment=None — not
    populate them from story context."""
    tree = _build_session_result_tree()

    target: ast.Call | None = None
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "SessionResultResponse"
        ):
            target = node
            break
    assert target is not None, "SessionResultResponse(...) not found in projection"

    kwargs = {kw.arg: kw.value for kw in target.keywords}

    # story=None
    assert isinstance(kwargs.get("story"), ast.Constant)
    assert kwargs["story"].value is None
    # story_calls=[]
    assert isinstance(kwargs.get("story_calls"), ast.List)
    assert kwargs["story_calls"].elts == []
    # promise_fulfillment=None
    assert isinstance(kwargs.get("promise_fulfillment"), ast.Constant)
    assert kwargs["promise_fulfillment"].value is None
