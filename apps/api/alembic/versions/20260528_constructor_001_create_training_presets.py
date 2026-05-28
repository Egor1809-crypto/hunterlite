"""create training_presets table

Revision ID: 20260528_constructor_001
Revises: 20260527_001
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "20260528_constructor_001"
down_revision = "20260527_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "training_presets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.String(80), unique=True, nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(60), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("icon_emoji", sa.String(10), nullable=False),
        sa.Column("archetype", sa.String(50), nullable=False),
        sa.Column("profession", sa.String(50), nullable=True),
        sa.Column("lead_source", sa.String(50), nullable=True),
        sa.Column("emotion_preset", sa.String(30), nullable=True),
        sa.Column("context_params", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("bg_noise", sa.String(20), nullable=True),
        sa.Column("learning_goals", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("tips", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("recommended_after_level", sa.Integer(), nullable=True),
        sa.Column("recommended_after_case", sa.String(80), nullable=True),
        sa.Column("related_knowledge_categories", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_training_preset_difficulty", "training_presets", ["difficulty"])
    op.create_index("idx_training_preset_category", "training_presets", ["category"])


def downgrade() -> None:
    op.drop_index("idx_training_preset_category", table_name="training_presets")
    op.drop_index("idx_training_preset_difficulty", table_name="training_presets")
    op.drop_table("training_presets")
