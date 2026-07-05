"""TZ-4 exam-rebuild: own learning-content DB (exam_item / exam_item_attempt)

Revision ID: 20260602_exam_001
Revises: 20260602_003
Create Date: 2026-06-02

Adds the exam-rebuild schema described in EXAM_TZ §2:

  * exam_definitions       += mechanic, blueprint
  * exam_attempts          += weighted_score, max_weighted_score, grading_status
  * exam_items             (new) — per-exam rich item bank (5 mechanics)
  * exam_item_attempts     (new) — per-item result inside an attempt

Independent of the quiz/knowledge subsystem and of the legacy ExamQuestion
bank (which survives as the `mcq` bridge — DECISION-A). All raw SQL wrapped
in sa.text() per CLAUDE.md §4.3; existing rows get safe server_defaults so
the upgrade is non-destructive.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260602_exam_001"
down_revision: Union[str, None] = "20260602_003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── exam_definitions: mechanic + blueprint ──────────────────────────────
    op.add_column(
        "exam_definitions",
        sa.Column(
            "mechanic", sa.String(length=40), nullable=False,
            server_default=sa.text("'mcq'"),
        ),
    )
    op.add_column(
        "exam_definitions",
        sa.Column(
            "blueprint", postgresql.JSONB, nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    # ── exam_attempts: weighted scoring + grading status ────────────────────
    op.add_column(
        "exam_attempts",
        sa.Column("weighted_score", sa.Float, nullable=True),
    )
    op.add_column(
        "exam_attempts",
        sa.Column("max_weighted_score", sa.Float, nullable=True),
    )
    op.add_column(
        "exam_attempts",
        sa.Column(
            "grading_status", sa.String(length=20), nullable=False,
            server_default=sa.text("'complete'"),
        ),
    )

    # ── exam_items (new) ────────────────────────────────────────────────────
    op.create_table(
        "exam_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "exam_id", sa.String(length=50),
            sa.ForeignKey("exam_definitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("prompt", sa.Text, nullable=False),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("answer_key", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("rubric", postgresql.JSONB, nullable=True),
        sa.Column("points", sa.Integer, nullable=False, server_default=sa.text("1")),
        sa.Column("rag_chunk_refs", postgresql.JSONB, nullable=True),
        sa.Column("difficulty", sa.Integer, nullable=False, server_default=sa.text("1")),
        sa.Column("article_reference", sa.String(length=200), nullable=True),
        sa.Column("explanation", sa.Text, nullable=False, server_default=sa.text("''")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "idx_exam_items_exam_order", "exam_items", ["exam_id", "order_index"],
    )

    # ── exam_item_attempts (new) ────────────────────────────────────────────
    op.create_table(
        "exam_item_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "attempt_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("exam_attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "item_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("exam_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("raw_answer", postgresql.JSONB, nullable=True),
        sa.Column("score", sa.Float, nullable=False, server_default=sa.text("0")),
        sa.Column("max_score", sa.Float, nullable=False, server_default=sa.text("0")),
        sa.Column("passed", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("ai_feedback", postgresql.JSONB, nullable=True),
        sa.Column("graded_by", sa.String(length=10), nullable=False, server_default=sa.text("'rule'")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("idx_exam_item_attempts_attempt", "exam_item_attempts", ["attempt_id"])
    op.create_index("idx_exam_item_attempts_item", "exam_item_attempts", ["item_id"])
    op.create_index(
        "idx_exam_item_attempts_attempt_item",
        "exam_item_attempts",
        ["attempt_id", "item_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_exam_item_attempts_attempt_item", table_name="exam_item_attempts")
    op.drop_index("idx_exam_item_attempts_item", table_name="exam_item_attempts")
    op.drop_index("idx_exam_item_attempts_attempt", table_name="exam_item_attempts")
    op.drop_table("exam_item_attempts")
    op.drop_index("idx_exam_items_exam_order", table_name="exam_items")
    op.drop_table("exam_items")
    op.drop_column("exam_attempts", "grading_status")
    op.drop_column("exam_attempts", "max_weighted_score")
    op.drop_column("exam_attempts", "weighted_score")
    op.drop_column("exam_definitions", "blueprint")
    op.drop_column("exam_definitions", "mechanic")
