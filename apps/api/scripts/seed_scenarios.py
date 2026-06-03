"""Seed базовых обучающих сценариев (legacy ``Scenario`` модель).

Старт тренировки (``POST /training/sessions``) требует хотя бы один активный
``Scenario`` в БД (fallback-сценарий в ``app/api/training.py``). Без посева
старт падает с 400. Этот модуль импортируется из ``app/main.py`` lifespan
(``from scripts.seed_scenarios import seed_scenario_templates``).

Идемпотентно: upsert по ``slug`` для ``Character`` и по ``title`` для
``Scenario``. Повторный запуск безопасен — существующие строки переиспользуются,
а недостающие создаются.

    cd apps/api
    uv run python -m scripts.seed_scenarios
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.database import async_session
from app.models.character import Character, EmotionState
from app.models.scenario import Scenario, ScenarioType

logger = logging.getLogger(__name__)


# Базовый персонаж-должник (физлицо, ФЗ-127). Один на все базовые сценарии.
BASE_CHARACTER = {
    "slug": "base-debtor",
    "name": "Базовый должник",
    "description": (
        "Эталонный персонаж-должник (физлицо). Используется как дефолтный "
        "собеседник для базовых обучающих сценариев старта тренировки."
    ),
    "prompt_path": "prompts/characters/base_debtor.md",
}


# Три базовых активных сценария (тип consultation, разная сложность).
BASE_SCENARIOS = [
    {
        "title": "Базовая консультация — лёгкая",
        "description": (
            "Вводный сценарий консультации с лояльным клиентом. "
            "Минимум возражений, мягкий темп — для первого знакомства."
        ),
        "difficulty": 3,
    },
    {
        "title": "Базовая консультация — средняя",
        "description": (
            "Консультация со сдержанным клиентом. Умеренные возражения "
            "и проверка компетентности менеджера."
        ),
        "difficulty": 5,
    },
    {
        "title": "Базовая консультация — сложная",
        "description": (
            "Консультация со скептичным, занятым клиентом. Частые возражения, "
            "высокая планка по эмпатии и удержанию."
        ),
        "difficulty": 8,
    },
]


async def seed_scenario_templates() -> None:
    """Идемпотентно создаёт базовый ``Character`` и базовые ``Scenario``.

    1. Upsert базового персонажа по ``slug='base-debtor'``.
    2. Upsert трёх активных сценариев (consultation) по ``title``,
       привязанных к этому персонажу.
    """
    async with async_session() as session:
        # ── 1. Базовый персонаж (upsert по slug) ──
        character = (
            await session.execute(
                select(Character).where(Character.slug == BASE_CHARACTER["slug"])
            )
        ).scalar_one_or_none()

        if character is None:
            character = Character(
                slug=BASE_CHARACTER["slug"],
                name=BASE_CHARACTER["name"],
                description=BASE_CHARACTER["description"],
                prompt_path=BASE_CHARACTER["prompt_path"],
                initial_emotion=EmotionState.cold,
                difficulty=5,
                is_active=True,
            )
            session.add(character)
            await session.flush()  # получить character.id для FK сценариев
            logger.info("Created base character slug=%s", BASE_CHARACTER["slug"])
        else:
            # Подстраховка: гарантируем активность и наличие prompt_path.
            character.is_active = True
            if not character.prompt_path:
                character.prompt_path = BASE_CHARACTER["prompt_path"]
            logger.info("Base character slug=%s already exists", BASE_CHARACTER["slug"])

        # ── 2. Базовые сценарии (upsert по title) ──
        # select(Scenario.title) даёт Row(title,) — нормализуем в set строк.
        existing_titles = {
            t for (t,) in (
                await session.execute(select(Scenario.title))
            ).all()
        }

        created = 0
        for spec in BASE_SCENARIOS:
            if spec["title"] in existing_titles:
                logger.info("Scenario title=%r already exists", spec["title"])
                continue
            session.add(
                Scenario(
                    title=spec["title"],
                    description=spec["description"],
                    scenario_type=ScenarioType.consultation,
                    difficulty=spec["difficulty"],
                    estimated_duration_minutes=15,
                    character_id=character.id,
                    is_active=True,
                )
            )
            created += 1
            logger.info(
                "Created scenario title=%r difficulty=%d",
                spec["title"],
                spec["difficulty"],
            )

        await session.commit()
        logger.info(
            "Seed complete: base character ensured, %d new scenario(s) created",
            created,
        )


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    await seed_scenario_templates()


if __name__ == "__main__":
    asyncio.run(main())
