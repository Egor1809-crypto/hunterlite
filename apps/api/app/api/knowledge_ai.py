"""REST API for the Manyasha knowledge assistant and Legal Radar.

ТЗ-3: the old stateless ``POST /ask`` is replaced (DECISION-C) by a
conversations API with server-side memory. The agent loop + tools live in
``app.services.knowledge_assistant``; this layer owns persistence (Postgres
``assistant_conversations`` / ``assistant_messages``) and rate-limiting.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.core.rate_limit import limiter
from app.database import get_db
from app.models.assistant_conversation import (
    ROLE_ASSISTANT,
    ROLE_TOOL,
    ROLE_USER,
    STATUS_OK,
    AssistantConversation,
    AssistantMessage,
)
from app.models.legal_update import LegalUpdate
from app.models.rag import LegalKnowledgeChunk
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-ai", tags=["knowledge-ai"])

# How many recent user/assistant turns to feed the model as context. Older
# turns are dropped (ТЗ §5 — context-budget truncation; recent turns + RAG win).
_HISTORY_WINDOW = 20


# ── Schemas ──────────────────────────────────────────────────────────────────

class SourceItem(BaseModel):
    id: str = ""
    category: str
    law_article: str
    relevance: float
    is_court_practice: bool
    court_case: str


class CreateConversationRequest(BaseModel):
    title: str | None = Field(None, max_length=200)


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    last_message_at: str | None


class MessageItem(BaseModel):
    id: str
    role: str
    content: str
    status: str
    used_chunks: list[SourceItem] = []
    grounded: bool = True
    tool_name: str | None = None
    created_at: str


class ConversationDetail(BaseModel):
    id: str
    title: str
    created_at: str
    last_message_at: str | None
    messages: list[MessageItem]


class SendMessageRequest(BaseModel):
    # Limit lifted from the old 1000 to a generous cap (ТЗ §2.3).
    message: str = Field(..., min_length=1, max_length=8000)


class SendMessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    content: str
    status: str
    used_chunks: list[SourceItem] = []
    grounded: bool = True
    tool_trace: list[dict] = []
    model: str = ""


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

# ── Conversations (server memory + agent) ─────────────────────────────────────

def _conv_summary(c: AssistantConversation) -> ConversationSummary:
    return ConversationSummary(
        id=str(c.id),
        title=c.title,
        created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
        last_message_at=c.last_message_at.isoformat() if c.last_message_at else None,
    )


def _sources_to_items(raw: list[dict] | None) -> list[SourceItem]:
    items: list[SourceItem] = []
    for s in raw or []:
        items.append(SourceItem(
            id=str(s.get("id", "")),
            category=str(s.get("category", "")),
            law_article=str(s.get("law_article", "")),
            relevance=float(s.get("relevance", 0.0) or 0.0),
            is_court_practice=bool(s.get("is_court_practice", False)),
            court_case=str(s.get("court_case", "")),
        ))
    return items


async def _get_owned_conversation(
    conversation_id: str, user: User, db: AsyncSession,
) -> AssistantConversation:
    try:
        cid = uuid.UUID(conversation_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=404, detail="Беседа не найдена")
    conv = (
        await db.execute(
            select(AssistantConversation).where(
                AssistantConversation.id == cid,
                AssistantConversation.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Беседа не найдена")
    return conv


@router.post("/conversations", response_model=ConversationSummary)
async def create_conversation(
    body: CreateConversationRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = AssistantConversation(
        id=uuid.uuid4(),
        user_id=user.id,
        title=(body.title.strip() if body and body.title else "Новый диалог"),
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return _conv_summary(conv)


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(AssistantConversation)
            .where(
                AssistantConversation.user_id == user.id,
                AssistantConversation.is_archived == False,  # noqa: E712
            )
            .order_by(
                desc(func.coalesce(
                    AssistantConversation.last_message_at,
                    AssistantConversation.created_at,
                ))
            )
            .limit(100)
        )
    ).scalars().all()
    return [_conv_summary(c) for c in rows]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _get_owned_conversation(conversation_id, user, db)
    msgs = (
        await db.execute(
            select(AssistantMessage)
            .where(AssistantMessage.conversation_id == conv.id)
            .order_by(AssistantMessage.created_at)
        )
    ).scalars().all()
    items = [
        MessageItem(
            id=str(m.id),
            role=m.role,
            content=m.content,
            status=m.status,
            used_chunks=_sources_to_items(m.rag_chunk_ids),
            grounded=(bool(m.rag_chunk_ids) if m.role == ROLE_ASSISTANT else True),
            tool_name=m.tool_name,
            created_at=m.created_at.isoformat(),
        )
        for m in msgs
        # Tool-call rows are kept for audit but not shown as chat bubbles.
        if m.role in (ROLE_USER, ROLE_ASSISTANT)
    ]
    return ConversationDetail(
        id=str(conv.id),
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        last_message_at=conv.last_message_at.isoformat() if conv.last_message_at else None,
        messages=items,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=SendMessageResponse)
@limiter.limit("30/minute")
async def send_message(
    request: Request,
    conversation_id: str,
    body: SendMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.knowledge_assistant import AgentResult, run_agent_turn

    conv = await _get_owned_conversation(conversation_id, user, db)
    question = body.message.strip()

    # Build model history from prior user/assistant turns (recent window).
    prior = (
        await db.execute(
            select(AssistantMessage)
            .where(
                AssistantMessage.conversation_id == conv.id,
                AssistantMessage.role.in_((ROLE_USER, ROLE_ASSISTANT)),
                AssistantMessage.content != "",
            )
            .order_by(desc(AssistantMessage.created_at))
            .limit(_HISTORY_WINDOW)
        )
    ).scalars().all()
    history = [{"role": m.role, "content": m.content} for m in reversed(prior)]
    history.append({"role": ROLE_USER, "content": question})

    # Persist the user turn first — even if the LLM call fails we keep it (ТЗ §5).
    now = datetime.now(timezone.utc)
    user_msg = AssistantMessage(
        id=uuid.uuid4(), conversation_id=conv.id, role=ROLE_USER,
        content=question, status=STATUS_OK,
    )
    db.add(user_msg)
    # Auto-title from the first question.
    if not prior and (not conv.title or conv.title == "Новый диалог"):
        conv.title = question[:60] + ("…" if len(question) > 60 else "")
    conv.last_message_at = now
    await db.commit()

    # run_agent_turn is designed never to raise (navy failure → failed
    # AgentResult), but guard the API layer so an unexpected error can't leave
    # the user turn orphaned without a marked-failed assistant reply (§5).
    try:
        result = await run_agent_turn(history=history, db=db, user_id=user.id)
    except Exception:
        logger.exception("knowledge agent turn raised unexpectedly (conv=%s)", conv.id)
        await db.rollback()
        result = AgentResult(
            content="Маняша сейчас недоступна, попробуйте позже.",
            status="failed",
        )

    # Persist tool-call turns (audit) + the assistant turn.
    for tr in result.tool_trace:
        db.add(AssistantMessage(
            id=uuid.uuid4(), conversation_id=conv.id, role=ROLE_TOOL,
            content="", status=STATUS_OK,
            tool_name=str(tr.get("name", ""))[:80],
            tool_args=tr.get("args") if isinstance(tr.get("args"), dict) else None,
        ))
    assistant_msg = AssistantMessage(
        id=uuid.uuid4(), conversation_id=conv.id, role=ROLE_ASSISTANT,
        content=result.content, status=result.status,
        rag_chunk_ids=result.used_chunks or None,
        tokens=result.tokens or None,
    )
    db.add(assistant_msg)
    conv.last_message_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(assistant_msg)

    return SendMessageResponse(
        message_id=str(assistant_msg.id),
        conversation_id=str(conv.id),
        content=result.content,
        status=result.status,
        used_chunks=_sources_to_items(result.used_chunks),
        grounded=result.grounded,
        tool_trace=result.tool_trace,
        model=result.model,
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _get_owned_conversation(conversation_id, user, db)
    conv.is_archived = True
    await db.commit()
    return {"status": "archived", "id": str(conv.id)}


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
