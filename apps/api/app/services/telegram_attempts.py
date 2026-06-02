"""Telegram-bridged training attempts (@BFLHUNTER_bot).

The web app can't grant paid/boosted attempts on its own — purchases run
through the Telegram bot so there's a single ecosystem (account linking +
buying + notifications). The flow:

  1. Web calls :func:`create_buy_deeplink` → gets ``https://t.me/<bot>?start=buy_<token>``.
  2. User opens it; the bot receives ``/start buy_<token>``.
  3. :func:`redeem_token` links the TG account to the web user (if not yet
     linked) and grants the attempts on the encoded level.

Tokens are short opaque strings (Telegram's ``start`` payload caps at 64
chars / ``[A-Za-z0-9_-]``, so a JWT won't fit). They're single-use and
short-lived, stored in ``telegram_link_tokens``.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.config import settings
from app.models.telegram_link import TelegramLinkToken
from app.models.training_map import TrainingMapProgress
from app.models.user import User

logger = logging.getLogger(__name__)

TOKEN_TTL_MINUTES = 30
MAX_BONUS_PER_LEVEL = 50


def _utc_date_key() -> str:
    """UTC date (YYYY-MM-DD) — matches the web client's attemptsDate key."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _deeplink(prefix: str, token: str) -> str:
    return f"https://t.me/{settings.telegram_bot_username}?start={prefix}_{token}"


async def _mint_token(
    db: AsyncSession, *, user: User, purpose: str, payload: dict,
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
    db: AsyncSession, *, user: User, level: int, pack: int = 5,
) -> str:
    """Mint a one-time token for buying ``pack`` attempts on ``level``."""
    token = await _mint_token(
        db, user=user, purpose="buy", payload={"level": int(level), "pack": int(pack)},
    )
    return _deeplink("buy", token)


async def create_link_deeplink(db: AsyncSession, *, user: User) -> str:
    """Mint a one-time token for linking the Telegram account only."""
    token = await _mint_token(db, user=user, purpose="link", payload={})
    return _deeplink("link", token)


async def _grant_attempts(
    db: AsyncSession, *, user_id, level: int, pack: int,
) -> int:
    """Add ``pack`` bonus attempts to ``level`` in the user's training map.

    Returns the new bonusAttempts total for the level. Mirrors the web
    client's per-UTC-day reset: if attemptsDate is stale, the day's counters
    start fresh and the pack is the only bonus.
    """
    result = await db.execute(
        select(TrainingMapProgress).where(TrainingMapProgress.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = TrainingMapProgress(user_id=user_id, test_map=[], exams={}, cases={}, energy={})
        db.add(row)

    tm = row.test_map if isinstance(row.test_map, list) else []
    idx = max(0, int(level) - 1)
    while len(tm) <= idx:
        tm.append(None)

    item = tm[idx] if isinstance(tm[idx], dict) else {"level": int(level)}
    today = _utc_date_key()
    same_day = item.get("attemptsDate") == today
    prev_bonus = int(item.get("bonusAttempts") or 0) if same_day else 0
    prev_attempts = int(item.get("attempts") or 0) if same_day else 0
    new_bonus = min(MAX_BONUS_PER_LEVEL, prev_bonus + int(pack))

    item.update(
        {
            "level": int(level),
            "attempts": prev_attempts,
            "attemptsDate": today,
            "bonusAttempts": new_bonus,
            "status": item.get("status") or "available",
        }
    )
    tm[idx] = item
    row.test_map = tm
    flag_modified(row, "test_map")
    await db.commit()
    return new_bonus


async def redeem_token(
    db: AsyncSession, *, token: str, telegram_id: str,
) -> dict:
    """Consume a deeplink token: link the TG account + apply its action.

    Returns a dict describing the outcome for the bot to format a reply:
      {"ok": bool, "purpose": str, "level": int?, "pack": int?,
       "bonus": int?, "error": str?, "linked": bool}
    """
    result = await db.execute(
        select(TelegramLinkToken).where(TelegramLinkToken.token == token)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return {"ok": False, "error": "not_found"}
    if row.used_at is not None:
        return {"ok": False, "error": "used"}
    if row.expires_at < datetime.now(timezone.utc):
        return {"ok": False, "error": "expired"}

    user = await db.get(User, row.user_id)
    if user is None:
        return {"ok": False, "error": "user_gone"}

    # Link the Telegram account if this TG id isn't bound yet. If it's bound
    # to a DIFFERENT user, refuse — one TG account maps to one web account.
    linked_now = False
    existing = await db.execute(
        select(User).where(User.telegram_id == str(telegram_id))
    )
    owner = existing.scalar_one_or_none()
    if owner is None:
        user.telegram_id = str(telegram_id)
        linked_now = True
    elif owner.id != user.id:
        return {"ok": False, "error": "tg_taken"}

    row.used_at = datetime.now(timezone.utc)

    out: dict = {"ok": True, "purpose": row.purpose, "linked": linked_now,
                 "user_name": user.full_name}
    if row.purpose == "buy":
        level = int(row.payload.get("level", 1))
        pack = int(row.payload.get("pack", 5))
        # commit happens inside _grant_attempts; link + used_at flush with it
        bonus = await _grant_attempts(db, user_id=user.id, level=level, pack=pack)
        out.update({"level": level, "pack": pack, "bonus": bonus})
    else:
        await db.commit()
    return out


async def get_progress_summary(db: AsyncSession, *, telegram_id: str) -> dict | None:
    """Short progress digest for a linked TG account, or None if unlinked."""
    result = await db.execute(
        select(User).where(User.telegram_id == str(telegram_id))
    )
    user = result.scalar_one_or_none()
    if user is None:
        return None

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
    }
