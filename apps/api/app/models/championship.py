"""Championship / giveaway (чемпионат-розыгрыш) models.

Backs the Apple-style championship page (landing + platform) — see
docs/contest/CHAMPIONSHIP_PLAN.md. Three tables:

- ``championships``        — one row per season (sequential number, FSM status,
                             prize fund, winner-selection mode).
- ``championship_entries`` — a participant's progress against entry conditions;
                             qualified entries form the draw pool.
- ``championship_winners`` — the determined winners (rank → prize), with the
                             separate ст.10.1 152-ФЗ publication consent flag.

Winner selection: per the product decision the mechanic is a randomized draw
*among qualified participants* (``winner_mode='draw'``); the legally-safer
objective ranking is kept as a fallback (``winner_mode='ranking'``).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# ── enum-like string domains (kept as plain strings to avoid PG enum migrations) ──
SEASON_TYPES = ("winter_spring", "summer_autumn")
CHAMPIONSHIP_STATUSES = ("upcoming", "active", "tallying", "finished")
ENTRY_STATUSES = ("enrolled", "qualified", "disqualified")
WINNER_MODES = ("draw", "ranking")


class Championship(Base):
    __tablename__ = "championships"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Sequential championship number (1, 2, 3 …), shown to users.
    number: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    season_type: Mapped[str] = mapped_column(String(32), nullable=False)  # SEASON_TYPES
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Beginning of the tallying week (leaderboard freezes, no new qualification).
    tally_starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="upcoming"
    )  # CHAMPIONSHIP_STATUSES
    winner_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="draw"
    )  # WINNER_MODES

    # Ordered list of prizes: [{"rank":1,"name":"MacBook Air 13 M4","value":120000,"image":"…"}, …]
    prize_fund: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ChampionshipEntry(Base):
    __tablename__ = "championship_entries"
    __table_args__ = (
        UniqueConstraint("championship_id", "user_id", name="uq_entry_championship_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    championship_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("championships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="enrolled"
    )  # ENTRY_STATUSES
    # Aggregate ranking score (used for winner_mode='ranking' / engagement ordering).
    score: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    # Raw qualification signals: {"exam_score":..,"courses_done":..,"review_left":bool,..}
    metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ChampionshipWinner(Base):
    __tablename__ = "championship_winners"
    __table_args__ = (
        UniqueConstraint("championship_id", "rank", name="uq_winner_championship_rank"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    championship_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("championships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=gold,2=silver,3=bronze
    prize: Mapped[str] = mapped_column(String(200), nullable=False)
    # Name to publish on the winners wall (may differ from full_name).
    published_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Separate ст.10.1 152-ФЗ consent to publish name/photo (silence != consent).
    publish_consent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
