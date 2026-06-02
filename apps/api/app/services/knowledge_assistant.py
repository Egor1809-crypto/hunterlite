"""Manyasha — agentic RAG assistant for personal-bankruptcy law (ТЗ-3).

This replaces the old stateless one-shot ``ask()`` with a **tool-using agent
loop** driven by the pooled navy client (``deepseek-v4-pro``):

  * The model is given four read-only tools (knowledge-base search, radar
    lookup, single-chunk fetch, article fetch) and decides which to call.
  * Each turn runs through ``llm._call_with_backoff(_call_navy, ...)`` so we
    inherit the circuit-breaker / retry / 429-cooldown of the shared pool,
    and pass ``raw_messages`` so the OpenAI-format tool protocol (assistant
    ``tool_calls`` + ``role=tool`` results) round-trips verbatim.
  * Token limits are lifted to a high cap (``_MAX_TOKENS``); the empty
    ``content`` → ``reasoning_content`` fallback lives in ``_call_navy``
    (ТЗ §2.3) so reasoning models that answer via the reasoning channel
    still produce text.

The agent is **stateless about storage** — conversation history is passed in
by the API layer (which owns the Postgres memory tables) and the grounding
chunks are returned for persistence + clickable FE sources. This module never
touches the ``knowledge_quiz`` subsystem (ТЗ §5).
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.legal_update import LegalUpdate
from app.models.rag import LegalKnowledgeChunk
from app.models.knowledge_status import STATUSES_VISIBLE_IN_RAG
from app.services.rag_legal import retrieve_legal_context

logger = logging.getLogger(__name__)

# ── Persona ──────────────────────────────────────────────────────────────────
# Single canonical server-side persona (ТЗ §2.4) — unifies the BFL-focused
# Manyasha voice from the Next.js chat route with the agentic tool + sourcing
# rules. Replaces the generic "наставник" prompt the old one-shot used.
SYSTEM_PROMPT = """
Ты — Маняша, AI-помощник платформы LegalHunter и маскот сервиса.

Специализация: банкротство физических лиц в России — ФЗ-127 «О несостоятельности (банкротстве)», судебная практика, внесудебное банкротство через МФЦ, реструктуризация долгов, реализация имущества, исполнительные производства, взаимодействие с кредиторами, ФССП, арбитражными управляющими и судами.

