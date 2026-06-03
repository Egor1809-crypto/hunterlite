"""Demo dev-data — complete Region 1 of the test map for demo accounts.

This unlocks the «Конструктор» (CharacterBuilder) gate, which
``is_constructor_unlocked`` opens only after all 10 levels of region 1 are
passed with ``bestScore ≥ PASS_SCORE``. Pure data — no logic change to the
gate — so the product rule (unlock after region 1) stays intact while the
demo logins start unlocked for testing.

Idempotent: re-running only fills missing region-1 levels; existing progress
beyond region 1 is preserved.

Run standalone:  python -m scripts.seed_demo_progress
"""
import asyncio
import logging
import uuid

from sqlalchemy import select

from app.database import async_session
from app.models.user import User
from app.models.training_map import TrainingMapProgress
from app.services.constructor_access import REGION_1_LEVELS

logger = logging.getLogger(__name__)

DEMO_EMAILS = [
    "demo1@hunterlite.ru",
    "demo2@hunterlite.ru",
    "demo3@hunterlite.ru",
    "demo4@hunterlite.ru",
    "demo5@hunterlite.ru",
]

# A region-1 level entry that satisfies the unlock predicate. Shape matches the
# FE LevelState (TestWorldMap.tsx → normalizeProgress).
def _completed_level(level: int) -> dict:
    return {
        "level": level,
        "status": "completed",
        "bestScore": 100,
        "attempts": 1,
        "attemptsDate": None,
        "bonusAttempts": 0,
        "questionsCount": 12,
    }


def _region1_test_map() -> list[dict]:
    """Region 1 complete (levels 1..REGION_1_LEVELS), rest untouched/available."""
    return [_completed_level(i + 1) for i in range(REGION_1_LEVELS)]


async def seed() -> None:
    async with async_session() as db:
        users = (
            await db.execute(select(User).where(User.email.in_(DEMO_EMAILS)))
        ).scalars().all()
        if not users:
            logger.warning("seed_demo_progress: no demo users found — run seed_db first")
            return

        touched = 0
        for user in users:
            row = (
                await db.execute(
                    select(TrainingMapProgress).where(
                        TrainingMapProgress.user_id == user.id
                    )
                )
            ).scalar_one_or_none()

            region1 = _region1_test_map()
            if row is None:
                db.add(
                    TrainingMapProgress(
                        id=uuid.uuid4(),
                        user_id=user.id,
                        test_map=region1,
                        exams={},
                        cases={},
                        energy={},
                    )
                )
                touched += 1
                continue

            # Merge: ensure the first REGION_1_LEVELS entries are completed,
            # preserve anything the user achieved beyond region 1.
            current = row.test_map if isinstance(row.test_map, list) else []
            merged = list(current)
            while len(merged) < REGION_1_LEVELS:
                merged.append(_completed_level(len(merged) + 1))
            for i in range(REGION_1_LEVELS):
                entry = merged[i] if isinstance(merged[i], dict) else {}
                if (entry.get("bestScore") or 0) < 100 or entry.get("status") != "completed":
                    merged[i] = _completed_level(i + 1)
            row.test_map = merged
            touched += 1

        await db.commit()
        logger.info("seed_demo_progress: region-1 unlocked for %d demo account(s)", touched)
        print(f"seed_demo_progress: region-1 unlocked for {touched} demo account(s)")


if __name__ == "__main__":
    asyncio.run(seed())
