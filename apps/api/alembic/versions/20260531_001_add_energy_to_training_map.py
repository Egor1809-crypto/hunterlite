"""add energy column to training_map_progress

Revision ID: 20260531_001
Revises: b82d591e64a2
Create Date: 2026-05-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260531_001"
down_revision: Union[str, None] = "b82d591e64a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "training_map_progress",
        sa.Column(
            "energy",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("training_map_progress", "energy")
