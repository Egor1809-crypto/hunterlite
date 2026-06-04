"""widen client_profiles.lead_source 50→500

Reference personas (constructor rebuild) store a descriptive source sentence in
ClientProfile.lead_source (e.g. «пришёл по рекомендации знакомого, после
определения арбитражного суда о субсидиарке» = 86 chars), not just a short code
like "cold_base". The old varchar(50) raised StringDataRightTruncationError on
ClientProfile flush at session-start → poisoned the transaction → session ended
in `error` ("СВЯЗЬ ОБОРВАНА"). Widen the column so the source fits.

Revision ID: 20260604_001
Revises: 20260602_005
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260604_001"
down_revision: Union[str, None] = "20260602_005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "client_profiles",
        "lead_source",
        existing_type=sa.String(length=50),
        type_=sa.String(length=500),
        existing_nullable=False,
        existing_server_default=None,
    )


def downgrade() -> None:
    op.alter_column(
        "client_profiles",
        "lead_source",
        existing_type=sa.String(length=500),
        type_=sa.String(length=50),
        existing_nullable=False,
        existing_server_default=None,
    )
