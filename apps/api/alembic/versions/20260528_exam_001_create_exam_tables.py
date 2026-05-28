"""create exam system tables

Revision ID: 20260528_exam_001
Revises: 20260527_001
Create Date: 2026-05-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260528_exam_001"
down_revision: Union[str, None] = "20260527_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "exam_definitions",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("categories", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("time_limit_minutes", sa.Integer(), nullable=False),
        sa.Column("pass_threshold", sa.Integer(), nullable=False, server_default=sa.text("88")),
        sa.Column("unlock_condition", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "exam_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("exam_id", sa.String(50), sa.ForeignKey("exam_definitions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("options", postgresql.JSONB(), nullable=False),
        sa.Column("correct_option_id", sa.String(10), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("article_reference", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_exam_questions_exam_id", "exam_questions", ["exam_id"])
    op.create_index("idx_exam_questions_category", "exam_questions", ["category"])

    op.create_table(
        "exam_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exam_id", sa.String(50), sa.ForeignKey("exam_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("time_spent_seconds", sa.Integer(), nullable=True),
        sa.Column("answers", postgresql.JSONB(), nullable=True),
        sa.Column("score_percent", sa.Integer(), nullable=True),
        sa.Column("correct_count", sa.Integer(), nullable=True),
        sa.Column("total_count", sa.Integer(), nullable=True),
        sa.Column("passed", sa.Boolean(), nullable=True),
        sa.Column("certificate_code", sa.String(100), nullable=True),
        sa.Column("question_ids", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_exam_attempts_user_exam", "exam_attempts", ["user_id", "exam_id"])
    op.execute(sa.text(
        "CREATE UNIQUE INDEX idx_exam_attempts_certificate_code "
        "ON exam_attempts (certificate_code) WHERE certificate_code IS NOT NULL"
    ))

    op.create_table(
        "exam_certificates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exam_id", sa.String(50), sa.ForeignKey("exam_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("certificate_code", sa.String(100), nullable=False, unique=True),
        sa.Column("score_percent", sa.Integer(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("user_name", sa.String(200), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("exam_certificates")
    op.drop_table("exam_attempts")
    op.drop_table("exam_questions")
    op.drop_table("exam_definitions")
