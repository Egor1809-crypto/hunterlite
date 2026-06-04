"""Reference-persona gallery (CONSTRUCTOR_TZ) — 25 эталонных клиентов-должников.

GET /characters/reference отдаёт активные reference_personas (по order_index)
для галереи «Мои клиенты» в конструкторе. ``scoring_rubric`` НЕ отдаётся —
это тренерская рубрика оценки, не для клиента.

``cached_dossier`` разбивается на две части по маркерам:
  • client_brief  — всё ДО «ЧТО ЮРИСТ ОБЯЗАН ВЫЯСНИТЬ» («Кто» + «Состав долга»:
    факты клиента, которыми ведётся AI-клиент);
  • lawyer_brief  — от «ЧТО ЮРИСТ ОБЯЗАН ВЫЯСНИТЬ» ДО «ЗАПРЕЩЕНО»
    (тренировочная подсказка юристу — что выяснить/объяснить).
Блок «ЗАПРЕЩЕНО …» (антипаттерны/рубрика) во фронт не уходит.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.reference_persona import ReferencePersona
from app.models.user import User

router = APIRouter()

# Маркеры разбиения cached_dossier. Сопоставление по подстроке (в сидах
# фактический текст — «ЧТО ЮРИСТ ОБЯЗАН ВЫЯСНИТЬ В РАЗГОВОРЕ:» и
# «ЗАПРЕЩЕНО (типичные ошибки …):»).
_LAWYER_MARKER = "ЧТО ЮРИСТ ОБЯЗАН ВЫЯСНИТЬ"
_FORBIDDEN_MARKER = "ЗАПРЕЩЕНО"

# Человекочитаемые метки архетипов (код → рус.). fallback = сам код.
ARCHETYPE_LABELS: dict[str, str] = {
    "anxious_debtor": "Тревожный",
    "aggressive_debtor": "Агрессивный",
    "hopeful_naive": "Наивный",
    "manipulative_debtor": "Манипулятор",
    "overwhelmed_debtor": "В панике",
    "skeptical_debtor": "Скептик",
    "defensive_debtor": "Отрицание",
    "resigned_debtor": "Апатичный",
    "entitled_debtor": "Высокомерный",
    "ashamed_secretive": "Скрытный",
    "withdrawn_guilty": "Замкнутый",
    "optimistic_minimizer": "Легкомысленный",
    "suspicious_debtor": "Подозрительный",
    "talkative_rambling": "Болтливый",
    "bitter_distrustful": "Озлобленный",
    "pragmatic_businesslike": "Деловой",
    "evasive_debtor": "Уклончивый",
    "cooperative_eager": "Сговорчивый",
    "defensive_justifying": "Оправдывающийся",
    "anxious_determined": "Решительный",
    "responsible_guilty": "Совестливый",
    "cunning_secretive": "Хитрый",
    "proud_defensive": "Гордый",
    "frustrated_impatient": "Нетерпеливый",
    "anxious_guilty": "Виноватый",
}


def archetype_label(code: str | None) -> str:
    """Рус.-метка архетипа; fallback = сам код (или пустая строка)."""
    if not code:
        return ""
    return ARCHETYPE_LABELS.get(code, code)


def split_dossier(text: str | None) -> tuple[str, str]:
    """Разбить cached_dossier на (client_brief, lawyer_brief).

    client_brief = всё ДО маркера «ЧТО ЮРИСТ ОБЯЗАН ВЫЯСНИТЬ».
    lawyer_brief = от этого маркера ДО маркера «ЗАПРЕЩЕНО».
    Блок «ЗАПРЕЩЕНО …» отбрасывается.

    Маркеры устойчивы к отсутствию: если маркера юриста нет — весь текст
    уходит в client_brief, lawyer_brief пуст. Если нет маркера «ЗАПРЕЩЕНО» —
    lawyer_brief тянется до конца.
    """
    if not text:
        return "", ""

    lawyer_idx = text.find(_LAWYER_MARKER)
    if lawyer_idx == -1:
        # Нет тренерской секции — весь текст это факты клиента.
        return text.strip(), ""

    client_brief = text[:lawyer_idx].strip()

    forbidden_idx = text.find(_FORBIDDEN_MARKER, lawyer_idx)
    if forbidden_idx == -1:
        lawyer_brief = text[lawyer_idx:].strip()
    else:
        lawyer_brief = text[lawyer_idx:forbidden_idx].strip()

    return client_brief, lawyer_brief


def _persona_to_dict(p: ReferencePersona) -> dict:
    client_brief, lawyer_brief = split_dossier(p.cached_dossier)
    return {
        "slug": p.slug,
        "name": p.name,
        "archetype": p.archetype,
        "archetype_label": archetype_label(p.archetype),
        "profession": p.profession,
        "lead_source": p.lead_source,
        "debt_stage": p.debt_stage,
        "debt_range": p.debt_range,
        "family_preset": p.family_preset,
        "creditors_preset": p.creditors_preset,
        "property_preset": p.property_preset,
        "emotion_preset": p.emotion_preset,
        "difficulty": p.difficulty,
        "environment": p.environment,
        "tone": p.tone,
        "client_brief": client_brief,
        "lawyer_brief": lawyer_brief,
    }


@router.get("/characters/reference")
async def list_reference_personas(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Галерея эталонных персонажей для конструктора «Мои клиенты».

    Только ``is_active``, отсортировано по ``order_index``. ``scoring_rubric``
    не отдаётся.
    """
    rows = (
        await db.execute(
            select(ReferencePersona)
            .where(ReferencePersona.is_active.is_(True))
            .order_by(ReferencePersona.order_index)
        )
    ).scalars().all()

    return {"personas": [_persona_to_dict(p) for p in rows]}
