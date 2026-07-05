"""add championship tables (championships, entries, winners)

Backs the championship/giveaway feature (see CHAMPIONSHIP_PLAN).
Three new tables: championships (one row per season), championship_entries
(participant progress / draw pool), championship_winners (rank → prize + ст.10.1
publication consent).

Revision ID: 20260610_001
Revises: 20260604_001
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260610_001"
down_revision: Union[str, None] = "20260604_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "championships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("season_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tally_starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="upcoming", nullable=False),
        sa.Column("winner_mode", sa.String(length=16), server_default="draw", nullable=False),
        sa.Column("prize_fund", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("number", name="uq_championship_number"),
    )

    op.create_table(
        "championship_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("championship_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="enrolled", nullable=False),
        sa.Column("score", sa.Float(), server_default="0", nullable=False),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["championship_id"], ["championships.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("championship_id", "user_id", name="uq_entry_championship_user"),
    )
    op.create_index(
        "ix_championship_entries_championship_id", "championship_entries", ["championship_id"]
    )
    op.create_index(
        "ix_championship_entries_user_id", "championship_entries", ["user_id"]
    )

    op.create_table(
        "championship_winners",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("championship_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("prize", sa.String(length=200), nullable=False),
        sa.Column("published_name", sa.String(length=200), nullable=True),
        sa.Column("publish_consent", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["championship_id"], ["championships.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("championship_id", "rank", name="uq_winner_championship_rank"),
    )
    op.create_index(
        "ix_championship_winners_championship_id", "championship_winners", ["championship_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_championship_winners_championship_id", table_name="championship_winners")
    op.drop_table("championship_winners")
    op.drop_index("ix_championship_entries_user_id", table_name="championship_entries")
    op.drop_index("ix_championship_entries_championship_id", table_name="championship_entries")
    op.drop_table("championship_entries")
    op.drop_table("championships")
