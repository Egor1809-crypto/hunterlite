"""API endpoints for training presets (guided CharacterBuilder mode)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.training_preset import TrainingPreset
from app.models.progress import ManagerProgress
from app.models.user import User

router = APIRouter(prefix="/training-presets", tags=["training-presets"])


class TrainingPresetResponse(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    category: str
    difficulty: int
    icon_emoji: str
    archetype: str
    profession: str | None = None
    lead_source: str | None = None
    emotion_preset: str | None = None
    context_params: dict[str, Any]
    bg_noise: str | None = None
    learning_goals: list[str]
    tips: list[str]
    recommended_after_level: int | None = None
    recommended_after_case: str | None = None
    related_knowledge_categories: list[str]
    order_index: int

    model_config = {"from_attributes": True}


def _preset_to_response(p: TrainingPreset) -> TrainingPresetResponse:
    return TrainingPresetResponse(
        id=str(p.id),
        slug=p.slug,
        title=p.title,
        description=p.description,
        category=p.category,
        difficulty=p.difficulty,
        icon_emoji=p.icon_emoji,
        archetype=p.archetype,
        profession=p.profession,
        lead_source=p.lead_source,
        emotion_preset=p.emotion_preset,
        context_params=p.context_params,
        bg_noise=p.bg_noise,
        learning_goals=p.learning_goals,
        tips=p.tips,
        recommended_after_level=p.recommended_after_level,
        recommended_after_case=p.recommended_after_case,
        related_knowledge_categories=p.related_knowledge_categories,
        order_index=p.order_index,
    )


@router.get("/recommended", response_model=list[TrainingPresetResponse])
async def get_recommended_presets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TrainingPresetResponse]:
    progress_result = await db.execute(
        select(ManagerProgress).where(ManagerProgress.user_id == user.id)
    )
    progress = progress_result.scalar_one_or_none()
    user_level = progress.current_level if progress else 1

    result = await db.execute(
        select(TrainingPreset)
        .where(
            TrainingPreset.is_active.is_(True),
            TrainingPreset.recommended_after_level <= user_level,
        )
        .order_by(TrainingPreset.difficulty.desc(), TrainingPreset.order_index)
        .limit(3)
    )
    presets = result.scalars().all()
    return [_preset_to_response(p) for p in presets]


@router.get("/", response_model=list[TrainingPresetResponse])
async def list_presets(
    difficulty: int | None = None,
    category: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TrainingPresetResponse]:
    q = select(TrainingPreset).where(TrainingPreset.is_active.is_(True))
    if difficulty is not None:
        q = q.where(TrainingPreset.difficulty == difficulty)
    if category is not None:
        q = q.where(TrainingPreset.category == category)
    q = q.order_by(TrainingPreset.difficulty, TrainingPreset.order_index)
    result = await db.execute(q)
    presets = result.scalars().all()
    return [_preset_to_response(p) for p in presets]


@router.get("/{slug}", response_model=TrainingPresetResponse)
async def get_preset(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrainingPresetResponse:
    result = await db.execute(
        select(TrainingPreset).where(
            TrainingPreset.slug == slug,
            TrainingPreset.is_active.is_(True),
        )
    )
    preset = result.scalar_one_or_none()
    if preset is None:
        raise HTTPException(status_code=404, detail="Preset not found")
    return _preset_to_response(preset)
