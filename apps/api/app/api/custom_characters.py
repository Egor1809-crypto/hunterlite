"""CRUD endpoints for custom character presets (v2: 8-step constructor).

Шеринг персонажей убран (CONSTRUCTOR_TZ DECISION-2): остались только личные
сохранения пользователя (list/create/update/delete).
"""

from uuid import UUID

from app.core.rate_limit import limiter
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.custom_character import CustomCharacter
from app.models.user import User
from app.schemas.training import (
    CustomCharacterCreate,
    CustomCharacterUpdate,
    CustomCharacterResponse,
)

router = APIRouter()

MAX_CHARACTERS_PER_USER = 50  # FIX-14: increased from 20


def _char_to_response(c: CustomCharacter) -> CustomCharacterResponse:
    return CustomCharacterResponse(
        id=str(c.id),
        name=c.name,
        archetype=c.archetype,
        profession=c.profession,
        lead_source=c.lead_source,
        difficulty=c.difficulty,
        description=c.description,
        family_preset=c.family_preset,
        creditors_preset=c.creditors_preset,
        debt_stage=c.debt_stage,
        debt_range=c.debt_range,
        emotion_preset=c.emotion_preset,
        bg_noise=c.bg_noise,
        time_of_day=c.time_of_day,
        client_fatigue=c.client_fatigue,
        tone=c.tone,
        play_count=c.play_count or 0,
        best_score=c.best_score,
        avg_score=c.avg_score,
        last_played_at=c.last_played_at.isoformat() if c.last_played_at else None,
        created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat() if c.updated_at else None,
    )


@router.get("/characters/custom")
async def list_custom_characters(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CustomCharacterResponse]:
    """List all custom characters for the current user."""
    result = await db.execute(
        select(CustomCharacter)
        .where(CustomCharacter.user_id == user.id)
        .order_by(CustomCharacter.created_at.desc())
    )
    chars = result.scalars().all()
    return [_char_to_response(c) for c in chars]


@router.post("/characters/custom", status_code=201)
@limiter.limit("10/minute")
async def create_custom_character(
    request: Request,
    data: CustomCharacterCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomCharacterResponse:
    """Save a custom character preset (limit: 50 per user)."""
    count_result = await db.execute(
        select(func.count()).select_from(CustomCharacter).where(CustomCharacter.user_id == user.id)
    )
    count = count_result.scalar() or 0
    if count >= MAX_CHARACTERS_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Максимум {MAX_CHARACTERS_PER_USER} сохранённых персонажей",
        )

    char = CustomCharacter(
        user_id=user.id,
        name=data.name,
        archetype=data.archetype,
        profession=data.profession,
        lead_source=data.lead_source,
        difficulty=data.difficulty,
        description=data.description,
        family_preset=data.family_preset,
        creditors_preset=data.creditors_preset,
        debt_stage=data.debt_stage,
        debt_range=data.debt_range,
        emotion_preset=data.emotion_preset,
        bg_noise=data.bg_noise,
        time_of_day=data.time_of_day,
        client_fatigue=data.client_fatigue,
        tone=data.tone,
    )
    db.add(char)
    await db.commit()
    await db.refresh(char)

    return _char_to_response(char)


@router.put("/characters/custom/{character_id}")
async def update_custom_character(
    character_id: UUID,
    data: CustomCharacterUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomCharacterResponse:
    """Update a custom character preset (partial update)."""
    result = await db.execute(
        select(CustomCharacter).where(
            CustomCharacter.id == character_id,
            CustomCharacter.user_id == user.id,
        )
    )
    char = result.scalar_one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    update_data = data.model_dump(exclude_unset=True)
    params_changed = False
    for field, value in update_data.items():
        setattr(char, field, value)
        if field != "description" and field != "name":
            params_changed = True

    # Reset cached dossier if generation params changed
    if params_changed and char.cached_dossier:
        char.cached_dossier = None

    await db.commit()
    await db.refresh(char)

    return _char_to_response(char)


@router.delete("/characters/custom/{character_id}", status_code=204)
async def delete_custom_character(
    character_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a custom character preset."""
    result = await db.execute(
        select(CustomCharacter).where(
            CustomCharacter.id == character_id,
            CustomCharacter.user_id == user.id,
        )
    )
    char = result.scalar_one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    await db.execute(
        delete(CustomCharacter).where(CustomCharacter.id == character_id)
    )
    await db.commit()
