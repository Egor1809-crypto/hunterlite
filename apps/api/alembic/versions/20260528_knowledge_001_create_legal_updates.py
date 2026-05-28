"""Create legal_updates table for Knowledge Radar.

Revision ID: 20260528_knowledge_001
Revises: 20260527_001
Create Date: 2026-05-28
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260528_knowledge_001"
down_revision: Union[str, None] = "20260527_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        CREATE TABLE legal_updates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(500) NOT NULL,
            summary TEXT NOT NULL,
            source VARCHAR(100) NOT NULL,
            source_url VARCHAR(1000),
            category VARCHAR(100) NOT NULL,
            relevance_score FLOAT NOT NULL DEFAULT 0.5,
            published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            is_ai_generated BOOLEAN NOT NULL DEFAULT false,
            tags JSONB NOT NULL DEFAULT '[]'::jsonb,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX ix_legal_updates_published_at ON legal_updates (published_at DESC)"
    ))
    op.execute(sa.text(
        "CREATE INDEX ix_legal_updates_category ON legal_updates (category)"
    ))
    op.execute(sa.text(
        "CREATE INDEX ix_legal_updates_active_published ON legal_updates (is_active, published_at DESC)"
    ))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS legal_updates"))
