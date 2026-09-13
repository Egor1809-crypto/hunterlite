"""Single-use account linking; purchase links display the fixed daily offer.

Opening a link never grants attempts. Paid credits require independently
verified provider confirmation in daily_attempts.confirm_payment.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.services.daily_attempts import moscow_day, balance, locked_wallet, PACK_SIZE, PRICE_KOPECKS

from app.config import settings
from app.models.telegram_link import TelegramLinkToken
from app.models.training_map import TrainingMapProgress
from app.models.user import User

logger = logging.getLogger(__name__)

TOKEN_TTL_MINUTES = 30


def _utc_date_key() -> str:
    return moscow_day().isoformat()


def _deeplink(prefix: str, token: str) -> str:
    return f"https://t.me/{settings.telegram_bot_username}?start={prefix}_{token}"


async def _mint_token(
    db: AsyncSession,
    *,
    user: User,
    purpose: str,
    payload: dict,
) -> str:
    token = secrets.token_urlsafe(24)
    row = TelegramLinkToken(
        token=token,
        user_id=user.id,
        purpose=purpose,
        payload=payload,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES),
    )
    db.add(row)
    await db.commit()
    return token


async def create_buy_deeplink(
    db: AsyncSession,
    *,
    user: User,
    level: int | None = None,
    pack: int = 10,
) -> str:
    """Mint a link to the fixed common daily offer."""
    token = await _mint_token(
        db,
        user=user,
        purpose="buy",
        payload={"pack": PACK_SIZE, "price_kopecks": PRICE_KOPECKS},
    )
    return _deeplink("buy", token)


async def create_link_deeplink(db: AsyncSession, *, user: User) -> str:
    """Mint a one-time token for linking the Telegram account only."""
    token = await _mint_token(db, user=user, purpose="link", payload={})
    return _deeplink("link", token)


async def redeem_token(
    db: AsyncSession,
    *,
    token: str,
    telegram_id: str,
) -> dict:
    """Consume a deeplink token: link the TG account + apply its action.

    Returns a dict describing the outcome for the bot to format a reply:
      {"ok": bool, "purpose": str, "level": int?, "pack": int?,
       "bonus": int?, "error": str?, "linked": bool}
    """
    result = await db.execute(
        select(TelegramLinkToken).where(TelegramLinkToken.token == token).with_for_update()
    )
    row = result.scalar_one_or_none()
    if row is None:
        return {"ok": False, "error": "not_found"}
    if row.used_at is not None:
        return {"ok": False, "error": "used"}
    if row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return {"ok": False, "error": "expired"}

    user = await db.scalar(select(User).where(User.id == row.user_id).with_for_update())
    if user is None:
        return {"ok": False, "error": "user_gone"}

    # Link the Telegram account if this TG id isn't bound yet. If it's bound
    # to a DIFFERENT user, refuse — one TG account maps to one web account.
    if not telegram_id:
        return {"ok": False, "error": "invalid_telegram"}
    if user.telegram_id and user.telegram_id != str(telegram_id):
        return {"ok": False, "error": "account_linked"}
    linked_now = False
    existing = await db.execute(select(User).where(User.telegram_id == str(telegram_id)))
    owner = existing.scalar_one_or_none()
    if owner is None:
        user.telegram_id = str(telegram_id)
        linked_now = True
    elif owner.id != user.id:
        return {"ok": False, "error": "tg_taken"}

    row.used_at = datetime.now(timezone.utc)

    out: dict = {
        "ok": True,
        "purpose": row.purpose,
        "linked": linked_now,
        "user_name": user.full_name,
    }
    if row.purpose == "buy":
        out.update({"pack": PACK_SIZE, "price_kopecks": PRICE_KOPECKS, "checkout_available": False})
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return {"ok": False, "error": "tg_taken"}
    return out


async def get_progress_summary(db: AsyncSession, *, telegram_id: str) -> dict | None:
    """Short progress digest for a linked TG account, or None if unlinked."""
    result = await db.execute(select(User).where(User.telegram_id == str(telegram_id)))
    user = result.scalar_one_or_none()
    if user is None:
        return None

    await locked_wallet(db, user.id)
    await db.commit()
    tm_result = await db.execute(
        select(TrainingMapProgress).where(TrainingMapProgress.user_id == user.id)
    )
    row = tm_result.scalar_one_or_none()
    levels = row.test_map if row and isinstance(row.test_map, list) else []
    completed = sum(
        1 for lvl in levels if isinstance(lvl, dict) and lvl.get("status") == "completed"
    )
    energy = (row.energy if row and isinstance(row.energy, dict) else {}) or {}
    today = _utc_date_key()
    energy_remaining = energy.get("remaining") if energy.get("date") == today else None

    return {
        "user_name": user.full_name,
        "completed": completed,
        "total": 100,
        "energy_remaining": energy_remaining,
        "attempts": await balance(db, user.id),
    }
