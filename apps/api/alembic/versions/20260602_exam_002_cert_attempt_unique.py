"""TZ-4 exam hardening: one certificate per attempt (unique index)

Revision ID: 20260602_exam_002
Revises: 20260602_exam_001
Create Date: 2026-06-02

Guards against a concurrent submit/regrade race issuing two ExamCertificate
rows for the same attempt. Dedup-safe: any pre-existing duplicates (keep the
most recently issued) are collapsed before the unique index is created, so the
migration cannot fail on legacy data. Raw SQL wrapped in sa.text (CLAUDE.md §4.3).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260602_exam_002"
down_revision: Union[str, None] = "20260602_exam_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    # Collapse any duplicate certs per attempt, keeping the latest issued_at
    # (ties broken by id). Safe no-op when there are no duplicates.
    bind.execute(sa.text(
        """
        DELETE FROM exam_certificates ec
        USING (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY attempt_id
                       ORDER BY issued_at DESC, id DESC
                   ) AS rn
            FROM exam_certificates
        ) d
        WHERE ec.id = d.id AND d.rn > 1
        """
    ))
    op.create_index(
        "idx_exam_certificates_attempt_unique",
        "exam_certificates",
        ["attempt_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_exam_certificates_attempt_unique", table_name="exam_certificates")
