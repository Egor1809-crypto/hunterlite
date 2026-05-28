"""RAG-powered AI assistant for bankruptcy law (127-FZ) knowledge base."""

import logging
import os
import time
import uuid

import openai
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.rag_legal import retrieve_legal_context, RAGContext

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Ты — AI-помощник по банкротному праву (ФЗ-127). "
    "Отвечай на вопросы, опираясь ТОЛЬКО на предоставленный контекст из базы знаний. "
    "Указывай конкретные статьи закона, номера дел, даты постановлений — всё, "
    "что есть в контексте. Если в контексте нет информации для ответа — "
    "скажи об этом прямо, не выдумывай. Отвечай на русском языке. "
    "Будь точен, конкретен, структурируй ответ. "
    "Используй маркированные списки для перечислений."
)

_MODEL = os.getenv("KNOWLEDGE_AI_MODEL", "deepseek-v4-pro")
_MAX_TOKENS = int(os.getenv("KNOWLEDGE_AI_MAX_TOKENS", "2048"))
_TEMPERATURE = float(os.getenv("KNOWLEDGE_AI_TEMPERATURE", "0.3"))


def _build_context_block(rag_ctx: RAGContext) -> str:
    parts: list[str] = []
    for r in rag_ctx.results:
        header = f"[{r.category}]"
        if r.law_article:
            header += f" {r.law_article}"
        if r.is_court_practice and r.court_case_reference:
            header += f" | {r.court_case_reference}"
        parts.append(f"{header}\n{r.fact_text}")
    return "\n\n---\n\n".join(parts)


def _build_sources(rag_ctx: RAGContext) -> list[dict]:
    sources = []
    for r in rag_ctx.results:
        sources.append({
            "category": r.category,
            "law_article": r.law_article or "",
            "relevance": round(r.relevance_score, 3),
            "is_court_practice": r.is_court_practice,
            "court_case": r.court_case_reference or "",
        })
    return sources


def _get_ai_client() -> openai.AsyncOpenAI:
    return openai.AsyncOpenAI(
        base_url=settings.local_llm_url,
        api_key=settings.local_llm_api_key,
    )


async def ask(
    question: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    t0 = time.monotonic()

    rag_ctx = await retrieve_legal_context(question, db, top_k=5, prefer_embedding=True)

    if not rag_ctx.has_results:
        return {
            "answer": (
                "К сожалению, в базе знаний не нашлось релевантной информации "
                "по вашему вопросу. Попробуйте переформулировать или задать "
                "более конкретный вопрос."
            ),
            "sources": [],
            "model": _MODEL,
            "retrieval_ms": round(rag_ctx.retrieval_ms),
            "generation_ms": 0,
        }

    context_block = _build_context_block(rag_ctx)
    user_prompt = (
        f"Контекст из базы знаний:\n\n{context_block}\n\n"
        f"Вопрос пользователя: {question}"
    )

    client = _get_ai_client()
    t1 = time.monotonic()

    try:
        response = await client.chat.completions.create(
            model=_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=_MAX_TOKENS,
            temperature=_TEMPERATURE,
        )
        answer = response.choices[0].message.content or ""
        actual_model = response.model or _MODEL
    except Exception:
        logger.exception("Knowledge AI LLM call failed for user %s", user_id)
        answer = (
            "Произошла ошибка при генерации ответа. "
            "Пожалуйста, попробуйте позже."
        )
        actual_model = _MODEL

    generation_ms = int((time.monotonic() - t1) * 1000)
    total_ms = int((time.monotonic() - t0) * 1000)

    return {
        "answer": answer,
        "sources": _build_sources(rag_ctx),
        "model": actual_model,
        "retrieval_ms": round(rag_ctx.retrieval_ms),
        "generation_ms": generation_ms,
        "total_ms": total_ms,
    }
