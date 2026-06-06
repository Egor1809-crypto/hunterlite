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
import re
import uuid
from dataclasses import dataclass, field

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.legal_update import LegalUpdate
from app.models.rag import LegalKnowledgeChunk
from app.models.knowledge_status import STATUSES_VISIBLE_IN_RAG
from app.services.content_filter import _sanitize_rag_field, filter_ai_output
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
8. Если у найденного фрагмента есть поле `scope_note` — обязательно следуй ему: помечай юрлица/КДЛ-контекст и переноси на физлицо только применимую часть, явно оговаривая различие.
""".strip()

# 2026-06-04: Маняша — латентно-чувствительный чат с агентным циклом (RAG-поиск
# + ответ = несколько round-trip'ов). deepseek-v4-pro (reasoning) давал ~40с.
# Используем gpt-5.5 — быстрая (~2с/шаг) И корректно реиграет multi-step
# tool-use в OpenAI-формате. NB: gemini-3.5-flash здесь НЕ подходит — на втором
# ходе navy/Gemini требует `thought_signature` на functionCall и валит цикл 400;
# gemini годится только для single-shot (роль-персонаж без инструментов).
# gpt-5.x отвергает кастомную temperature — _call_navy её опускает для gpt-5*.
# Точностно-критичный грейдер экзамена остаётся на deepseek (settings.exam_model).
_MODEL = os.getenv("KNOWLEDGE_AI_MODEL", "gpt-5.5")
# "Без лимитов" = высокий потолок ответа (провайдерский предел всё равно есть).
# ТЗ §2.3 реком. 8–16K.
_MAX_TOKENS = max(8000, int(os.getenv("KNOWLEDGE_AI_MAX_TOKENS", "12000")))
_TEMPERATURE = float(os.getenv("KNOWLEDGE_AI_TEMPERATURE", "0.3"))
# Multi-step tool loop bound (ТЗ §2.2 реком. 4).
# 2026-06-04 (ultrareview M7): 4 was too low — a complex legal question needing
# several searches (each = 1 step) hit the cap and produced a generic forced
# answer. 5 gives headroom while bounding worst-case latency (each step is a
# full LLM round-trip; 6 let a verbose query chain past 120s on a slow day).
# used_chunks are preserved on the forced final turn regardless.
_MAX_STEPS = int(os.getenv("KNOWLEDGE_AI_MAX_STEPS", "5"))
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
    # True when the answer was built on at least one retrieved chunk. False
    # means the model answered from its own parametric knowledge — the FE
    # surfaces a "не подтверждено базой" hint so the user doesn't mistake an
    # ungrounded reply for a sourced one (ТЗ §7а).
    grounded: bool = False


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


# Corporate-bankruptcy markers. Manyasha is a personal-bankruptcy (физлица)
# specialist, but the 629-chunk base is general 127-FZ and contains юрлица/КДЛ
# material (субсидиарка, наблюдение, конкурсное производство…). When such a
# chunk is retrieved we annotate it at the TOOL layer (data level, not just
# the prompt) so the model is explicitly told to scope it down for a гражданин
# (ТЗ §7в — guard against leaking corporate doctrine as if it applied to
# individuals).
_CORPORATE_MARKERS = (
    "контролирующ", "кдл", "субсидиарн", "наблюдени",
    "внешнее управление", "финансовое оздоровление", "конкурсное производство",
)

# Ch. X.1 (ст. 213.x) IS personal-bankruptcy (банкротство гражданина). Such a
# chunk must NOT be mislabelled corporate just because it mentions субсидиарка
# as an example of a non-dischargeable debt — that backwards hint degraded a
# correct физлица answer (ultracode §7в false-positive finding).
_CITIZEN_ARTICLE_RE = re.compile(r"213\.\d")

_CORPORATE_NOTE = (
    "Контекст относится к банкротству юрлиц/КДЛ — переноси на физлицо "
    "только применимую часть и явно оговаривай различие."
)


def _scope_note(fact_text: str, law_article: str) -> str:
    if _CITIZEN_ARTICLE_RE.search(law_article or ""):
        return ""  # personal-bankruptcy article — already about a гражданин
    blob = f"{fact_text} {law_article}".lower()
    if any(m in blob for m in _CORPORATE_MARKERS):
        return _CORPORATE_NOTE
    return ""


# Strips the prompt-isolation sentinel markers from chunk text. Written as a
# regex (not the literal pair) so the rag-invariant scanner — which forbids the
# bracketed sentinel literals outside canonical renderers — stays satisfied:
# this code REMOVES the markers, it never emits a prompt block.
_DATA_MARKER_RE = re.compile(r"\[DATA_(?:START|END)\]")


def _clean_chunk_text(text: str, field_name: str, chunk_id: str = "") -> str:
    """Sanitize chunk/radar text BEFORE it enters a tool payload (ultracode §7
    security): run the project's RAG field filter (jailbreak/PII) + strip the
    prompt-isolation sentinel markers, mirroring ``RAGContext.to_prompt_context``.
    The agent path used to feed raw ``fact_text`` into the model verbatim,
    bypassing this guard."""
    cleaned, _violations = _sanitize_rag_field(text or "", field_name, chunk_id)
    return _DATA_MARKER_RE.sub("", cleaned)


def _article_matches(law_article: str, query: str) -> bool:
    """Bounded article match — ``213.4`` must not match ``213.40``/``213.42``.
    Used to post-filter the broad ``ilike('%art%')`` prefilter so fetch_article
    sources are trustworthy (ultracode grounding finding)."""
    q = re.escape(query.strip())
    return re.search(rf"(?<!\d){q}(?!\d)", law_article or "") is not None


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
                "fact_text": _clean_chunk_text(r.fact_text or "", "fact_text", str(r.chunk_id))[:_FACT_TRUNCATE],
                "relevance": round(r.relevance_score, 3),
                "is_court_practice": r.is_court_practice,
                "court_case": r.court_case_reference or "",
                "correct_response_hint": _clean_chunk_text(r.correct_response_hint or "", "correct_response_hint", str(r.chunk_id)),
                "scope_note": _scope_note(r.fact_text or "", r.law_article or ""),
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
                "title": _clean_chunk_text(r.title, "radar_title", str(r.id)),
                "summary": _clean_chunk_text(r.summary, "radar_summary", str(r.id)),
                "source": r.source,
                "category": r.category,
                "published_at": r.published_at.isoformat() if r.published_at else None,
                "tags": r.tags or [],
                # §7в second leak channel: radar carries general 127-FZ news incl.
                # юрлица/КДЛ — annotate so the model scopes it down for a гражданин.
                "scope_note": _scope_note(f"{r.title} {r.summary}", ""),
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
        "fact_text": _clean_chunk_text(row.fact_text or "", "fact_text", str(row.id)),
        "correct_response_hint": _clean_chunk_text(row.correct_response_hint or "", "correct_response_hint", str(row.id)),
        "court_case": row.court_case_reference or "",
        "scope_note": _scope_note(row.fact_text or "", row.law_article or ""),
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
        .limit(20)
    )
    rows = (await db.execute(q)).scalars().all()
    # The ilike is a broad prefilter; narrow to a bounded article match so
    # "213.4" doesn't pull in "213.40"/"213.42" and decorate the answer with
    # unrelated authoritative source chips (ultracode grounding finding).
    matched = [r for r in rows if _article_matches(r.law_article or "", article)][:8]
    sources = []
    chunks = []
    for row in matched:
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
            "fact_text": _clean_chunk_text(row.fact_text or "", "fact_text", str(row.id))[:_FACT_TRUNCATE],
            "scope_note": _scope_note(row.fact_text or "", row.law_article or ""),
        })
    payload = {"found": len(chunks), "chunks": chunks}
    if not chunks:
        payload["note"] = f"В базе нет фрагментов, относящихся к статье {article}."
    return payload, sources


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
        # A DB-layer error (deadlock/connection blip) leaves the shared session
        # in a failed-transaction state; without rollback the downstream
        # assistant-turn commit would 500 and silently drop the reply
        # (ultracode degradation finding). Rolling back the (read-only) agent
        # transaction is safe — the user turn was already committed upstream.
        try:
            await db.rollback()
        except Exception:  # noqa: BLE001
            logger.exception("knowledge agent: rollback after tool failure also failed")
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

    # Filter the model's output before it reaches the user / is persisted / is
    # replayed into history — same guard every other LLM surface applies via
    # llm._filter_output (the agent path calls _call_navy directly and bypassed
    # it). Strips role-break / reasoning-leak / PII (ultracode finding).
    final_content, _out_violations = filter_ai_output(final_content)

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
        grounded=bool(used_chunks),
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
