"""Public reviews / testimonials API (landing).

- GET  /reviews — public; returns approved, non-deleted testimonials (newest first).
- POST /reviews — authenticated; submits a review for moderation (approved=False).

The ``Review`` table plus its moderation flag and TTL scheduler already exist
(see app/models/review.py, services/review_ttl_scheduler.py); before this router
there were no public read/write endpoints. Leaving a review is one of the
championship entry conditions (see CHAMPIONSHIP_PLAN §6).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.review import Review
from app.models.user import User

router = APIRouter()


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    role: str
    text: str
    rating: int
    created_at: datetime


class ReviewCreate(BaseModel):
    text: str = Field(min_length=10, max_length=2000)
    role: str = Field(default="", max_length=200)
    rating: int = Field(default=5, ge=1, le=5)
    # Optional display name; falls back to the user's full name.
    name: str | None = Field(default=None, max_length=200)


@router.get("/reviews", response_model=list[ReviewOut])
async def list_reviews(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Public testimonial wall — only moderated (approved) reviews are shown."""
    limit = max(1, min(limit, 100))
    rows = await db.execute(
        select(Review)
        .where(Review.approved.is_(True), Review.deleted.is_(False))
        .order_by(Review.created_at.desc())
        .limit(limit)
    )
    return list(rows.scalars().all())


@router.post("/reviews", response_model=ReviewOut, status_code=201)
async def create_review(
    payload: ReviewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a review. Goes to moderation (approved=False) before appearing.

    One active (non-deleted) review per user to curb spam / multi-posting.
    """
    existing = await db.execute(
        select(Review.id).where(Review.user_id == user.id, Review.deleted.is_(False))
    )
    if existing.first() is not None:
        raise HTTPException(status_code=409, detail="Вы уже оставили отзыв")

    review = Review(
        user_id=user.id,
        name=(payload.name or user.full_name or "Аноним").strip()[:200],
        role=payload.role.strip()[:200],
        text=payload.text.strip(),
        rating=payload.rating,
        approved=False,  # moderation gate — see review_ttl_scheduler / admin tooling
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


# ──────────────────────────── moderation (admin) ────────────────────────────

class PendingReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    role: str
    text: str
    rating: int
    approved: bool
    created_at: datetime


async def _get_review(db: AsyncSession, review_id: uuid.UUID) -> Review:
    review = (
        await db.execute(select(Review).where(Review.id == review_id))
    ).scalar_one_or_none()
    if review is None or review.deleted:
        raise HTTPException(status_code=404, detail="Отзыв не найден")
    return review


@router.get("/reviews/pending", response_model=list[PendingReviewOut])
async def list_pending_reviews(
    limit: int = 100,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Moderation queue — submitted reviews awaiting approval (oldest first)."""
    limit = max(1, min(limit, 200))
    rows = await db.execute(
        select(Review)
        .where(Review.approved.is_(False), Review.deleted.is_(False))
        .order_by(Review.created_at.asc())
        .limit(limit)
    )
    return list(rows.scalars().all())


@router.post("/reviews/{review_id}/approve", response_model=PendingReviewOut)
async def approve_review(
    review_id: uuid.UUID,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Approve a review → it appears on the public wall."""
    review = await _get_review(db, review_id)
    if not review.approved:
        review.approved = True
        await db.commit()
        await db.refresh(review)
    return review


@router.post("/reviews/{review_id}/reject", status_code=204)
async def reject_review(
    review_id: uuid.UUID,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Reject a review → soft-delete (hidden, frees the user's one-review slot)."""
    review = await _get_review(db, review_id)
    review.deleted = True
    review.approved = False
    await db.commit()
