"""Unified history feed + Manyasha (Маняша) AI разбор endpoints.

Aggregates every kind of completed activity for a user — training
sessions, multi-call client stories, legal cases, exams and knowledge
quizzes — into one chronologically sorted feed, and provides a
RAG-grounded "разбор" (post-mortem) for any single attempt.
"""
from __future__ import annotations

import logging
import os
import uuid
from collections import defaultdict
from datetime import datetime
from statistics import mean

import openai
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models.case_scenario import CaseAttempt, CaseScenario
from app.models.exam import ExamAttempt, ExamDefinition, ExamQuestion
from app.models.knowledge import KnowledgeQuizSession, QuizSessionStatus
from app.models.roleplay import ClientStory
from app.models.training import SessionStatus, TrainingSession
from app.models.user import User
from app.services.knowledge_assistant import _build_sources
from app.services.rag_legal import retrieve_legal_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["history"])

# ── Manyasha persona ───────────────────────────────────────────────────
MANYASHA_SYSTEM_PROMPT = (
    "Ты — Маняша, AI-наставник платформы LegalHunter по банкротству "
    "физических лиц (ФЗ-127). Делаешь тёплый, конкретный разбор: что "
    "человек упустил, какие нормы стоило применить, что сделать лучше в "
    "следующий раз. Опираешься на предоставленный контекст базы знаний "
    "(ФЗ-127), не выдумываешь реквизиты дел. Пишешь по-русски, по делу, "
    "поддерживающе.\n\n"
    "Структура разбора:\n"
    "1. Короткий вывод.\n"
    "2. Слабые места (что упустил).\n"
    "3. Как правильно (со ссылкой на нормы из контекста).\n"
    "4. 2-3 шага улучшения.\n"
    "5. Короткий дисклеймер."
)

_MODEL = os.getenv("KNOWLEDGE_AI_MODEL", "deepseek-v4-pro")
_MAX_TOKENS = max(4096, int(os.getenv("KNOWLEDGE_AI_MAX_TOKENS", "4096")))
_TEMPERATURE = float(os.getenv("KNOWLEDGE_AI_TEMPERATURE", "0.3"))

_FALLBACK_REPORT = "Разбор временно недоступен — попробуйте позже."


# ── Response models ────────────────────────────────────────────────────
class UnifiedHistoryItem(BaseModel):
    kind: str  # "session" | "story" | "case" | "exam" | "quiz"
    id: str
    date: datetime
    title: str
    metrics: dict
    deep_link: str


class ExplainResponse(BaseModel):
    report_text: str
    weak_points: list[str]
    sources: list[dict]


# ── Helpers ────────────────────────────────────────────────────────────
def _get_ai_client() -> openai.AsyncOpenAI:
    return openai.AsyncOpenAI(
        base_url=settings.local_llm_url,
        api_key=settings.local_llm_api_key,
    )


def _round(v):
    return round(v, 2) if isinstance(v, (int, float)) else v


