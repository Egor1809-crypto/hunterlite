from app.services.session_state import (
    is_call_like_mode,
    normalize_session_mode,
    normalize_session_outcome,
    validate_terminal_outcome,
)


def test_session_mode_contract():
    assert normalize_session_mode("chat") == "chat"
    assert normalize_session_mode("call") == "call"
    assert normalize_session_mode("center") == "center"
    assert normalize_session_mode("bad") is None


def test_center_is_call_like_for_prompting():
    assert is_call_like_mode("call") is True
    assert is_call_like_mode("center") is True
    assert is_call_like_mode("chat") is False


def test_center_terminal_outcome_guard():
    # Training-flow rework (2026-06-04): the sales deal/no-deal/continue split
    # is gone — a session ends with the single neutral ``completed`` outcome.
    assert validate_terminal_outcome(mode="center", outcome="completed") == (True, "completed")
    # Legacy sales strings still normalise to ``completed`` (back-compat) and
    # therefore still pass the center end-guard — an in-flight old client is
    # not rejected.
    assert validate_terminal_outcome(mode="center", outcome="agreed") == (True, "completed")
    assert validate_terminal_outcome(mode="center", outcome="not_agreed") == (True, "completed")
    assert validate_terminal_outcome(mode="center", outcome="continue") == (True, "completed")
    # A missing outcome still fails the center guard (something must be sent).
    assert validate_terminal_outcome(mode="center", outcome=None) == (False, None)


def test_non_center_terminal_outcome_is_not_blocking():
    assert validate_terminal_outcome(mode="call", outcome=None) == (True, None)
    # Legacy "continue later" collapses to the neutral ``completed`` outcome.
    assert normalize_session_outcome("continue later") == "completed"
    assert normalize_session_outcome("completed") == "completed"
