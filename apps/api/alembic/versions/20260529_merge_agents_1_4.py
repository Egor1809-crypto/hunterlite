"""Merge agents 1-4 migrations into single head.

Agents 1-4 worked in parallel, each creating a migration with
down_revision = "20260527_001". This merge revision unifies them.

Revision ID: 20260529_merge
Revises: 20260528_exam_001, 20260528_case_001, 20260528_knowledge_001, 20260528_constructor_001
Create Date: 2026-05-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260529_merge"
down_revision: Union[str, Sequence[str]] = (
    "20260528_exam_001",
    "20260528_case_001",
    "20260528_knowledge_001",
    "20260528_constructor_001",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