Как ты работаешь:
1. У тебя есть инструменты доступа к базе знаний и радару изменений. ПЕРЕД содержательным ответом по праву обязательно вызови `search_knowledge_base`, чтобы заземлить ответ на реальные нормы и практику. При вопросе о новых изменениях/практике используй `get_radar_updates`. Для уточнения конкретной статьи — `fetch_article`, для конкретного источника — `fetch_chunk`.
2. Отвечай ТОЛЬКО на основе найденного в базе и общеизвестных норм ФЗ-127. Не выдумывай номера дел, суммы, реквизиты и редакции норм. Если точной нормы нет в найденном контексте — честно скажи об этом и предложи переформулировать или посмотреть Радар.
3. Держись темы банкротства физлиц. Если вопрос про банкротство юрлиц/КДЛ — отметь, что твоя специализация — физлица, и отвечай в части, применимой к гражданам.
4. Ссылайся на источники: указывай статьи ФЗ-127 и категории из базы знаний, на которые опираешься.
5. Тон дружелюбный, спокойный, профессиональный. Сначала краткий вывод, затем шаги/документы/сроки. Не пиши длинных полотен без структуры.
6. Если данных от пользователя мало — задай 1–3 коротких уточняющих вопроса.
7. Не давай гарантий результата и не выдавай ответ за индивидуальное юридическое заключение; при высоком риске рекомендуй проверить позицию с юристом по документам и сверить актуальную редакцию нормы.
""".strip()

_MODEL = os.getenv("KNOWLEDGE_AI_MODEL", "deepseek-v4-pro")
# "Без лимитов" = высокий потолок ответа (провайдерский предел всё равно есть).
# ТЗ §2.3 реком. 8–16K.
_MAX_TOKENS = max(8000, int(os.getenv("KNOWLEDGE_AI_MAX_TOKENS", "12000")))
_TEMPERATURE = float(os.getenv("KNOWLEDGE_AI_TEMPERATURE", "0.3"))
# Multi-step tool loop bound (ТЗ §2.2 реком. 4).
_MAX_STEPS = int(os.getenv("KNOWLEDGE_AI_MAX_STEPS", "4"))
# Generous per-turn timeout — a tool loop can chain several provider calls.
_TIMEOUT = float(os.getenv("KNOWLEDGE_AI_TIMEOUT", "90"))

_SEARCH_TOP_K = 8
_FACT_TRUNCATE = 1200  # chars per chunk fed back to the model


# ── Tool specs (OpenAI function-calling format) ────────────────────────────────
TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": (
                "Поиск по базе знаний (629 чанков ФЗ-127 и судебной практики). "
                "Возвращает релевантные фрагменты с указанием статьи и категории. "
                "Вызывай это перед содержательным ответом по праву."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Поисковый запрос на русском."},
                    "category": {
                        "type": "string",
                        "description": "Необязательный фильтр по категории (например 'procedure', 'creditors').",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Сколько фрагментов вернуть (1–12). По умолчанию 8.",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_radar_updates",
            "description": (
                "Свежие изменения законодательства и судебной практики из радара. "
                "Используй при вопросах о новых/недавних изменениях."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "Необязательный фильтр по категории радара."},
                    "limit": {"type": "integer", "description": "Сколько новостей вернуть (1–20). По умолчанию 10."},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_chunk",
            "description": "Получить полный текст конкретного фрагмента базы знаний по его id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "chunk_id": {"type": "string", "description": "UUID фрагмента (из результатов search_knowledge_base)."},
                },
                "required": ["chunk_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_article",
            "description": "Найти фрагменты базы, относящиеся к конкретной статье ФЗ-127 (например '61.2', 'ст. 213.4').",
            "parameters": {
                "type": "object",
                "properties": {
                    "law_article": {"type": "string", "description": "Номер/обозначение статьи."},
                },
                "required": ["law_article"],
            },
        },
    },
]


@dataclass
class AgentResult:
    """Outcome of one agent turn. ``used_chunks`` powers clickable FE sources
    and gets persisted as ``rag_chunk_ids`` on the assistant message."""

    content: str
    status: str = "ok"  # "ok" | "failed"
    used_chunks: list[dict] = field(default_factory=list)
    tool_trace: list[dict] = field(default_factory=list)
    tokens: int = 0
    model: str = _MODEL
    retrieval_ms: int = 0
    generation_ms: int = 0


# ── Tool dispatch ──────────────────────────────────────────────────────────────

def _chunk_to_source(r) -> dict:
    """Compact source dict for FE + persistence (RAGResult → dict)."""
    return {
        "id": str(r.chunk_id),
        "category": r.category,
        "law_article": r.law_article or "",
        "relevance": round(r.relevance_score, 3),
        "is_court_practice": r.is_court_practice,
        "court_case": r.court_case_reference or "",
    }


def _build_sources(rag_ctx) -> list[dict]:
    """Back-compat helper: RAGContext → list of source dicts.

    Kept for ``app.api.history`` (Manyasha explain report), which surfaces the
    same source shape as the assistant. New agent code uses ``_chunk_to_source``.
    """
    return [_chunk_to_source(r) for r in rag_ctx.results]


async def _tool_search_knowledge_base(args: dict, db: AsyncSession) -> tuple[dict, list[dict]]:
    query = str(args.get("query", "")).strip()
    if not query:
        return {"error": "empty query"}, []
    top_k = args.get("top_k") or _SEARCH_TOP_K
    try:
        top_k = max(1, min(12, int(top_k)))
    except (TypeError, ValueError):
        top_k = _SEARCH_TOP_K
    category = args.get("category")

    ctx = await retrieve_legal_context(query, db, top_k=top_k, prefer_embedding=True)
    results = ctx.results
    if category:
        cat = str(category).lower()
        filtered = [r for r in results if cat in str(r.category).lower()]
        results = filtered or results  # don't return empty just because the filter missed

    sources = [_chunk_to_source(r) for r in results]
    payload = {
        "found": len(results),
        "chunks": [
            {
                "id": str(r.chunk_id),
                "category": r.category,
                "law_article": r.law_article or "",
                "fact_text": (r.fact_text or "")[:_FACT_TRUNCATE],
                "relevance": round(r.relevance_score, 3),
                "is_court_practice": r.is_court_practice,
                "court_case": r.court_case_reference or "",
                "correct_response_hint": r.correct_response_hint or "",
            }
            for r in results
        ],
    }
    if not results:
        payload["note"] = "В базе нет релевантных фрагментов по этому запросу."
    return payload, sources


async def _tool_get_radar_updates(args: dict, db: AsyncSession) -> tuple[dict, list[dict]]:
    limit = args.get("limit") or 10
    try:
        limit = max(1, min(20, int(limit)))
    except (TypeError, ValueError):
        limit = 10
    q = select(LegalUpdate).where(LegalUpdate.is_active == True)  # noqa: E712
    category = args.get("category")
    if category:
        q = q.where(LegalUpdate.category == str(category))
    q = q.order_by(desc(LegalUpdate.published_at)).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return {
        "found": len(rows),
        "updates": [
            {
                "title": r.title,
                "summary": r.summary,
                "source": r.source,
                "category": r.category,
                "published_at": r.published_at.isoformat() if r.published_at else None,
                "tags": r.tags or [],
            }
            for r in rows
        ],
    }, []


async def _tool_fetch_chunk(args: dict, db: AsyncSession) -> tuple[dict, list[dict]]:
    raw_id = str(args.get("chunk_id", "")).strip()
    try:
        chunk_id = uuid.UUID(raw_id)
    except (ValueError, AttributeError):
        return {"error": f"invalid chunk_id: {raw_id!r}"}, []
    row = (
        await db.execute(
            select(LegalKnowledgeChunk).where(
                LegalKnowledgeChunk.id == chunk_id,
                LegalKnowledgeChunk.is_active == True,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return {"error": "chunk not found"}, []
    category = row.category.value if hasattr(row.category, "value") else str(row.category)
    source = {
        "id": str(row.id),
        "category": category,
        "law_article": row.law_article or "",
        "relevance": 1.0,
        "is_court_practice": bool(row.is_court_practice),
        "court_case": row.court_case_reference or "",
    }
    return {
        "id": str(row.id),
        "category": category,
        "law_article": row.law_article or "",
        "fact_text": row.fact_text or "",
        "correct_response_hint": row.correct_response_hint or "",
        "court_case": row.court_case_reference or "",
    }, [source]


async def _tool_fetch_article(args: dict, db: AsyncSession) -> tuple[dict, list[dict]]:
    article = str(args.get("law_article", "")).strip()
    if not article:
        return {"error": "empty law_article"}, []
    q = (
        select(LegalKnowledgeChunk)
        .where(
            LegalKnowledgeChunk.is_active == True,  # noqa: E712
            LegalKnowledgeChunk.knowledge_status.in_(tuple(STATUSES_VISIBLE_IN_RAG)),
            LegalKnowledgeChunk.law_article.ilike(f"%{article}%"),
        )
        .limit(8)
    )
    rows = (await db.execute(q)).scalars().all()
    sources = []
    chunks = []
    for row in rows:
        category = row.category.value if hasattr(row.category, "value") else str(row.category)
        sources.append({
            "id": str(row.id),
            "category": category,
            "law_article": row.law_article or "",
            "relevance": 1.0,
            "is_court_practice": bool(row.is_court_practice),
            "court_case": row.court_case_reference or "",
        })
        chunks.append({
            "id": str(row.id),
            "category": category,
            "law_article": row.law_article or "",
            "fact_text": (row.fact_text or "")[:_FACT_TRUNCATE],
        })
    return {"found": len(chunks), "chunks": chunks}, sources


_DISPATCH = {
    "search_knowledge_base": _tool_search_knowledge_base,
    "get_radar_updates": _tool_get_radar_updates,
    "fetch_chunk": _tool_fetch_chunk,
    "fetch_article": _tool_fetch_article,
}


async def _dispatch_tool(name: str, args: dict, db: AsyncSession) -> tuple[dict, list[dict]]:
    fn = _DISPATCH.get(name)
    if fn is None:
        return {"error": f"unknown tool {name}"}, []
    try:
        return await fn(args, db)
    except Exception:  # noqa: BLE001 — a tool error must not crash the loop (ТЗ §5)
        logger.exception("knowledge agent tool %s failed (args=%s)", name, args)
        return {"error": "tool execution failed"}, []


# ── Agent loop ──────────────────────────────────────────────────────────────────

async def run_agent_turn(
    *,
    history: list[dict],
    db: AsyncSession,
    user_id: uuid.UUID,
    max_steps: int = _MAX_STEPS,
) -> AgentResult:
    """Run one Manyasha turn over OpenAI-format ``history`` (last item is the
    new user message). Returns the final text + the chunks it was grounded on.

    On navy/circuit-breaker failure returns ``status="failed"`` with a
    user-facing message — the caller persists the user turn regardless (ТЗ §5).
    """
    from app.services.llm import _call_navy, _call_with_backoff

    t0 = time.monotonic()
    conversation: list[dict] = [
        {"role": m["role"], "content": m.get("content") or ""} for m in history
    ]
    used_chunks: dict[str, dict] = {}
    tool_trace: list[dict] = []
    total_tokens = 0
    final_content = ""

    async def _call(*, with_tools: bool):
        return await _call_with_backoff(
            "local",
            _call_navy,
            SYSTEM_PROMPT,
            [],
            _TIMEOUT,
            max_tokens=_MAX_TOKENS,
            temperature=_TEMPERATURE,
            tools=TOOLS if with_tools else None,
            model_override=_MODEL,
            raw_messages=conversation,
        )

    for step in range(max_steps):
        resp = await _call(with_tools=True)
        if resp is None:
            # Circuit open / all retries failed / quota — graceful degrade.
            return AgentResult(
                content="Маняша сейчас недоступна, попробуйте позже.",
                status="failed",
                used_chunks=list(used_chunks.values()),
                tool_trace=tool_trace,
                tokens=total_tokens,
                retrieval_ms=int((time.monotonic() - t0) * 1000),
            )
        total_tokens += int(resp.output_tokens or 0)

        if not resp.tool_calls:
            final_content = resp.content or ""
            break

        # Normalize tool-call ids ONCE so the assistant turn and its tool
        # results use the SAME id. A provider that returns a null/empty id
        # would otherwise desync the two (assistant turn keeps None, result
        # gets a synthesized id) and the next round trips a 400 from the
        # OpenAI-compatible API ("tool_call_id has no matching tool_calls").
        normalized = []
        for i, tc in enumerate(resp.tool_calls):
            normalized.append({
                "id": tc.get("id") or f"call-{step}-{i}",
                "name": tc["name"],
                "args": tc["arguments"] if isinstance(tc.get("arguments"), dict) else {},
            })

        # Record the assistant tool-call turn verbatim so the next round's
        # tool results line up by call id.
        conversation.append({
            "role": "assistant",
            "content": resp.content or None,
            "tool_calls": [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": json.dumps(tc["args"], ensure_ascii=False),
                    },
                }
                for tc in normalized
            ],
        })

        for tc in normalized:
            name, args, call_id = tc["name"], tc["args"], tc["id"]
            result, chunks = await _dispatch_tool(name, args, db)
            for c in chunks:
                used_chunks[c["id"]] = c
            tool_trace.append({"step": step, "name": name, "args": args})
            conversation.append({
                "role": "tool",
                "tool_call_id": call_id,
                "name": name,
                "content": json.dumps(result, ensure_ascii=False),
            })
    else:
        # Hit the step cap while still calling tools — force a text-only turn
        # so we always return something coherent (ТЗ §5).
        logger.info("knowledge agent: hit max_steps=%d, forcing final turn", max_steps)
        resp = await _call(with_tools=False)
        if resp is not None:
            total_tokens += int(resp.output_tokens or 0)
            final_content = resp.content or ""

    generation_ms = int((time.monotonic() - t0) * 1000)

    if not final_content.strip():
        return AgentResult(
            content=(
                "Маняша не смогла сформулировать ответ по этому вопросу. "
                "Попробуйте переформулировать или загляните в Радар изменений."
            ),
            status="failed",
            used_chunks=list(used_chunks.values()),
            tool_trace=tool_trace,
            tokens=total_tokens,
            generation_ms=generation_ms,
        )

    return AgentResult(
        content=final_content,
        status="ok",
        used_chunks=list(used_chunks.values()),
        tool_trace=tool_trace,
        tokens=total_tokens,
        model=_MODEL,
        generation_ms=generation_ms,
    )


async def ask(question: str, user_id: uuid.UUID, db: AsyncSession) -> dict:
    """Backwards-compatible single-shot entry point (no server memory).

    The primary path is the conversations API (server memory + multi-turn);
    this thin wrapper runs a one-message turn and is kept for tests / any
    legacy caller. New code should go through ``run_agent_turn``.
    """
    result = await run_agent_turn(
        history=[{"role": "user", "content": question}],
        db=db,
        user_id=user_id,
    )
    return {
        "answer": result.content,
        "sources": result.used_chunks,
        "model": result.model,
        "status": result.status,
        "retrieval_ms": result.retrieval_ms,
        "generation_ms": result.generation_ms,
        "total_ms": result.generation_ms,
    }
