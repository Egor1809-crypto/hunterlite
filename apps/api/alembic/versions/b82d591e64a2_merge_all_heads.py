"""merge_all_heads

Revision ID: b82d591e64a2
Revises: 20260507_003, 20260529_merge
Create Date: 2026-05-28 12:07:22.554319

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b82d591e64a2'
down_revision: Union[str, None] = ('20260507_003', '20260529_merge')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
