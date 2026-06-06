"""Regression tests for async-results deferred scoring (2026-06-06).

Context
-------
The REST ``/training/sessions/{id}/end`` and the WS ``session.end`` handler
used to run the full ~16s scoring pipeline (``calculate_scores`` →
enrichment → ``generate_recommendations``) SYNCHRONOUSLY before returning
control to the frontend, so the user stared at the "Тренировка завершена /
Переход к результатам" modal for ~20s. Scoring is now DEFERRED to
``_score_session_background``: the session is finalized fast
(``status=completed``) and control is returned immediately; the /results
page polls until ``score_total`` is populated.

These tests fence the contract that broke twice in review:

1. ``_score_session_background`` is callable with the WS ARITY
   (``session_id, state``) — the WS path passes a state snapshot, the REST
   path passes one positional arg (``state`` defaults to ``None``). A 1-arg
   signature would raise ``TypeError`` inside the detached task and silently
   never score WS-ended sessions (the dominant terminal path).

2. After the fast finalize, the session is ``status=completed`` IMMEDIATELY
   (score_total still NULL, ``_scoring_pending`` flag set), and calling
   ``_score_session_background`` on that completed session afterwards fills
   in ``score_total`` (non-NULL) and clears the pending flag — i.e. the
   "fast finalize, score later" split actually works.

3. The deferred scorer EMITS ``training_completed`` (CLAUDE.md §3) exactly
   ONCE, with the real score in the payload (not score=0 emitted prematurely
   on the request path), under the idempotency_key
   ``training_completed:{session_id}`` so REST + WS collapse to one row.

4. Scoring runs at most ONCE per session: a second invocation
   short-circuits on the already-populated ``score_total`` (the cross-path
   REST/WS guard) and does not re-emit ``training_completed``.

The scoring engine, recommendations LLM, and the heavy XP/RAG enrichment
are stubbed so the test is hermetic and deterministic — the unit under test
is the orchestration in ``_score_session_background`` (arity, idempotency,
event emission, pending-flag lifecycle), not the scoring math (covered by
``test_scoring*.py``).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.outbox import OutboxEvent
from app.models.scenario import Scenario, ScenarioType
from app.models.training import (
    Message,
    MessageRole,
    SessionStatus,
    TrainingSession,
)
from app.models.user import User


# ── Deterministic stand-in for the scoring engine ─────────────────────────
@dataclass
class _StubScores:
    """Minimal ScoreBreakdown-shaped object the orchestrator consumes."""

    script_adherence: float = 14.0
    objection_handling: float = 9.0
    communication: float = 8.0
    anti_patterns: float = 0.0
    result: float = 12.0
    legal_accuracy: float = 11.0
    total: float = 73.0
    details: dict = field(
        default_factory=lambda: {
            "legal_accuracy": {
                "weak_categories": [
                    {
                        "category": "reabilitatsiya",
                        "display_name": "Реабилитационные процедуры",
                        "article_refs": ["127-ФЗ ст. 213.2"],
                    }
                ],
            }
        }
    )

    @property
    def skill_radar(self) -> dict:
        return {"knowledge": 60.0, "communication": 55.0}


@pytest.fixture
def _patch_background_scoring(monkeypatch, db_engine):
    """Patch the heavy collaborators of ``_score_session_background`` so the
    orchestration runs hermetically against the in-memory test DB.

    * ``app.database.async_session`` → a sessionmaker bound to the test
      engine (the helper opens its OWN session via this symbol).
    * ``calculate_scores`` / ``generate_recommendations`` → deterministic
      stubs (no DeepSeek network calls).
    * ``apply_post_finalize_enrichment`` → no-op returning a stable dict
      (the real one touches ManagerProgress / RAG which need Redis).
    """
    import app.database as _db_mod
    import app.api.training as _training_mod
    import app.services.runtime_finalizer as _finalizer_mod

    test_sessionmaker = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    monkeypatch.setattr(_db_mod, "async_session", test_sessionmaker)

    async def _fake_calculate_scores(session_id, db):  # noqa: ANN001
        return _StubScores()

    async def _fake_generate_recommendations(session_id, db, scores):  # noqa: ANN001
        return "Рекомендации: уточните сумму долга и доход клиента."

    async def _fake_enrichment(db, *, session, scores, state=None):  # noqa: ANN001
        return {
            "session_history_created": True,
            "xp_earned": 42,
            "coach_report_generated": False,
            "rag_feedback_count": 0,
            "mp_result": None,
        }

    monkeypatch.setattr(_training_mod, "calculate_scores", _fake_calculate_scores)
    monkeypatch.setattr(
        _training_mod, "generate_recommendations", _fake_generate_recommendations
    )
    monkeypatch.setattr(
        _finalizer_mod, "apply_post_finalize_enrichment", _fake_enrichment
    )
    return test_sessionmaker


async def _seed_completed_session(
    db: AsyncSession, *, score_total=None, scoring_pending=True
) -> tuple[User, TrainingSession]:
    """Create a user + completed session shaped like the fast-finalize state:
    status=completed, score_total NULL, _scoring_pending flag set."""
    user = User(
        id=uuid.uuid4(),
        email=f"async-results-{uuid.uuid4().hex[:8]}@hunter888.test",
        full_name="Тест Консультант",
        hashed_password="$2b$12$placeholder",
        role="manager",
    )
    scenario = Scenario(
        id=uuid.uuid4(),
        title="Юр-консультация ФЗ-127",
        description="Должник с долгами по кредитам.",
        scenario_type=ScenarioType.consultation,
    )
    session = TrainingSession(
        id=uuid.uuid4(),
        user_id=user.id,
        scenario_id=scenario.id,
        status=SessionStatus.completed,
        started_at=datetime.now(timezone.utc),
        ended_at=datetime.now(timezone.utc),
        duration_seconds=120,
        score_total=score_total,
        emotion_timeline=[{"state": "cold"}, {"state": "considering"}],
        scoring_details={"_scoring_pending": scoring_pending} if scoring_pending else {},
    )
    msgs = [
        Message(
            id=uuid.uuid4(),
            session_id=session.id,
            role=MessageRole.assistant,
            content="Боюсь, у меня отнимут квартиру.",
            sequence_number=1,
        ),
        Message(
            id=uuid.uuid4(),
            session_id=session.id,
            role=MessageRole.user,
            content="Понимаю. Расскажите про сумму долга и доход.",
            sequence_number=2,
        ),
    ]
    db.add_all([user, scenario, session, *msgs])
    await db.commit()
    return user, session


@pytest.mark.asyncio
async def test_fast_finalize_then_background_scoring_populates_score(
    db_session, _patch_background_scoring
):
    """The split works: a session is completed FAST (score_total NULL,
    _scoring_pending=True), and running _score_session_background afterwards
    fills score_total (non-NULL) and clears the pending flag."""
    from app.api.training import _score_session_background

    user, session = await _seed_completed_session(db_session)

    # Pre-condition: finalized fast — completed but NOT yet scored.
    assert session.status == SessionStatus.completed
    assert session.score_total is None
    assert (session.scoring_details or {}).get("_scoring_pending") is True

    # Deferred scoring (REST arity — single positional arg, state defaults None).
    await _score_session_background(session.id)

    # Re-read from a fresh session bound to the same engine (the helper used
    # its own session + committed).
    sm = _patch_background_scoring
    async with sm() as verify_db:
        refreshed = (
            await verify_db.execute(
                select(TrainingSession).where(TrainingSession.id == session.id)
            )
        ).scalar_one()
        assert refreshed.score_total is not None, (
            "Background scorer did not populate score_total — /results would "
            "poll forever on the 'Разбор готовится' placeholder."
        )
        assert float(refreshed.score_total) == pytest.approx(73.0)
        assert refreshed.feedback_text  # recommendations landed
        # Pending flag cleared so the FE poller stops.
        assert (refreshed.scoring_details or {}).get("_scoring_pending") is False


@pytest.mark.asyncio
async def test_background_scorer_accepts_ws_arity_and_consumes_state(
    db_session, _patch_background_scoring
):
    """The WS path calls _score_session_background(session_id, state_snapshot)
    with TWO args. A 1-arg signature would raise TypeError inside the detached
    task and silently never score WS-ended sessions. Assert the 2-arg call
    scores the session AND that the captured emotion-journey snapshot from
    ``state`` is persisted into scoring_details (WS-specific enrichment)."""
    from app.api.training import _score_session_background

    user, session = await _seed_completed_session(db_session)

    ws_state = {
        "user_id": user.id,
        "scenario_id": str(session.scenario_id),
        "archetype_code": "anxious_debtor",
        "base_difficulty": 6,
        "call_outcome": "completed",
        "_emotion_journey_snapshot": {
            "summary": {"peak_state": "considering", "total_transitions": 2},
            "timeline": [{"state": "cold"}, {"state": "considering"}],
        },
    }

    # WS arity: this must NOT raise TypeError.
    await _score_session_background(session.id, ws_state)

    sm = _patch_background_scoring
    async with sm() as verify_db:
        refreshed = (
            await verify_db.execute(
                select(TrainingSession).where(TrainingSession.id == session.id)
            )
        ).scalar_one()
        assert refreshed.score_total is not None
        journey = (refreshed.scoring_details or {}).get("_emotion_journey")
        assert journey is not None, "emotion-journey enrichment missing"
        assert journey["summary"]["peak_state"] == "considering", (
            "Background scorer ignored state['_emotion_journey_snapshot'] — the "
            "WS-captured snapshot was silently discarded."
        )


@pytest.mark.asyncio
async def test_background_scorer_emits_training_completed_once_with_real_score(
    db_session, _patch_background_scoring
):
    """training_completed (CLAUDE.md §3) is emitted by the DEFERRED scorer
    with the REAL score in the payload, exactly once, under the
    training_completed:{session_id} idempotency key."""
    from app.api.training import _score_session_background

    user, session = await _seed_completed_session(db_session)

    await _score_session_background(
        session.id, {"user_id": user.id, "scenario_id": str(session.scenario_id)}
    )

    sm = _patch_background_scoring
    async with sm() as verify_db:
        rows = (
            await verify_db.execute(
                select(OutboxEvent).where(
                    OutboxEvent.idempotency_key == f"training_completed:{session.id}"
                )
            )
        ).scalars().all()
        assert len(rows) == 1, (
            "Expected exactly one training_completed OutboxEvent for the "
            f"session, found {len(rows)} — §3 outbox contract broken."
        )
        ev = rows[0]
        assert ev.event_type == "training_completed"
        # Real score, NOT the premature score=0 the request path used to emit.
        assert float(ev.payload.get("score") or 0.0) == pytest.approx(73.0)
        # Weak ФЗ-127 categories carried for SRS seeding.
        weak = ev.payload.get("weak_legal_categories") or []
        assert weak and weak[0]["category"] == "reabilitatsiya", (
            "training_completed payload lost weak_legal_categories — SRS "
            "seeding for weak ФЗ-127 categories silently regresses."
        )


@pytest.mark.asyncio
async def test_background_scoring_is_idempotent_single_score(
    db_session, _patch_background_scoring
):
    """Scoring runs at most ONCE per session. An already-scored session
    short-circuits: a second invocation does not re-score nor re-emit
    training_completed (the cross-path REST/WS single-scoring guard)."""
    from app.api.training import _score_session_background

    user, session = await _seed_completed_session(db_session)

    # First run scores + emits.
    await _score_session_background(session.id)
    # Second run (e.g. the OTHER transport's detached task) must be a no-op.
    await _score_session_background(session.id)

    sm = _patch_background_scoring
    async with sm() as verify_db:
        rows = (
            await verify_db.execute(
                select(OutboxEvent).where(
                    OutboxEvent.idempotency_key == f"training_completed:{session.id}"
                )
            )
        ).scalars().all()
        assert len(rows) == 1, (
            "Second background scorer invocation re-emitted training_completed "
            "— scoring/emission is not single-per-session."
        )
        refreshed = (
            await verify_db.execute(
                select(TrainingSession).where(TrainingSession.id == session.id)
            )
        ).scalar_one()
        assert refreshed.score_total is not None
        assert (refreshed.scoring_details or {}).get("_scoring_pending") is False
