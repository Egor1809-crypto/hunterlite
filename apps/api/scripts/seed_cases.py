"""Seed BFL (банкротство физических лиц) case scenarios.

Wipes the old cases and inserts the two-stage cases:
Stage 1 — branching decision tree (5 spine questions, 5 options each,
intermediate "info" разбор-nodes for wrong answers, with intersections),
Stage 2 — chronology ordering.
Strictly real BFL practice (ФЗ-127), no legal-entity bankruptcy terms.

Данные кейсов живут по одному файлу на кейс в ``scripts/cases_data/``.
Перед посевом обязательно прогнать валидатор:
    cd apps/api
    uv run python -m scripts.validate_cases
    uv run python -m scripts.seed_cases
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import delete

from app.database import async_session
from app.models.case_scenario import CaseScenario
from scripts.cases_data import CASES

logger = logging.getLogger(__name__)


async def seed() -> None:
    async with async_session() as session:
        # Фаза 0: убрать старые кейсы целиком (attempts каскадно удалятся по FK).
        await session.execute(delete(CaseScenario))

        for case in CASES:
            session.add(CaseScenario(is_active=True, **case))

        await session.commit()
        logger.info("Seeded %d BFL case(s)", len(CASES))


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    await seed()


if __name__ == "__main__":
    asyncio.run(main())
