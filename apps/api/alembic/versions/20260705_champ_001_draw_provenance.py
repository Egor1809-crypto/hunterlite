"""add draw provenance columns to championships (draw_verification, drawn_at)

Persists the external-randomizer (RANDOM.ORG) verification string and the draw
timestamp on the championship row, so a conducted draw is provably fair «by
click» — previously the verification was only logged. See conduct_draw.

Revision ID: 20260705_champ_001
Revises: 20260610_002
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260705_champ_001"
down_revision: Union[str, None] = "20260610_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "championships",
        sa.Column("draw_verification", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "championships",
        sa.Column("drawn_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("championships", "drawn_at")
    op.drop_column("championships", "draw_verification")
