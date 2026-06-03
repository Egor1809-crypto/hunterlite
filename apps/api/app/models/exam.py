from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExamDefinition(Base):
    __tablename__ = "exam_definitions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    categories: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    pass_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=88)
    unlock_condition: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # TZ-4 exam-rebuild: each exam carries its own mechanic + an item blueprint.
    # `mechanic` is the dominant interaction (hard_mcq | sequencing | matching |
    # case_analysis | document_drafting | multi_step). `blueprint` describes how
    # `POST /{id}/start` assembles `exam_item[]` for the attempt, e.g.
    #   {"items": [{"type": "case_analysis", "count": 3}], "shuffle": false}
    # The runtime path is item-driven (ExamItem): `start` assembles the attempt
    # from this exam's ExamItem rows per the blueprint. The legacy ExamQuestion
    # bank survives in the DB as the `mcq` source to be progressively absorbed
    # into ExamItem (DECISION-A), but it is NOT auto-read at runtime — every
    # active exam must seed ExamItem rows (an empty blueprint just means "use all
    # active ExamItem rows in order").
    mechanic: Mapped[str] = mapped_column(String(40), nullable=False, default="mcq")
    blueprint: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    exam_id: Mapped[str | None] = mapped_column(
        String(50),
        ForeignKey("exam_definitions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSONB, nullable=False)
    correct_option_id: Mapped[str] = mapped_column(String(10), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    article_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    exam_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("exam_definitions.id", ondelete="CASCADE"),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    score_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    correct_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    certificate_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    question_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # TZ-4 exam-rebuild: weighted scoring. `score_percent` above stays the
    # canonical 0..100 result (= round(weighted_score / max_weighted_score * 100))
    # so the legacy MCQ path and the certificate are unchanged; these two columns
    # keep the raw point sums for the per-item breakdown and for re-deriving the
    # percent on a regrade without re-reading every item.
    weighted_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_weighted_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # `complete` once every item (rule + AI) has a final grade. `pending` when at
    # least one AI item could not be graded (navy down / parse fail) — the policy
    # is: NO certificate while pending, the attempt is regradable. Legacy MCQ
    # attempts are always `complete`.
    grading_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="complete",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_exam_attempts_user_exam", "user_id", "exam_id"),
        Index(
            "idx_exam_attempts_certificate_code",
            "certificate_code",
            unique=True,
            postgresql_where=certificate_code.isnot(None),
        ),
    )


class ExamCertificate(Base):
    __tablename__ = "exam_certificates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    exam_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("exam_definitions.id", ondelete="CASCADE"),
        nullable=False,
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exam_attempts.id", ondelete="CASCADE"),
        nullable=False,
    )
    certificate_code: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True,
    )
    score_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    user_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # One certificate per attempt — DB-enforced so two concurrent submits/
    # regrades on the same attempt cannot issue two certificate rows (the loser
    # of the race hits this constraint; the API also row-locks the attempt).
    __table_args__ = (
        Index("idx_exam_certificates_attempt_unique", "attempt_id", unique=True),
    )


# ── TZ-4 exam-rebuild: own learning-content DB (independent of ExamQuestion) ──
#
# `exam_item` holds the rich, per-exam item bank that powers the 5 distinct
# mechanics. It is deliberately NOT coupled to the quiz/knowledge subsystem
# (that layer is product garbage per the keep/delete boundary) nor forced to
# replace ExamQuestion (which survives as the `mcq` bridge — DECISION-A).
#
# Item types (`type`):
#   mcq               — single correct option (rule-graded)
#   multi_select      — set of correct options (rule-graded, Jaccard/exact)
#   sequencing        — order a list of steps (rule-graded, position match)
#   matching          — pair left↔right (rule-graded, pair match)
#   numeric           — a number/date with tolerance (rule-graded)
#   case_analysis     — free-text legal analysis (AI-graded vs rubric)
#   document_drafting — draft a real document (AI-graded vs rubric)
#   multi_step        — capstone free-text answer to a multi-part fact pattern.
#                       Graded HOLISTICALLY by the AI grader against a single
#                       rubric whose key_points must cover every sub-step listed
#                       in payload.steps (there is no separate per-sub-step
#                       grader — the rubric is the contract).
_RULE_ITEM_TYPES = frozenset(
    {"mcq", "multi_select", "sequencing", "matching", "numeric"}
)
_AI_ITEM_TYPES = frozenset({"case_analysis", "document_drafting", "multi_step"})


class ExamItem(Base):
    __tablename__ = "exam_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    exam_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("exam_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # `payload` is type-specific public data sent to the player: MCQ options,
    # matching pairs (left/right pools), sequencing steps, the fact-pattern for a
    # case, numeric unit/format hints, sub-step specs for multi_step. NEVER put
    # the answer here — it must not leak to the client (see api `_public_item`).
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # `answer_key` is the rule-grader key (correct option id(s), ordered list,
    # pair map, {value, tolerance}). For AI items it may hold reference
    # key_points/weights consumed by the rubric; it is server-side only.
    answer_key: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # `rubric` drives AI grading: {key_points:[{id,text,weight,required?}], ...}.
    # Null for pure rule items.
    rubric: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # RAG chunk ids / law-article hints to ground the AI grader (anti-hallucination).
    rag_chunk_refs: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    article_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    explanation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_exam_items_exam_order", "exam_id", "order_index"),
    )

    @property
    def is_ai_graded(self) -> bool:
        return self.type in _AI_ITEM_TYPES


class ExamItemAttempt(Base):
    __tablename__ = "exam_item_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exam_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exam_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    raw_answer: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    max_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # {covered:[...], missed:[...], feedback:"..."} for AI items; null for rule.
    ai_feedback: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # `rule` | `ai` | `pending` (AI grade not yet obtained / failed).
    graded_by: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="rule",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    __table_args__ = (
        Index(
            "idx_exam_item_attempts_attempt_item",
            "attempt_id",
            "item_id",
            unique=True,
        ),
    )
