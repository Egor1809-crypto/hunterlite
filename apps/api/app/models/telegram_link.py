from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TelegramLinkToken(Base):
    """One-time short token bridging a web session and a Telegram deeplink.

    Telegram's ``?start=<param>`` payload is capped at 64 chars and only
    allows ``[A-Za-z0-9_-]`` — too small for a JWT — so we mint a short
    opaque token here and look it up when the bot receives ``/start``.

    ``purpose`` is ``"link"`` (just bind the TG account) or ``"buy"`` (bind
    if needed + grant attempts). ``payload`` carries action data, e.g.
    ``{"level": 3, "pack": 5}`` for a buy.
    """

    __tablename__ = "telegram_link_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    purpose: Mapped[str] = mapped_column(String(16), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_telegram_link_token", "token"),
    )
