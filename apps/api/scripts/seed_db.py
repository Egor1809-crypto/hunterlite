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
from app.models.user import User, UserConsent, UserRole

logger = logging.getLogger(__name__)

# Required consents mirror app.api.consent.REQUIRED_CONSENTS — the single source
# of truth for what check_consent_accepted enforces at training-start. We seed an
# accepted record for each demo user so demo logins on a fresh DB can start
# trainings immediately.
#
# PRODUCT GAP (temporary): the frontend has NO UI to accept consent — it only
# calls GET /consent/status; POST /consent/ is never invoked anywhere. So a real
# (non-demo) user can never satisfy check_consent_accepted and gets stuck with a
# 403 at training start. Seeding demo-consent below only unblocks the demo
# accounts; the missing acceptance UI is a separate product task that must be
# built before non-demo onboarding works. See CONSENT_GAP.
REQUIRED_CONSENTS = [
    {"consent_type": "personal_data_processing", "version": "1.0"},
]

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
        consents_created = 0
        for email, password, full_name, role in DEMO_USERS:
            existing = (
                await db.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if existing:
                user = existing
            else:
                user = User(
                    id=uuid.uuid4(),
                    email=email,
                    hashed_password=hash_password(password),
                    full_name=full_name,
                    role=role,
                    is_active=True,
                    must_change_password=False,
                )
                db.add(user)
                await db.flush()  # assign user.id for the consent FK below
                created += 1

            # Ensure each demo user has accepted every required consent
            # (idempotent — skip if an accepted record already exists).
            for req in REQUIRED_CONSENTS:
                already = (
                    await db.execute(
                        select(UserConsent).where(
                            UserConsent.user_id == user.id,
                            UserConsent.consent_type == req["consent_type"],
                            UserConsent.version == req["version"],
                            UserConsent.accepted == True,  # noqa: E712
                        )
                    )
                ).scalar_one_or_none()
                if already:
                    continue
                db.add(
                    UserConsent(
                        id=uuid.uuid4(),
                        user_id=user.id,
                        consent_type=req["consent_type"],
                        version=req["version"],
                        accepted=True,
                    )
                )
                consents_created += 1
        await db.commit()
        logger.info(
            "seed_db: demo accounts ensured (%d users created, %d consents created)",
            created,
            consents_created,
        )


if __name__ == "__main__":
    asyncio.run(seed())
