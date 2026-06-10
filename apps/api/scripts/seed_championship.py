"""Seed Championship #1 (idempotent).

The летне-осенний season: starts 1 June, tally week at the second-to-last week
of autumn, ends with autumn. See docs/contest/CHAMPIONSHIP_PLAN.md §2.

Run standalone:  python -m scripts.seed_championship
"""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import async_session
from app.models.championship import Championship

logger = logging.getLogger(__name__)

PRIZE_FUND = [
    {"rank": 1, "name": "MacBook Air 13 M4", "value": 130000, "image": "/landing/prizes/macbook-air.webp"},
    {"rank": 2, "name": "iPhone 15", "value": 80000, "image": "/landing/prizes/iphone-15.webp"},
    {"rank": 3, "name": "AirPods 4", "value": 20000, "image": "/landing/prizes/airpods-4.webp"},
]


async def seed() -> None:
    async with async_session() as db:
        existing = await db.execute(select(Championship).where(Championship.number == 1))
        if existing.scalar_one_or_none() is not None:
            logger.info("seed_championship: championship #1 already exists")
            return
        champ = Championship(
            number=1,
            season_type="summer_autumn",
            title="Чемпионат сезона · Лето–Осень 2026",
            starts_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
            tally_starts_at=datetime(2026, 11, 24, tzinfo=timezone.utc),
            ends_at=datetime(2026, 11, 30, 23, 59, 59, tzinfo=timezone.utc),
            status="active",
            winner_mode="draw",
            prize_fund=PRIZE_FUND,
        )
        db.add(champ)
        await db.commit()
        logger.info("seed_championship: championship #1 created")
        print("seed_championship: championship #1 created")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
