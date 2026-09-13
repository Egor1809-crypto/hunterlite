"""Common Moscow-day test attempts and paid confirmation ledger.
Revision ID: 20260913_attempts_001
Revises: 20260819_tp_bridge_001
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "20260913_attempts_001"
down_revision = "20260819_tp_bridge_001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "daily_attempts",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("free_remaining", sa.Integer(), nullable=False),
        sa.Column("paid_remaining", sa.Integer(), nullable=False),
        sa.Column("level_uses", pg.JSONB(), nullable=False),
        sa.UniqueConstraint("user_id", "day", name="uq_daily_attempts_user_day"),
        sa.CheckConstraint(
            "free_remaining >= 0 AND paid_remaining >= 0", name="ck_daily_attempts_nonnegative"
        ),
    )
    op.create_table(
        "attempt_payments",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider_reference", sa.String(255), nullable=False, unique=True),
        sa.Column("amount_kopecks", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column(
            "confirmed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade():
    op.drop_table("attempt_payments")
    op.drop_table("daily_attempts")
