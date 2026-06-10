"""Course lesson progress (Course Progress, Этап 1).

One row per (user, course, lesson). A lesson is *passed* when the user answers
its mini-check 3/3 (``completed_at`` set). ``attempts`` counts submits in the
current cycle — capped at 3; re-watching the lesson resets it. Progress % per
course = passed lessons / total lessons.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

MAX_ATTEMPTS = 3
PASS_THRESHOLD = 3  # of 3 questions — strict


class CourseLessonProgress(Base):
    __tablename__ = "course_lesson_progress"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "course_slug", "lesson_index", name="uq_course_lesson_user"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    lesson_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Submits in the current cycle (reset to 0 on re-watch). Capped at MAX_ATTEMPTS.
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    # Set when the user passed the mini-check 3/3 — the lesson is then «пройдено».
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
