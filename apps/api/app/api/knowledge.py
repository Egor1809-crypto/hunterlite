"""REST API for the kept Knowledge BASE browse view.

The knowledge-quiz subsystem (quiz sessions, answers, SRS, PvP-arena
challenges, leaderboards) has been retired. Only the read-only RAG-chunk
browser survives here — it powers the "База знаний" transparency view.
Mounted in router.py with the ``/knowledge`` prefix, so the public URL is
``/knowledge/rag/browse`` (unchanged).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.rag import LegalCategory
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/rag/browse")
async def browse_knowledge_base(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    category: str | None = Query(None, description="Filter by category code (eligibility/timeline/...)"),
    search: str | None = Query(None, description="Substring search in fact_text / law_article / blitz_question"),
    difficulty: int | None = Query(None, ge=1, le=5),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Return RAG chunks for the knowledge-base transparency view.

    Each chunk is returned in full — fact_text, article, common_errors,
    correct_response_hint, blitz Q&A, question_templates, follow-ups —
    so the user can see exactly what the AI is judging against.

    Search is plain `ILIKE %term%` on text columns. Embedding-search is
    NOT used here (this is a browse view, not retrieval).
    """
    from app.models.rag import LegalKnowledgeChunk
    from sqlalchemy import or_

    stmt = select(LegalKnowledgeChunk).where(
        LegalKnowledgeChunk.is_active.is_(True),
        LegalKnowledgeChunk.knowledge_status == "actual",
    )
    if category:
        try:
            cat_enum = LegalCategory(category)
        except ValueError:
            raise HTTPException(400, f"Unknown category: {category}")
        stmt = stmt.where(LegalKnowledgeChunk.category == cat_enum)
    if difficulty:
        stmt = stmt.where(LegalKnowledgeChunk.difficulty_level == difficulty)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(
                LegalKnowledgeChunk.fact_text.ilike(like),
                LegalKnowledgeChunk.law_article.ilike(like),
                LegalKnowledgeChunk.blitz_question.ilike(like),
                LegalKnowledgeChunk.blitz_answer.ilike(like),
                LegalKnowledgeChunk.correct_response_hint.ilike(like),
            )
        )

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one()

    stmt = (
        stmt.order_by(LegalKnowledgeChunk.category, LegalKnowledgeChunk.difficulty_level, LegalKnowledgeChunk.id)
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).scalars().all()

    chunks = [
        {
            "id": str(c.id),
            "category": c.category.value if hasattr(c.category, "value") else str(c.category),
            "difficulty": c.difficulty_level,
            "law_article": c.law_article,
            "fact_text": c.fact_text,
            "correct_response_hint": c.correct_response_hint,
            "common_errors": c.common_errors or [],
            "match_keywords": c.match_keywords or [],
            "question_templates": c.question_templates or [],
            "follow_up_questions": c.follow_up_questions or [],
            "blitz_question": c.blitz_question,
            "blitz_answer": c.blitz_answer,
            "court_case_reference": c.court_case_reference,
            "is_court_practice": bool(c.is_court_practice),
            "tags": c.tags or [],
        }
        for c in rows
    ]

    # Stats for the UI header (total per category)
    stats_stmt = (
        select(LegalKnowledgeChunk.category, func.count())
        .where(
            LegalKnowledgeChunk.is_active.is_(True),
            LegalKnowledgeChunk.knowledge_status == "actual",
        )
        .group_by(LegalKnowledgeChunk.category)
    )
    stats_rows = (await db.execute(stats_stmt)).all()
    by_category = {
        (cat.value if hasattr(cat, "value") else str(cat)): int(cnt)
        for cat, cnt in stats_rows
    }

    return {
        "chunks": chunks,
        "total": total,
        "limit": limit,
        "offset": offset,
        "by_category": by_category,
    }


# PR-6 user-report endpoint moved to apps/api/app/api/knowledge_reports.py
# (mounted in main.py with the /knowledge prefix so the URL is unchanged).
