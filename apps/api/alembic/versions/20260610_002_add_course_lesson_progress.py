"""add course_lesson_progress table

Backs the course progress / mini-check feature (see docs/courses/COURSE_PROGRESS_TZ.md).
One row per (user, course, lesson): attempts counter + completed_at (passed 3/3).

Revision ID: 20260610_002
Revises: 20260610_001
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260610_002"
down_revision: Union[str, None] = "20260610_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_lesson_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("course_slug", sa.String(length=64), nullable=False),
        sa.Column("lesson_index", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "course_slug", "lesson_index", name="uq_course_lesson_user"),
    )
    op.create_index(
        "ix_course_lesson_progress_user_id", "course_lesson_progress", ["user_id"]
    )
    op.create_index(
        "ix_course_lesson_progress_course_slug", "course_lesson_progress", ["course_slug"]
    )


def downgrade() -> None:
    op.drop_index("ix_course_lesson_progress_course_slug", table_name="course_lesson_progress")
    op.drop_index("ix_course_lesson_progress_user_id", table_name="course_lesson_progress")
    op.drop_table("course_lesson_progress")
