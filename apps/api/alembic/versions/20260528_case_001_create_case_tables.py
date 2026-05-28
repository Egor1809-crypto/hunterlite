"""create case_scenarios, case_attempts, case_progress tables

Revision ID: 20260528_case_001
Revises: 20260527_001
Create Date: 2026-05-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260528_case_001"
down_revision: Union[str, None] = "20260527_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "case_scenarios",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("difficulty", sa.Integer, nullable=False),
        sa.Column("category", sa.String(128), nullable=False),
        sa.Column("estimated_minutes", sa.Integer, nullable=False),
        sa.Column("max_score", sa.Integer, nullable=False, server_default=sa.text("100")),
        sa.Column("optimal_path", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("expert_analysis", sa.Text, nullable=False, server_default=sa.text("''")),
        sa.Column("steps", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("order_index", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "case_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "case_id",
            sa.String(32),
            sa.ForeignKey("case_scenarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("choices_made", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("revealed_facts", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("score", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("score_percent", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("completed", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_case_attempts_user_case", "case_attempts", ["user_id", "case_id"])
    op.create_index("idx_case_attempts_user_completed", "case_attempts", ["user_id", "completed"])

    op.create_table(
        "case_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("completed_cases", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("best_scores", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("total_attempts", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("average_score", sa.Float, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("case_progress")
    op.drop_index("idx_case_attempts_user_completed", table_name="case_attempts")
    op.drop_index("idx_case_attempts_user_case", table_name="case_attempts")
    op.drop_table("case_attempts")
    op.drop_table("case_scenarios")
