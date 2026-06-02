"""create reference_personas table (constructor rebuild — gold-standard debtor)

Revision ID: 20260602_002
Revises: 20260602_001
Create Date: 2026-06-02

CONSTRUCTOR_TZ §2 / DECISION-3: a dedicated table for the gold-standard
reference persona(s) — kept separate from user-owned ``custom_characters``.
Seeded by ``scripts/seed_reference_persona.py``.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260602_002"
down_revision: Union[str, None] = "20260602_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reference_personas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("archetype", sa.String(length=50), nullable=False),
        sa.Column("profession", sa.String(length=80), nullable=False),
        sa.Column("lead_source", sa.String(length=120), nullable=False),
        sa.Column("debt_stage", sa.String(length=120), nullable=True),
        sa.Column("debt_range", sa.String(length=120), nullable=True),
        sa.Column("family_preset", sa.String(length=80), nullable=True),
        sa.Column("creditors_preset", sa.String(length=80), nullable=True),
        sa.Column("property_preset", sa.String(length=200), nullable=True),
        sa.Column("emotion_preset", sa.String(length=80), nullable=True),
        sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("environment", sa.String(length=120), nullable=True),
        sa.Column("client_fatigue", sa.String(length=20), nullable=True),
        sa.Column("tone", sa.String(length=40), nullable=True),
        sa.Column("cached_dossier", sa.Text(), nullable=False, server_default=""),
        sa.Column("scoring_rubric", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("slug", name="reference_personas_slug_key"),
    )
    op.create_index("idx_reference_persona_archetype", "reference_personas", ["archetype"])


def downgrade() -> None:
    op.drop_index("idx_reference_persona_archetype", table_name="reference_personas")
    op.drop_table("reference_personas")