# ── 1. Unified feed ────────────────────────────────────────────────────
@router.get("/unified", response_model=list[UnifiedHistoryItem])
async def unified_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    """Aggregate all activity kinds, merge, sort by date desc, then paginate
    the MERGED list (fixes the legacy per-source pagination bug)."""
    items: list[UnifiedHistoryItem] = []

    # ── Training sessions (split into stories vs standalone) ──
    ts_result = await db.execute(
        select(TrainingSession).where(
            TrainingSession.user_id == user.id,
            TrainingSession.status == SessionStatus.completed,
        )
    )
    sessions = list(ts_result.scalars().all())

    story_sessions: dict[uuid.UUID, list[TrainingSession]] = defaultdict(list)
    standalone: list[TrainingSession] = []
    for s in sessions:
        if s.client_story_id is not None:
            story_sessions[s.client_story_id].append(s)
        else:
            standalone.append(s)

    # story titles
    story_map: dict[uuid.UUID, ClientStory] = {}
    if story_sessions:
        st_result = await db.execute(
            select(ClientStory).where(
                ClientStory.id.in_(list(story_sessions.keys())),
                ClientStory.user_id == user.id,
            )
        )
        story_map = {st.id: st for st in st_result.scalars().all()}

    for story_id, sess_list in story_sessions.items():
        scores = [s.score_total for s in sess_list if s.score_total is not None]
        latest = max(sess_list, key=lambda s: s.started_at)
        story = story_map.get(story_id)
        title = story.story_name if story else "История клиента"
        metrics = {
            "avg_score": _round(mean(scores)) if scores else None,
            "best_score": _round(max(scores)) if scores else None,
            "calls_completed": len(sess_list),
            "score_human_factor": _round(latest.score_human_factor),
            "score_narrative": _round(latest.score_narrative),
            "score_legal": _round(latest.score_legal),
        }
        items.append(UnifiedHistoryItem(
            kind="story",
            id=str(story_id),
            date=latest.started_at,
            title=title,
            metrics=metrics,
            deep_link=f"/results/{story_id}",
        ))

    for s in standalone:
        items.append(UnifiedHistoryItem(
            kind="session",
            id=str(s.id),
            date=s.started_at,
            title=str(s.scenario_id) if s.scenario_id else "Тренировка",
            metrics={
                "score_total": _round(s.score_total),
                "score_human_factor": _round(s.score_human_factor),
                "score_narrative": _round(s.score_narrative),
                "score_legal": _round(s.score_legal),
            },
            deep_link=f"/results/{s.id}",
        ))

    # ── Cases ──
    ca_result = await db.execute(
        select(CaseAttempt).where(
            CaseAttempt.user_id == user.id,
            CaseAttempt.completed.is_(True),
        )
    )
    case_attempts = list(ca_result.scalars().all())
    case_def_map: dict[str, CaseScenario] = {}
    if case_attempts:
        cd_result = await db.execute(
            select(CaseScenario).where(
                CaseScenario.id.in_({c.case_id for c in case_attempts})
            )
        )
        case_def_map = {c.id: c for c in cd_result.scalars().all()}

    for c in case_attempts:
        cdef = case_def_map.get(c.case_id)
        items.append(UnifiedHistoryItem(
            kind="case",
            id=str(c.case_id),
            date=c.finished_at or c.started_at,
            title=cdef.title if cdef else "Кейс",
            metrics={
                "score": c.score,
                "score_percent": c.score_percent,
                "stage1_score": c.stage1_score,
                "stage2_score": c.stage2_score,
                "max_score": cdef.max_score if cdef else 100,
            },
            deep_link=f"/cases/{c.case_id}",
        ))

    # ── Exams ──
    ea_result = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.user_id == user.id,
            ExamAttempt.finished_at.isnot(None),
        )
    )
    exam_attempts = list(ea_result.scalars().all())
    exam_def_map: dict[str, ExamDefinition] = {}
    if exam_attempts:
        ed_result = await db.execute(
            select(ExamDefinition).where(
                ExamDefinition.id.in_({e.exam_id for e in exam_attempts})
            )
        )
        exam_def_map = {e.id: e for e in ed_result.scalars().all()}

    for e in exam_attempts:
        edef = exam_def_map.get(e.exam_id)
        deep_link = (
            f"/exam/certificate/{e.exam_id}" if e.certificate_code else "/exam"
        )
        items.append(UnifiedHistoryItem(
            kind="exam",
            id=str(e.exam_id),
            date=e.finished_at or e.started_at,
            title=edef.title if edef else "Экзамен",
            metrics={
                "score_percent": e.score_percent,
                "passed": e.passed,
                "correct_count": e.correct_count,
                "total_count": e.total_count,
                "pass_threshold": edef.pass_threshold if edef else 88,
                "certificate_code": e.certificate_code,
            },
            deep_link=deep_link,
        ))

    # ── Quizzes ──
    qz_result = await db.execute(
        select(KnowledgeQuizSession).where(
            KnowledgeQuizSession.user_id == user.id,
            KnowledgeQuizSession.status == QuizSessionStatus.completed,
        )
    )
    for q in qz_result.scalars().all():
        items.append(UnifiedHistoryItem(
            kind="quiz",
            id=str(q.id),
            date=q.ended_at or q.created_at or q.started_at,
            title=f"Тест: {q.category or 'ФЗ-127'}",
            metrics={
                "score": _round(q.score),
                "correct_answers": q.correct_answers,
                "incorrect_answers": q.incorrect_answers,
                "total_questions": q.total_questions,
            },
            deep_link="/training",
        ))

    # ── Merge, sort, paginate ──
    items.sort(key=lambda i: i.date, reverse=True)
    return items[offset:offset + limit]


