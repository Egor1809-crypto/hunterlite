"""REST API for Knowledge AI assistant and Legal Radar."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.core.rate_limit import limiter
from app.database import get_db
from app.models.legal_update import LegalUpdate
from app.models.rag import LegalCategory, LegalKnowledgeChunk
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-ai", tags=["knowledge-ai"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)


class SourceItem(BaseModel):
    category: str
    law_article: str
    relevance: float
    is_court_practice: bool
    court_case: str


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceItem]
    model: str
    retrieval_ms: int = 0
    generation_ms: int = 0
    total_ms: int = 0


class RadarItem(BaseModel):
    id: str
    title: str
    summary: str
    source: str
    source_url: str | None
    category: str
    relevance_score: float
    published_at: str
    tags: list[str]
    is_ai_generated: bool


class RadarResponse(BaseModel):
    items: list[RadarItem]
    total: int
    last_updated: str | None


class CategoryCount(BaseModel):
    category: str
    count: int


class StatsResponse(BaseModel):
    total_chunks: int
    categories: list[CategoryCount]
    last_updated: str | None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=AskResponse)
@limiter.limit("20/hour")
async def ask_ai(
    request: Request,
    body: AskRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.knowledge_assistant import ask
    result = await ask(body.question, user.id, db)
    return AskResponse(
        answer=result["answer"],
        sources=[SourceItem(**s) for s in result["sources"]],
        model=result["model"],
        retrieval_ms=result.get("retrieval_ms", 0),
        generation_ms=result.get("generation_ms", 0),
        total_ms=result.get("total_ms", 0),
    )


@router.get("/radar", response_model=RadarResponse)
async def get_radar(
    limit: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(LegalUpdate).where(LegalUpdate.is_active == True)
    if category:
        q = q.where(LegalUpdate.category == category)
    q = q.order_by(desc(LegalUpdate.published_at)).limit(limit)

    result = await db.execute(q)
    rows = result.scalars().all()

    count_q = select(func.count(LegalUpdate.id)).where(LegalUpdate.is_active == True)
    if category:
        count_q = count_q.where(LegalUpdate.category == category)
    total = (await db.execute(count_q)).scalar() or 0

    last_q = select(func.max(LegalUpdate.fetched_at)).where(LegalUpdate.is_active == True)
    last_updated_dt = (await db.execute(last_q)).scalar()
    last_updated = last_updated_dt.isoformat() if last_updated_dt else None

    items = [
        RadarItem(
            id=str(r.id),
            title=r.title,
            summary=r.summary,
            source=r.source,
            source_url=r.source_url,
            category=r.category,
            relevance_score=r.relevance_score,
            published_at=r.published_at.isoformat(),
            tags=r.tags or [],
            is_ai_generated=r.is_ai_generated,
        )
        for r in rows
    ]
    return RadarResponse(items=items, total=total, last_updated=last_updated)


@router.get("/radar/categories")
async def get_radar_categories(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(LegalUpdate.category, func.count(LegalUpdate.id).label("count"))
        .where(LegalUpdate.is_active == True)
        .group_by(LegalUpdate.category)
        .order_by(desc("count"))
    )
    result = await db.execute(q)
    return [{"category": row.category, "count": row.count} for row in result]


@router.post("/radar/refresh")
async def refresh_radar(
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.legal_radar import fetch_updates
    saved = await fetch_updates(db)
    return {"status": "ok", "saved": saved}


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_q = select(func.count(LegalKnowledgeChunk.id)).where(
        LegalKnowledgeChunk.is_active == True,
    )
    total = (await db.execute(total_q)).scalar() or 0

    cat_q = (
        select(
            LegalKnowledgeChunk.category,
            func.count(LegalKnowledgeChunk.id).label("count"),
        )
        .where(LegalKnowledgeChunk.is_active == True)
        .group_by(LegalKnowledgeChunk.category)
        .order_by(desc("count"))
    )
    cat_result = await db.execute(cat_q)
    categories = [
        CategoryCount(category=row.category.value if hasattr(row.category, "value") else str(row.category), count=row.count)
        for row in cat_result
    ]

    last_q = select(func.max(LegalKnowledgeChunk.created_at))
    last_dt = (await db.execute(last_q)).scalar()
    last_updated = last_dt.isoformat() if last_dt else None

    return StatsResponse(
        total_chunks=total,
        categories=categories,
        last_updated=last_updated,
    )
