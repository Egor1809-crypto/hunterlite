"""Server-owned daily usage and idempotent paid grants."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DailyAttempts(Base):
    __tablename__ = "daily_attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "day", name="uq_daily_attempts_user_day"),
        CheckConstraint(
            "free_remaining >= 0 AND paid_remaining >= 0", name="ck_daily_attempts_nonnegative"
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)
    free_remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=25)
    paid_remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    level_uses: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class AttemptPayment(Base):
    __tablename__ = "attempt_payments"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider_reference: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    amount_kopecks: Mapped[int] = mapped_column(Integer, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
