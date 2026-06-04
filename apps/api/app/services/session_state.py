from __future__ import annotations


SESSION_MODES = {"chat", "call", "center"}
CALL_LIKE_MODES = {"call", "center"}

# Training-flow rework (2026-06-04): the sales "deal agreed / not agreed"
# dichotomy is gone. A consultation session now ends with a single neutral
# terminal outcome — ``completed``. The legacy deal-aliases are kept only
# so historical rows / in-flight clients that still send the old strings
# normalise to the neutral outcome instead of 400-ing the end-guard.
NEUTRAL_TERMINAL_OUTCOME = "completed"

CENTER_TERMINAL_OUTCOMES = {
    "completed",
    # Legacy sales outcomes — accepted for backward compatibility so an
    # in-flight client sending an old value does not fail the end-guard.
    # New frontend sends only ``completed``.
    "deal_agreed",
    "deal_not_agreed",
    "continue_next_call",
}

OUTCOME_ALIASES = {
    # Legacy sales outcomes collapse to the neutral ``completed`` outcome.
    # The training flow no longer distinguishes "deal" from "no deal".
    "agreed": "completed",
    "contract_agreed": "completed",
    "contract_signed": "completed",
    "deal_agreed": "completed",
    "not_agreed": "completed",
    "contract_not_agreed": "completed",
    "rejected": "completed",
    "deal_not_agreed": "completed",
    "continue": "completed",
    "continue_in_next_call": "completed",
    "continue_later": "completed",
    "continue_next_call": "completed",
    "needs_follow_up": "needs_followup",
}


def normalize_session_mode(mode: object) -> str | None:
    if mode is None:
        return None
    normalized = str(mode).strip().lower().replace(" ", "_")
    return normalized if normalized in SESSION_MODES else None


def is_call_like_mode(mode: object) -> bool:
    return normalize_session_mode(mode) in CALL_LIKE_MODES


def normalize_session_outcome(outcome: object) -> str | None:
    if outcome is None:
        return None
    normalized = str(outcome).strip().lower().replace(" ", "_")
    if not normalized or normalized == "unknown":
        return None
    return OUTCOME_ALIASES.get(normalized, normalized)


def validate_terminal_outcome(*, mode: object, outcome: object) -> tuple[bool, str | None]:
    normalized_mode = normalize_session_mode(mode)
    normalized_outcome = normalize_session_outcome(outcome)
    if normalized_mode != "center":
        return True, normalized_outcome
    return normalized_outcome in CENTER_TERMINAL_OUTCOMES, normalized_outcome
