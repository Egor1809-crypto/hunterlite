from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TrainingPreset(Base):
    __tablename__ = "training_presets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    icon_emoji: Mapped[str] = mapped_column(String(10), nullable=False)

    archetype: Mapped[str] = mapped_column(String(50), nullable=False)
    profession: Mapped[str | None] = mapped_column(String(50), nullable=True)
    lead_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emotion_preset: Mapped[str | None] = mapped_column(String(30), nullable=True)
    context_params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    bg_noise: Mapped[str | None] = mapped_column(String(20), nullable=True)

    learning_goals: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    tips: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    recommended_after_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recommended_after_case: Mapped[str | None] = mapped_column(String(80), nullable=True)

    related_knowledge_categories: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_training_preset_difficulty", "difficulty"),
        Index("idx_training_preset_category", "category"),
    )
