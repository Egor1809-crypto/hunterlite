"""drop training_presets table (constructor rebuild — presets removed)

Revision ID: 20260602_001
Revises: 20260531_003
Create Date: 2026-06-02

Constructor rebuild (CONSTRUCTOR_TZ §1.1): the preset subsystem is removed
entirely — only the free constructor remains. This drops the now-unused
``training_presets`` table. The historical create-migration
(20260528_constructor_001) is left untouched per policy; this is the forward
drop. ``downgrade`` recreates the table shape so the migration is reversible.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260602_001"
down_revision: Union[str, None] = "20260531_003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF EXISTS keeps the drop idempotent across partially-migrated envs.
    op.execute(sa.text("DROP TABLE IF EXISTS training_presets CASCADE"))


def downgrade() -> None:
    op.create_table(
        "training_presets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=60), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("icon_emoji", sa.String(length=10), nullable=False),
        sa.Column("archetype", sa.String(length=50), nullable=False),
        sa.Column("profession", sa.String(length=50), nullable=True),
        sa.Column("lead_source", sa.String(length=50), nullable=True),
        sa.Column("emotion_preset", sa.String(length=30), nullable=True),
        sa.Column("context_params", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("bg_noise", sa.String(length=20), nullable=True),
        sa.Column("learning_goals", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("tips", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("recommended_after_level", sa.Integer(), nullable=True),
        sa.Column("recommended_after_case", sa.String(length=80), nullable=True),
        sa.Column("related_knowledge_categories", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("slug", name="training_presets_slug_key"),
    )
    op.create_index("idx_training_preset_difficulty", "training_presets", ["difficulty"])
    op.create_index("idx_training_preset_category", "training_presets", ["category"])
