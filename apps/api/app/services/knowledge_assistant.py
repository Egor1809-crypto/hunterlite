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

SYSTEM_PROMPT = """
Ты — профессиональный AI-наставник LegalHunter по банкротному праву РФ и обучению арбитражных управляющих.

Твоя задача — помогать учиться, разбирать практические ситуации и объяснять ФЗ-127 так, чтобы пользователь мог применить ответ в тестах, кейсах, экзамене и переговорах с должником.

Правила качества:
1. Используй предоставленный контекст базы знаний как основной источник. Если точной нормы/практики нет в контексте, прямо пометь блок как "вне найденной базы" и не выдумывай реквизиты дел.
2. Давай развёрнутый, полезный ответ, а не 2-3 общие фразы. Для простого вопроса достаточно 5-8 пунктов; для сложного — полноценный разбор.
3. Структура ответа по умолчанию:
   - Короткий вывод.
   - Правовая база: статьи, главы, судебная практика из контекста.
   - Практический алгоритм действий.
   - Риски и частые ошибки.
   - Как это спросят на тесте/экзамене или как применить в кейсе.
   - Что уточнить у клиента/в документах.
4. Пиши на русском, понятно и уверенно. Не используй канцеляритам, но сохраняй юридическую точность.
5. Если вопрос учебный — объясняй как наставник: приводи мини-примеры, контрпримеры и проверочные вопросы.
6. Если пользователь просит стратегию по делу — разделяй "можно", "опасно", "нужно проверить".
7. В конце добавляй короткий дисклеймер: "Проверьте актуальную редакцию нормы и практику перед применением".
""".strip()

_MODEL = os.getenv("KNOWLEDGE_AI_MODEL", "deepseek-v4-pro")
_MAX_TOKENS = max(4096, int(os.getenv("KNOWLEDGE_AI_MAX_TOKENS", "4096")))
_TEMPERATURE = float(os.getenv("KNOWLEDGE_AI_TEMPERATURE", "0.3"))


def _build_context_block(rag_ctx: RAGContext) -> str:
    parts: list[str] = []
    for idx, r in enumerate(rag_ctx.results, 1):
        header = f"Источник {idx}: [{r.category}]"
        if r.law_article:
            header += f" {r.law_article}"
        if r.is_court_practice and r.court_case_reference:
            header += f" | {r.court_case_reference}"
        extra: list[str] = []
        if r.correct_response_hint:
            extra.append(f"Подсказка/правильный акцент: {r.correct_response_hint}")
        if r.common_errors:
            extra.append(f"Частые ошибки: {'; '.join(r.common_errors[:4])}")
        if r.blitz_question or r.blitz_answer:
            extra.append(f"Учебный блиц: {r.blitz_question or ''} {r.blitz_answer or ''}".strip())
        if r.follow_up_questions:
            extra.append(f"Контрольные вопросы: {'; '.join(r.follow_up_questions[:3])}")
        details = "\n".join(extra)
        parts.append(f"{header}\n{r.fact_text}\n{details}".strip())
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

    rag_ctx = await retrieve_legal_context(question, db, top_k=12, prefer_embedding=True)

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
        f"Вопрос пользователя: {question}\n\n"
        "Ответь как учебный наставник платформы: подробно, структурно, с практическими шагами, "
        "ошибками и проверкой понимания. Если вопрос короткий, всё равно дай полезный разбор."
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
