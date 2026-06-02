"""add two-stage (decision tree + chronology) columns to case tables

Revision ID: 20260531_003
Revises: 20260531_002
Create Date: 2026-05-31

Adds stage1/stage2 JSONB payloads to case_scenarios and the matching
per-attempt tracking columns. Old columns (steps, optimal_path) are left
in place to avoid breaking existing rows; the new BFL cases use stage1/stage2.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260531_003"
down_revision: Union[str, None] = "20260531_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "case_scenarios",
        sa.Column("stage1", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "case_scenarios",
        sa.Column("stage2", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "case_attempts",
        sa.Column("stage1_answers", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "case_attempts",
        sa.Column("stage2_order", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "case_attempts",
        sa.Column("stage1_score", sa.Integer, nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "case_attempts",
        sa.Column("stage2_score", sa.Integer, nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("case_attempts", "stage2_score")
    op.drop_column("case_attempts", "stage1_score")
    op.drop_column("case_attempts", "stage2_order")
    op.drop_column("case_attempts", "stage1_answers")
    op.drop_column("case_scenarios", "stage2")
    op.drop_column("case_scenarios", "stage1")
