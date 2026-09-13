from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.training_map import TrainingMapProgress
from app.core.deps import get_current_user
from app.services import telegram_attempts, daily_attempts
from app.services.constructor_access import (
    CONSTRUCTOR_UNLOCK_HINT,
    is_constructor_unlocked,
)

router = APIRouter(prefix="/training-map", tags=["training-map"])


class TrainingMapResponse(BaseModel):
    test_map: Any
    exams: Any
    cases: Any
    energy: Any
    # CONSTRUCTOR_TZ §3 — разблокировка конструктора по региону 1 теста.
    attempts: dict | None = None
    constructor_unlocked: bool = False
    constructor_unlock_hint: str | None = None


class TrainingMapUpdate(BaseModel):
    test_map: Any | None = None
    exams: Any | None = None
    cases: Any | None = None
    energy: Any | None = None


@router.get("/progress", response_model=TrainingMapResponse)
async def get_progress(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrainingMapResponse:
    await daily_attempts.locked_wallet(db, user.id)
    result = await db.execute(
        select(TrainingMapProgress).where(TrainingMapProgress.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return TrainingMapResponse(
            test_map={}, exams={}, cases={}, energy={}, attempts=await daily_attempts.balance(db, user.id),
            constructor_unlocked=False,
            constructor_unlock_hint=CONSTRUCTOR_UNLOCK_HINT,
        )
    wallet = await daily_attempts.balance(db, user.id)
    unlocked = is_constructor_unlocked(row.test_map)
    return TrainingMapResponse(
        test_map=_map_with_attempts(row.test_map, wallet), exams=row.exams, cases=row.cases,
        energy={"date":wallet["day"],"remaining":wallet["free_remaining"]}, attempts=wallet,
        constructor_unlocked=unlocked,
        constructor_unlock_hint=None if unlocked else CONSTRUCTOR_UNLOCK_HINT,
    )


@router.put("/progress", response_model=TrainingMapResponse)
async def save_progress(
    body: TrainingMapUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrainingMapResponse:
    await daily_attempts.locked_wallet(db, user.id)
    result = await db.execute(
        select(TrainingMapProgress).where(TrainingMapProgress.user_id == user.id)
    )
    row = result.scalar_one_or_none()

    if row is None:
        row = TrainingMapProgress(
            user_id=user.id,
            test_map=body.test_map or {},
            exams=body.exams or {},
            cases=body.cases or {},
            energy=body.energy or {},
        )
        db.add(row)
    else:
        if body.test_map is not None:
            row.test_map = _map_with_attempts(body.test_map, await daily_attempts.balance(db, user.id))
        if body.exams is not None:
            row.exams = body.exams
        if body.cases is not None:
            row.cases = body.cases
        if body.energy is not None:
            row.energy = body.energy

    await db.commit()
    await db.refresh(row)
    wallet = await daily_attempts.balance(db, user.id)
    unlocked = is_constructor_unlocked(row.test_map)
    return TrainingMapResponse(
        test_map=_map_with_attempts(row.test_map, wallet), exams=row.exams, cases=row.cases,
        energy={"date":wallet["day"],"remaining":wallet["free_remaining"]}, attempts=wallet,
        constructor_unlocked=unlocked,
        constructor_unlock_hint=None if unlocked else CONSTRUCTOR_UNLOCK_HINT,
    )


class BuyAttemptsRequest(BaseModel):
    level: int | None = None
    pack: int = 10


class DeeplinkResponse(BaseModel):
    deeplink: str
    telegram_linked: bool


@router.post("/attempts/deeplink", response_model=DeeplinkResponse)
async def buy_attempts_deeplink(
    body: BuyAttemptsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeeplinkResponse:
    """Open the fixed daily offer. Checkout awaits provider integration."""
    deeplink = await telegram_attempts.create_buy_deeplink(
        db, user=user, level=body.level, pack=10,
    )
    return DeeplinkResponse(deeplink=deeplink, telegram_linked=user.telegram_id is not None)


@router.post("/telegram/link", response_model=DeeplinkResponse)
async def telegram_link_deeplink(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeeplinkResponse:
    """Mint a Telegram deeplink that just links the account (no purchase)."""
    deeplink = await telegram_attempts.create_link_deeplink(db, user=user)
    return DeeplinkResponse(deeplink=deeplink, telegram_linked=user.telegram_id is not None)


def _map_with_attempts(test_map, wallet):
    if not isinstance(test_map, list):
        return test_map
    return [{**x, "attemptsDate":wallet["day"],
        "attempts":wallet["level_uses"].get(str(x.get("level")),0), "bonusAttempts":0}
        if isinstance(x,dict) else x for x in test_map]

@router.get("/attempts")
async def get_attempts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await daily_attempts.locked_wallet(db, user.id)
    await db.commit()
    return await daily_attempts.balance(db, user.id)