# ── 2. Explain (Маняша разбор) ─────────────────────────────────────────
async def _weak_points_exam(attempt: ExamAttempt, db: AsyncSession) -> list[str]:
    answers = attempt.answers or {}
    qids = list(answers.keys())
    weak: list[str] = []
    if qids:
        q_result = await db.execute(
            select(ExamQuestion).where(ExamQuestion.id.in_(
                [uuid.UUID(q) if not isinstance(q, uuid.UUID) else q for q in qids
                 if _is_uuid(q)]
            ))
        )
        cats: dict[str, int] = {}
        for q in q_result.scalars().all():
            chosen = answers.get(str(q.id))
            if chosen is not None and chosen != q.correct_option_id:
                cats[q.category] = cats.get(q.category, 0) + 1
        for cat, n in sorted(cats.items(), key=lambda kv: -kv[1]):
            weak.append(f"Ошибки в теме «{cat}» ({n})")
    if not weak and attempt.passed is False:
        weak.append("Экзамен не сдан — итоговый балл ниже порога.")
    return weak


def _is_uuid(v) -> bool:
    if isinstance(v, uuid.UUID):
        return True
    try:
        uuid.UUID(str(v))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _weak_points_case(attempt: CaseAttempt, cdef: CaseScenario | None) -> list[str]:
    max_score = cdef.max_score if cdef else 100
    half = max_score / 2 if max_score else 50
    weak: list[str] = []
    if attempt.stage1_score < half:
        weak.append("Слабый разбор первого этапа (выбор фактов/ходов).")
    if attempt.stage2_score < half:
        weak.append("Слабый разбор второго этапа (порядок/приоритизация действий).")
    if not weak and attempt.score_percent < 80:
        weak.append("Общий результат по кейсу ниже целевого уровня.")
    return weak


def _weak_points_session(sessions: list[TrainingSession]) -> list[str]:
    weak: list[str] = []
    latest = max(sessions, key=lambda s: s.started_at)
    sub = {
        "человеческий фактор": latest.score_human_factor,
        "нарратив/история": latest.score_narrative,
        "юридическая точность (ФЗ-127)": latest.score_legal,
    }
    for label, val in sub.items():
        if val is not None and val < 60:
            weak.append(f"Низкий показатель: {label} ({val:.0f}).")
    fb = (latest.feedback_text or "").strip()
    if fb:
        weak.append(f"Обратная связь по разговору: {fb[:300]}")
    return weak


def _weak_points_quiz(q: KnowledgeQuizSession) -> list[str]:
    weak: list[str] = []
    total = q.total_questions or 0
    if total and q.incorrect_answers:
        ratio = q.incorrect_answers / total
        weak.append(
            f"Тема «{q.category or 'ФЗ-127'}»: неверных ответов "
            f"{q.incorrect_answers} из {total} ({ratio * 100:.0f}%)."
        )
    elif (q.score or 0) < 80:
        weak.append(f"Невысокий результат в теме «{q.category or 'ФЗ-127'}».")
    return weak


