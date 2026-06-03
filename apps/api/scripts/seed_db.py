"""Base seed — demo accounts (idempotent).

Recreates the gap left when the old base seeder was removed: the app.main
lifespan imports `from scripts.seed_db import seed` and runs it on startup, so
a freshly-migrated DB gets working demo logins without manual SQL.

Run standalone:  python -m scripts.seed_db
"""
import asyncio
import logging
import uuid

from sqlalchemy import select

from app.database import async_session
from app.core.security import hash_password
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

# Demo accounts (одинаковый паттерн паролей; роли разные для проверки доступов).
DEMO_USERS = [
    ("demo1@hunterlite.ru", "Demo1Pass!2026", "Алексей Иванов", UserRole.admin),
    ("demo2@hunterlite.ru", "Demo2Pass!2026", "Мария Петрова", UserRole.rop),
    ("demo3@hunterlite.ru", "Demo3Pass!2026", "Дмитрий Козлов", UserRole.manager),
    ("demo4@hunterlite.ru", "Demo4Pass!2026", "Елена Смирнова", UserRole.manager),
    ("demo5@hunterlite.ru", "Demo5Pass!2026", "Сергей Волков", UserRole.manager),
]


async def seed() -> None:
    """Create the demo accounts if missing (idempotent — safe to re-run)."""
    async with async_session() as db:
        created = 0
        for email, password, full_name, role in DEMO_USERS:
            existing = (
                await db.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if existing:
                continue
            db.add(
                User(
                    id=uuid.uuid4(),
                    email=email,
                    hashed_password=hash_password(password),
                    full_name=full_name,
                    role=role,
                    is_active=True,
                    must_change_password=False,
                )
            )
            created += 1
        await db.commit()
        logger.info("seed_db: demo accounts ensured (%d created)", created)


if __name__ == "__main__":
    asyncio.run(seed())
