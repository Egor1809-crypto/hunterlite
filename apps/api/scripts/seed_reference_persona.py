"""Seed каталога эталонных персонажей-должников (физлицо, ФЗ-127).

Данные живут по одному файлу на персонажа в ``scripts/personas_data/``. Эталон —
``persona_01_irina`` (CONSTRUCTOR_TZ §2). Идемпотентно: upsert по ``slug``.

Перед посевом прогнать валидатор:
    cd apps/api
    uv run python -m scripts.validate_personas
    uv run python -m scripts.seed_reference_persona
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.database import async_session
from app.models.reference_persona import ReferencePersona
from scripts.personas_data import PERSONAS

logger = logging.getLogger(__name__)


async def seed() -> None:
    # Защита (ultrareview #2): пустой каталог НЕ должен молча деактивировать все
    # строки. Пустой PERSONAS — это аномалия (ошибка упаковки/cwd: persona_*.py не
    # обнаружены), а не легитимный «обнули каталог».
    if not PERSONAS:
        raise SystemExit(
            "refusing to seed: PERSONAS пуст — это деактивировало бы весь каталог "
            "reference_personas. Проверь scripts/personas_data/ (persona_*.py)."
        )
    async with async_session() as session:
        existing = {
            row.slug: row
            for row in (await session.execute(select(ReferencePersona))).scalars().all()
        }
        seeded_slugs = set()
        for persona in PERSONAS:
            slug = persona["slug"]
            seeded_slugs.add(slug)
            row = existing.get(slug)
            if row is None:
                session.add(ReferencePersona(is_active=True, **persona))
            else:
                for key, value in persona.items():
                    setattr(row, key, value)
                row.is_active = True
        # Деактивировать персонажей, которых больше нет в каталоге (без удаления).
        for slug, row in existing.items():
            if slug not in seeded_slugs:
                row.is_active = False
        await session.commit()
        logger.info("Seeded %d reference persona(s)", len(PERSONAS))


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    await seed()


if __name__ == "__main__":
    asyncio.run(main())