async def _generate_report(
    db: AsyncSession,
    weak_points: list[str],
    query: str,
    summary: str,
) -> tuple[str, list[dict]]:
    """Run RAG + Manyasha LLM. Graceful fallback on any failure."""
    try:
        rag_ctx = await retrieve_legal_context(
            query, db, top_k=8, prefer_embedding=True
        )
    except Exception:
        logger.exception("Manyasha explain: RAG retrieval failed")
        return _FALLBACK_REPORT, []

    if not rag_ctx.has_results:
        return _FALLBACK_REPORT, []

    context_lines: list[str] = []
    for idx, r in enumerate(rag_ctx.results, 1):
        head = f"Источник {idx}: [{r.category}]"
        if r.law_article:
            head += f" {r.law_article}"
        if r.is_court_practice and r.court_case_reference:
            head += f" | {r.court_case_reference}"
        context_lines.append(f"{head}\n{r.fact_text}")
    context_block = "\n\n---\n\n".join(context_lines)

    user_prompt = (
        f"Слабые места ученика по этой попытке:\n{summary}\n\n"
        f"Контекст из базы знаний (ФЗ-127):\n\n{context_block}\n\n"
        "Сделай тёплый, конкретный разбор по своей структуре."
    )

    try:
        client = _get_ai_client()
        response = await client.chat.completions.create(
            model=_MODEL,
            messages=[
                {"role": "system", "content": MANYASHA_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=_MAX_TOKENS,
            temperature=_TEMPERATURE,
        )
        report_text = (response.choices[0].message.content or "").strip()
        if not report_text:
            return _FALLBACK_REPORT, _build_sources(rag_ctx)
        return report_text, _build_sources(rag_ctx)
    except Exception:
        logger.exception("Manyasha explain: LLM call failed")
        return _FALLBACK_REPORT, []


@router.get("/{kind}/{item_id}/explain", response_model=ExplainResponse)
async def explain(
    kind: str,
    item_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if kind not in {"session", "story", "case", "exam", "quiz"}:
        raise HTTPException(status_code=404, detail="Unknown kind")

    weak_points: list[str] = []
    query = "ФЗ-127 банкротство физических лиц"
    summary = ""

    if kind == "exam":
        try:
            attempt = (await db.execute(
                select(ExamAttempt).where(
                    ExamAttempt.user_id == user.id,
                    ExamAttempt.exam_id == item_id,
                    ExamAttempt.finished_at.isnot(None),
                ).order_by(ExamAttempt.finished_at.desc())
            )).scalars().first()
        except Exception:
            attempt = None
        if attempt is None:
            raise HTTPException(status_code=404, detail="Exam attempt not found")
        weak_points = await _weak_points_exam(attempt, db)
        query = ("ФЗ-127 " + " ".join(weak_points)) if weak_points else query
        summary = "; ".join(weak_points) or "Экзамен сдан, грубых ошибок нет."

    elif kind == "case":
        try:
            attempt = (await db.execute(
                select(CaseAttempt).where(
                    CaseAttempt.user_id == user.id,
                    CaseAttempt.case_id == item_id,
                    CaseAttempt.completed.is_(True),
                ).order_by(CaseAttempt.finished_at.desc())
            )).scalars().first()
        except Exception:
            attempt = None
        if attempt is None:
            raise HTTPException(status_code=404, detail="Case attempt not found")
        cdef = (await db.execute(
            select(CaseScenario).where(CaseScenario.id == item_id)
        )).scalars().first()
        weak_points = _weak_points_case(attempt, cdef)
        topic = cdef.category if cdef else ""
        query = f"ФЗ-127 {topic} {' '.join(weak_points)}".strip()
        summary = (
            f"Кейс «{cdef.title if cdef else item_id}». "
            + ("; ".join(weak_points) or "Хороший результат.")
        )

    elif kind == "quiz":
        try:
            q = (await db.execute(
                select(KnowledgeQuizSession).where(
                    KnowledgeQuizSession.id == uuid.UUID(item_id),
                    KnowledgeQuizSession.user_id == user.id,
                )
            )).scalars().first()
        except (ValueError, Exception):
            q = None
        if q is None:
            raise HTTPException(status_code=404, detail="Quiz session not found")
        weak_points = _weak_points_quiz(q)
        query = f"ФЗ-127 {q.category or ''} {' '.join(weak_points)}".strip()
        summary = "; ".join(weak_points) or f"Тест по теме «{q.category or 'ФЗ-127'}»."

    else:  # session | story
        try:
            if kind == "story":
                sess = list((await db.execute(
                    select(TrainingSession).where(
                        TrainingSession.user_id == user.id,
                        TrainingSession.client_story_id == uuid.UUID(item_id),
                        TrainingSession.status == SessionStatus.completed,
                    )
                )).scalars().all())
            else:
                sess = list((await db.execute(
                    select(TrainingSession).where(
                        TrainingSession.user_id == user.id,
                        TrainingSession.id == uuid.UUID(item_id),
                        TrainingSession.status == SessionStatus.completed,
                    )
                )).scalars().all())
        except (ValueError, Exception):
            sess = []
        if not sess:
            raise HTTPException(status_code=404, detail="Training session not found")
        weak_points = _weak_points_session(sess)
        query = ("ФЗ-127 переговоры с должником " + " ".join(weak_points))
        summary = "; ".join(weak_points) or "Разговор проведён уверенно."

    report_text, sources = await _generate_report(db, weak_points, query, summary)
    return ExplainResponse(
        report_text=report_text,
        weak_points=weak_points,
        sources=sources,
    )
