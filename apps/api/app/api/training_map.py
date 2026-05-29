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

router = APIRouter(prefix="/training-map", tags=["training-map"])


class TrainingMapResponse(BaseModel):
    test_map: Any
    exams: Any
    cases: Any


class TrainingMapUpdate(BaseModel):
    test_map: Any | None = None
    exams: Any | None = None
    cases: Any | None = None


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
        return TrainingMapResponse(test_map={}, exams={}, cases={})
    return TrainingMapResponse(test_map=row.test_map, exams=row.exams, cases=row.cases)


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
        )
        db.add(row)
    else:
        if body.test_map is not None:
            row.test_map = body.test_map
        if body.exams is not None:
            row.exams = body.exams
        if body.cases is not None:
            row.cases = body.cases

    await db.commit()
    await db.refresh(row)
    return TrainingMapResponse(test_map=row.test_map, exams=row.exams, cases=row.cases)
