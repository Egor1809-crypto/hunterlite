"""add auditable external qualification grants for tech-pravo campaigns

Revision ID: 20260819_tp_bridge_001
Revises: 20260705_champ_001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260819_tp_bridge_001"
down_revision: str | None = "20260705_champ_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "championship_external_grants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("championship_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_system", sa.String(length=64), nullable=False),
        sa.Column("external_ref", sa.String(length=128), nullable=False),
        sa.Column("audience", sa.String(length=64), nullable=True),
        sa.Column("quiz_result", sa.String(length=64), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["championship_id"], ["championships.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_system", "external_ref", name="uq_champ_external_grant_ref"),
        sa.UniqueConstraint("championship_id", "user_id", name="uq_champ_external_grant_user"),
    )
    op.create_index(
        "ix_champ_external_grant_championship",
        "championship_external_grants",
        ["championship_id"],
    )
    op.create_index("ix_champ_external_grant_user", "championship_external_grants", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_champ_external_grant_user", table_name="championship_external_grants")
    op.drop_index("ix_champ_external_grant_championship", table_name="championship_external_grants")
    op.drop_table("championship_external_grants")
