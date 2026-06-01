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
from app.services import telegram_attempts

router = APIRouter(prefix="/training-map", tags=["training-map"])


class TrainingMapResponse(BaseModel):
    test_map: Any
    exams: Any
    cases: Any
    energy: Any


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
    result = await db.execute(
        select(TrainingMapProgress).where(TrainingMapProgress.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return TrainingMapResponse(test_map={}, exams={}, cases={}, energy={})
    return TrainingMapResponse(
        test_map=row.test_map, exams=row.exams, cases=row.cases, energy=row.energy or {},
    )


@router.put("/progress", response_model=TrainingMapResponse)
async def save_progress(
    body: TrainingMapUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrainingMapResponse:
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
            row.test_map = body.test_map
        if body.exams is not None:
            row.exams = body.exams
        if body.cases is not None:
            row.cases = body.cases
        if body.energy is not None:
            row.energy = body.energy

    await db.commit()
    await db.refresh(row)
    return TrainingMapResponse(
        test_map=row.test_map, exams=row.exams, cases=row.cases, energy=row.energy or {},
    )


class BuyAttemptsRequest(BaseModel):
    level: int
    pack: int = 5


class DeeplinkResponse(BaseModel):
    deeplink: str
    telegram_linked: bool


@router.post("/attempts/deeplink", response_model=DeeplinkResponse)
async def buy_attempts_deeplink(
    body: BuyAttemptsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeeplinkResponse:
    """Mint a Telegram deeplink to buy more attempts on a level.

    Payment isn't wired yet — the pilot bot grants the pack for free — but
    the purchase always goes through @BFLHUNTER_bot so account linking,
    granting and notifications live in one place.
    """
    if body.level < 1 or body.level > 100:
        raise HTTPException(status_code=400, detail="level out of range")
    pack = max(1, min(50, body.pack))
    deeplink = await telegram_attempts.create_buy_deeplink(
        db, user=user, level=body.level, pack=pack,
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
