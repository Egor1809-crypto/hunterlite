"""Reference personas — gold-standard клиент-должник (физлицо, ФЗ-127).

Аналог эталонного кейса ``bfl-01``: эталонный персонаж, по которому позже
масштабируем каталог через ``/ultracode`` (CONSTRUCTOR_TZ §2, DECISION-3).
Отдельная таблица, чтобы не смешивать с пользовательскими ``custom_characters``.

Материал — строго банкротство ФИЗИЧЕСКИХ лиц (ФЗ-127). Никакой путаницы с
банкротством юрлиц (наблюдение/конкурсное производство/КДЛ/субсидиарка-как-процедура).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ReferencePersona(Base):
    __tablename__ = "reference_personas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    # Стабильный человекочитаемый ключ для пересева (как id у кейсов).
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # ── Базовый профиль (физлицо-должник) ──
    archetype: Mapped[str] = mapped_column(String(50), nullable=False)        # "anxious_debtor" и т.п.
    profession: Mapped[str] = mapped_column(String(80), nullable=False)
    lead_source: Mapped[str] = mapped_column(String(120), nullable=False)

    # ── Состав дела (контекст должника) ──
    debt_stage: Mapped[str | None] = mapped_column(String(120), nullable=True)
    debt_range: Mapped[str | None] = mapped_column(String(120), nullable=True)
    family_preset: Mapped[str | None] = mapped_column(String(80), nullable=True)
    creditors_preset: Mapped[str | None] = mapped_column(String(80), nullable=True)
    property_preset: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # ── Эмоция / манера / среда ──
    emotion_preset: Mapped[str | None] = mapped_column(String(80), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    environment: Mapped[str | None] = mapped_column(String(120), nullable=True)
    client_fatigue: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tone: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # ── Контент эталона ──
    # cached_dossier: полное досье (факты дела + что юрист обязан выяснить/объяснить).
    cached_dossier: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # scoring_rubric: критерии оценки разговора (§5.3) — JSONB-структура.
    scoring_rubric: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_reference_persona_archetype", "archetype"),
    )
