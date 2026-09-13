"""All wallet mutations lock the user first; callers own the transaction.

No public grant endpoint exists. A future payment adapter must verify the
provider signature and retrieve the settled payment before calling
confirm_payment. Opening Telegram never confirms a payment.
"""

from datetime import UTC, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select

from app.models.daily_attempts import AttemptPayment, DailyAttempts
from app.models.training_map import TrainingMapProgress
from app.models.user import User

MOSCOW = timezone(timedelta(hours=3))
PACK_SIZE = 10
PRICE_KOPECKS = 149900
FREE_DAILY = 25
FREE_PER_LEVEL = 5


def moscow_day(now=None):
    return (now or datetime.now(UTC)).astimezone(MOSCOW).date()


def expires_at(day):
    return datetime.combine(day + timedelta(days=1), datetime.min.time(), MOSCOW)


async def locked_wallet(db, user_id, now=None):
    # This parent lock also serializes first-row creation and all levels.
    owner = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if owner is None:
        raise HTTPException(404, "Аккаунт не найден")
    day = moscow_day(now)
    row = await db.scalar(
        select(DailyAttempts)
        .where(DailyAttempts.user_id == user_id, DailyAttempts.day == day)
        .execution_options(populate_existing=True)
    )
    if row is None:
        # Preserve today's free use on rollout, but do not migrate unverified
        # legacy bonusAttempts (the old bot granted those without payment).
        progress = await db.scalar(
            select(TrainingMapProgress).where(TrainingMapProgress.user_id == user_id)
        )
        energy = progress.energy if progress and isinstance(progress.energy, dict) else {}
        levels = progress.test_map if progress and isinstance(progress.test_map, list) else []
        key = day.isoformat()
        remaining = (
            max(0, min(FREE_DAILY, int(energy.get("remaining", FREE_DAILY))))
            if energy.get("date") == key
            else FREE_DAILY
        )
        uses = {
            str(x.get("level")): max(0, int(x.get("attempts") or 0))
            for x in levels
            if isinstance(x, dict) and x.get("attemptsDate") == key
        }
        row = DailyAttempts(
            user_id=user_id, day=day, free_remaining=remaining, paid_remaining=0, level_uses=uses
        )
        db.add(row)
        await db.flush()
    return row


async def balance(db, user_id):
    day = moscow_day()
    row = await db.scalar(
        select(DailyAttempts).where(DailyAttempts.user_id == user_id, DailyAttempts.day == day)
    )
    return {
        "day": day.isoformat(),
        "free_remaining": row.free_remaining if row else FREE_DAILY,
        "paid_remaining": row.paid_remaining if row else 0,
        "expires_at": expires_at(day).isoformat(),
        "pack_size": PACK_SIZE,
        "price_kopecks": PRICE_KOPECKS,
        "checkout_available": False,
        "level_uses": row.level_uses if row else {},
    }


async def consume(db, user_id, level):
    row = await locked_wallet(db, user_id)
    progress = await db.scalar(
        select(TrainingMapProgress).where(TrainingMapProgress.user_id == user_id)
    )
    levels = progress.test_map if progress and isinstance(progress.test_map, list) else []
    if any(
        isinstance(x, dict) and x.get("level") == level and x.get("status") == "completed"
        for x in levels
    ):
        return  # Completed levels remain free to replay.
    uses = int(row.level_uses.get(str(level), 0))
    if row.free_remaining > 0 and uses < FREE_PER_LEVEL:
        row.free_remaining -= 1
    elif row.paid_remaining > 0:
        row.paid_remaining -= 1
    else:
        raise HTTPException(
            409, "Попытки закончились. Бесплатный лимит обновится в 00:00 по Москве."
        )
    row.level_uses = {**row.level_uses, str(level): uses + 1}
    await db.flush()


async def confirm_payment(db, *, user_id, provider_reference, amount_kopecks, currency, now=None):
    """Trusted settled-payment adapter boundary; never call from a client payload."""
    if amount_kopecks != PRICE_KOPECKS or currency != "RUB" or not provider_reference:
        raise ValueError("Unexpected payment amount, currency or reference")
    row = await locked_wallet(db, user_id, now)
    existing = await db.scalar(
        select(AttemptPayment).where(AttemptPayment.provider_reference == provider_reference)
    )
    if existing:
        if existing.user_id != user_id:
            raise ValueError("Payment belongs to another account")
        return False
    db.add(
        AttemptPayment(
            user_id=user_id,
            provider_reference=provider_reference,
            amount_kopecks=amount_kopecks,
            attempts=PACK_SIZE,
            day=row.day,
        )
    )
    row.paid_remaining += PACK_SIZE
    await db.flush()
    return True
