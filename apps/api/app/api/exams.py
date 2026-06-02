from __future__ import annotations

import random
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.database import get_db
from app.models.exam import (
    ExamAttempt,
    ExamCertificate,
    ExamDefinition,
    ExamItem,
    ExamItemAttempt,
)
from app.models.training_map import TrainingMapProgress
from app.models.user import User
from app.services import exam_grader
from app.services.exam_rule_grader import RULE_TYPES, grade_rule_item

router = APIRouter(prefix="/exams", tags=["exams"])

# Clock-skew / auto-submit grace: an exam whose elapsed server time is within
# this many seconds of the limit is still "on time". Beyond it the certificate
# is withheld even on a passing score (§5 server-side timer validation).
_TIMER_GRACE_SECONDS = 60
# Per-item pass bar for AI items (display only; the exam passes on the weighted
# total vs the per-exam threshold, not per item).
_AI_ITEM_PASS_FRACTION = 0.6


# ── Schemas ─────────────────────────────────────────────────────

class ExamListItem(BaseModel):
    id: str
    title: str
    description: str
    categories: list
    question_count: int
    time_limit_minutes: int
    pass_threshold: int
    mechanic: str = "mcq"
    order_index: int
    unlock_condition: dict
    best_score: int | None = None
    attempts_count: int = 0
    passed: bool = False
    is_locked: bool = True
    certificate_code: str | None = None


class ItemOut(BaseModel):
    id: str
    type: str
    prompt: str
    payload: dict
    points: int
    article_reference: str | None = None


class StartExamResponse(BaseModel):
    attempt_id: str
    exam_id: str
    mechanic: str
    items: list[ItemOut]
    time_limit_minutes: int
    pass_threshold: int


class SubmitRequest(BaseModel):
    attempt_id: str
    answers: dict[str, Any]
    time_spent_seconds: int | None = None


class ItemResult(BaseModel):
    item_id: str
    type: str
    prompt: str
    points: int
    score: float
    max_score: float
    passed: bool
    graded_by: str  # rule | ai | pending
    article_reference: str | None = None
    explanation: str = ""
    # AI items only:
    covered: list[str] = []
    missed: list[str] = []
    feedback: str = ""
    # rule items only (educational reveal):
    answer_key: dict | None = None


class SubmitResponse(BaseModel):
    attempt_id: str
    score_percent: int
    weighted_score: float
    max_weighted_score: float
    passed: bool
    grading_status: str  # complete | pending
    certificate_code: str | None
    time_valid: bool
    pass_threshold: int
    results: list[ItemResult]


class AttemptSummary(BaseModel):
    id: str
    started_at: str
    finished_at: str | None
    score_percent: int | None
    correct_count: int | None
    total_count: int | None
    passed: bool | None
    grading_status: str | None = None
    certificate_code: str | None


class CertificatePublic(BaseModel):
    user_name: str
    exam_title: str
    score_percent: int
    issued_at: str
    certificate_code: str


# ── Helpers ──────────────────────────────────────────────────────

def _generate_certificate_code(exam_id: str) -> str:
    num = exam_id.replace("exam-", "")
    year = datetime.now(timezone.utc).year
    rand = secrets.token_hex(4).upper()
    return f"HL-EXAM{num}-{year}-{rand}"


async def _check_exam_unlocked(exam: ExamDefinition, user_id: uuid.UUID, db: AsyncSession) -> bool:
    if not exam.unlock_condition:
        return True
    required_exam = exam.unlock_condition.get("required_exam")
    if not required_exam:
        return True
    passed_count = (await db.execute(
        select(func.count()).select_from(ExamAttempt).where(
            ExamAttempt.user_id == user_id,
            ExamAttempt.exam_id == required_exam,
            ExamAttempt.passed.is_(True),
        )
    )).scalar_one()
    return passed_count > 0


async def _assemble_items(exam: ExamDefinition, db: AsyncSession) -> list[ExamItem]:
    """Select the items for one attempt according to the exam blueprint.

    blueprint = {"items": [{"type": "case_analysis", "count": 3}], "shuffle": bool}
    When count >= available, all active items of that type are used. Items keep
    their author-defined order_index unless `shuffle` is set.
    """
    all_items = (await db.execute(
        select(ExamItem).where(
            ExamItem.exam_id == exam.id, ExamItem.is_active.is_(True),
        ).order_by(ExamItem.order_index)
    )).scalars().all()

    blueprint = exam.blueprint or {}
    specs = blueprint.get("items")
    if not specs:
        selected = list(all_items)
    else:
        by_type: dict[str, list[ExamItem]] = {}
        for it in all_items:
            by_type.setdefault(it.type, []).append(it)
        selected = []
        for spec in specs:
            pool = by_type.get(spec.get("type"), [])
            count = spec.get("count", len(pool))
            if count >= len(pool):
                chosen = list(pool)
            else:
                chosen = random.sample(pool, count)
                chosen.sort(key=lambda i: i.order_index)
            selected.extend(chosen)

    if blueprint.get("shuffle"):
        random.shuffle(selected)
    else:
        selected.sort(key=lambda i: i.order_index)
    return selected


def _answer_text(raw: Any) -> str:
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        return str(raw.get("text") or raw.get("answer") or "")
    return "" if raw is None else str(raw)


async def _grade_items(
    attempt: ExamAttempt,
    items: list[ExamItem],
    answers: dict[str, Any],
    db: AsyncSession,
) -> tuple[list[ItemResult], float, float, bool]:
    """Grade every item; returns (results, total_score, total_max, pending)."""
    results: list[ItemResult] = []
    total_score = 0.0
    total_max = 0.0
    pending = False

    for item in items:
        raw = answers.get(str(item.id))
        points = float(item.points)
        total_max += points

        if item.type in RULE_TYPES:
            rg = grade_rule_item(item.type, item.answer_key, raw, points)
            total_score += rg.score
            graded_by, score, max_score, passed = "rule", rg.score, rg.max_score, rg.passed
            ai_feedback = None
            results.append(ItemResult(
                item_id=str(item.id), type=item.type, prompt=item.prompt,
                points=item.points, score=score, max_score=max_score,
                passed=passed, graded_by=graded_by,
                article_reference=item.article_reference, explanation=item.explanation,
                answer_key=item.answer_key,
            ))
        else:
            answer_text = _answer_text(raw)
            fact = (item.payload or {}).get("fact_pattern", "")
            task_prompt = (f"{fact}\n\nЗадание: {item.prompt}" if fact else item.prompt)
            rag_ctx = await exam_grader.build_rag_grounding(db, item.rag_chunk_refs)
            g = await exam_grader.grade_item(
                item_id=str(item.id), item_type=item.type, prompt=task_prompt,
                user_answer=answer_text, max_score=points,
                rubric=item.rubric, answer_key=item.answer_key,
                rag_context=rag_ctx, article_reference=item.article_reference,
            )
            if g is None:
                pending = True
                graded_by, score, max_score, passed = "pending", 0.0, points, False
                ai_feedback = {"covered": [], "missed": [],
                               "feedback": "Оценка ещё не завершена — сервис ИИ недоступен. Перепройдите грейд позже."}
            else:
                total_score += g.score
                passed = g.score >= _AI_ITEM_PASS_FRACTION * points
                graded_by, score, max_score = "ai", g.score, g.max_score
                ai_feedback = {"covered": g.covered, "missed": g.missed,
                               "feedback": g.feedback, "percent": g.percent}
            results.append(ItemResult(
                item_id=str(item.id), type=item.type, prompt=item.prompt,
                points=item.points, score=score, max_score=max_score, passed=passed,
                graded_by=graded_by, article_reference=item.article_reference,
                explanation=item.explanation,
                covered=ai_feedback.get("covered", []),
                missed=ai_feedback.get("missed", []),
                feedback=ai_feedback.get("feedback", ""),
            ))

        db.add(ExamItemAttempt(
            id=uuid.uuid4(), attempt_id=attempt.id, item_id=item.id,
            raw_answer=(raw if isinstance(raw, dict) else {"value": raw}),
            score=score, max_score=max_score, passed=passed,
            ai_feedback=ai_feedback, graded_by=graded_by,
        ))

    return results, total_score, total_max, pending


async def _finalize_attempt(
    attempt: ExamAttempt,
    exam: ExamDefinition,
    results: list[ItemResult],
    total_score: float,
    total_max: float,
    pending: bool,
    time_valid: bool,
    user: User,
    db: AsyncSession,
) -> SubmitResponse:
    score_percent = round(total_score / total_max * 100) if total_max > 0 else 0
    grading_status = "pending" if pending else "complete"
    # A certificate is issued only on a complete grade, a passing weighted score,
    # AND a valid timer. Pending or over-time attempts never certify (§4-§5).
    passed = (score_percent >= exam.pass_threshold) and not pending and time_valid

    prior_code = attempt.certificate_code
    existing_cert = None
    if prior_code is not None:
        existing_cert = (await db.execute(
            select(ExamCertificate).where(ExamCertificate.attempt_id == attempt.id)
        )).scalar_one_or_none()

    # Regrade that hit a transient AI outage (pending) must NOT revoke an
    # already-earned certificate nor downgrade the verdict — keep the prior
    # earned state intact (the outage is not the appellant's fault).
    preserve_prior = prior_code is not None and pending
    certificate_code = prior_code

    if preserve_prior:
        score_percent = attempt.score_percent if attempt.score_percent is not None else score_percent
        total_score = attempt.weighted_score if attempt.weighted_score is not None else total_score
        total_max = attempt.max_weighted_score if attempt.max_weighted_score is not None else total_max
        grading_status = "complete"
        passed = True
    elif passed:
        if certificate_code is None:
            existing_best = (await db.execute(
                select(func.max(ExamAttempt.score_percent)).where(
                    ExamAttempt.user_id == user.id,
                    ExamAttempt.exam_id == exam.id,
                    ExamAttempt.passed.is_(True),
                )
            )).scalar_one()
            if existing_best is None or score_percent >= existing_best:
                certificate_code = _generate_certificate_code(exam.id)
                db.add(ExamCertificate(
                    id=uuid.uuid4(), user_id=user.id, exam_id=exam.id, attempt_id=attempt.id,
                    certificate_code=certificate_code, score_percent=score_percent,
                    issued_at=datetime.now(timezone.utc), user_name=user.full_name,
                ))
        elif existing_cert is not None:
            # Regrade still passing → keep the cert but sync its verifiable score
            # so the public certificate never disagrees with the attempt (§5).
            existing_cert.score_percent = score_percent
    else:
        # Genuine complete-but-failing (or over-time) regrade → revoke a prior
        # certificate: a live cert on a now-failing attempt is indefensible.
        if existing_cert is not None:
            await db.execute(delete(ExamCertificate).where(ExamCertificate.id == existing_cert.id))
        certificate_code = None

    correct_count = sum(1 for r in results if r.passed)
    if not preserve_prior:
        attempt.score_percent = score_percent
        attempt.weighted_score = round(total_score, 2)
        attempt.max_weighted_score = round(total_max, 2)
        attempt.correct_count = correct_count
        attempt.total_count = len(results)
    attempt.passed = passed
    attempt.grading_status = grading_status
    attempt.certificate_code = certificate_code

    now = attempt.finished_at or datetime.now(timezone.utc)
    progress = (await db.execute(
        select(TrainingMapProgress).where(TrainingMapProgress.user_id == user.id)
    )).scalar_one_or_none()
    exam_data = {"exam_id": exam.id, "score_percent": score_percent,
                 "passed": passed, "finished_at": now.isoformat()}
    if progress:
        exams_dict = dict(progress.exams) if progress.exams else {}
        exams_dict[exam.id] = exam_data
        await db.execute(
            update(TrainingMapProgress).where(TrainingMapProgress.user_id == user.id)
            .values(exams=exams_dict, updated_at=now)
        )
    else:
        db.add(TrainingMapProgress(user_id=user.id, test_map={}, exams={exam.id: exam_data}, cases={}))

    await db.flush()
    return SubmitResponse(
        attempt_id=str(attempt.id), score_percent=score_percent,
        weighted_score=round(total_score, 2), max_weighted_score=round(total_max, 2),
        passed=passed, grading_status=grading_status, certificate_code=certificate_code,
        time_valid=time_valid, pass_threshold=exam.pass_threshold, results=results,
    )


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/")
async def list_exams(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ExamListItem]:
    exams = (await db.execute(
        select(ExamDefinition).order_by(ExamDefinition.order_index)
    )).scalars().all()
    attempts = (await db.execute(
        select(ExamAttempt).where(ExamAttempt.user_id == user.id)
    )).scalars().all()

    attempts_by_exam: dict[str, list[ExamAttempt]] = {}
    for a in attempts:
        attempts_by_exam.setdefault(a.exam_id, []).append(a)

    result = []
    for exam in exams:
        att_list = attempts_by_exam.get(exam.id, [])
        best = max((a.score_percent for a in att_list if a.score_percent is not None), default=None)
        is_passed = any(a.passed for a in att_list)
        cert_code = next((a.certificate_code for a in att_list if a.certificate_code), None)
        is_locked = not await _check_exam_unlocked(exam, user.id, db)
        result.append(ExamListItem(
            id=exam.id, title=exam.title, description=exam.description,
            categories=exam.categories, question_count=exam.question_count,
            time_limit_minutes=exam.time_limit_minutes, pass_threshold=exam.pass_threshold,
            mechanic=exam.mechanic, order_index=exam.order_index,
            unlock_condition=exam.unlock_condition, best_score=best,
            attempts_count=len(att_list), passed=is_passed, is_locked=is_locked,
            certificate_code=cert_code,
        ))
    return result


@router.post("/{exam_id}/start")
@limiter.limit("5/hour")
async def start_exam(
    request: Request,
    exam_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StartExamResponse:
    exam = (await db.execute(
        select(ExamDefinition).where(ExamDefinition.id == exam_id)
    )).scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Экзамен не найден")
    if not await _check_exam_unlocked(exam, user.id, db):
        raise HTTPException(status_code=403, detail="Экзамен заблокирован. Сдайте предыдущий экзамен.")

    items = await _assemble_items(exam, db)
    if not items:
        raise HTTPException(status_code=400, detail="Для экзамена не настроены задания")

    item_ids = [str(i.id) for i in items]
    attempt = ExamAttempt(
        id=uuid.uuid4(), user_id=user.id, exam_id=exam_id,
        started_at=datetime.now(timezone.utc), question_ids=item_ids,
        grading_status="complete",
    )
    db.add(attempt)
    await db.flush()

    return StartExamResponse(
        attempt_id=str(attempt.id), exam_id=exam_id, mechanic=exam.mechanic,
        time_limit_minutes=exam.time_limit_minutes, pass_threshold=exam.pass_threshold,
        items=[ItemOut(
            id=str(i.id), type=i.type, prompt=i.prompt, payload=i.payload or {},
            points=i.points, article_reference=i.article_reference,
        ) for i in items],
    )


@router.post("/{exam_id}/submit")
async def submit_exam(
    exam_id: str,
    body: SubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmitResponse:
    attempt = (await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.id == uuid.UUID(body.attempt_id),
            ExamAttempt.user_id == user.id,
            ExamAttempt.exam_id == exam_id,
        )
    )).scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")
    if attempt.finished_at is not None:
        raise HTTPException(status_code=400, detail="Экзамен уже завершён")

    item_ids = attempt.question_ids or []
    if not item_ids:
        raise HTTPException(status_code=400, detail="Нет заданий в попытке")

    exam = (await db.execute(
        select(ExamDefinition).where(ExamDefinition.id == exam_id)
    )).scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Экзамен не найден")

    items = (await db.execute(
        select(ExamItem).where(ExamItem.id.in_([uuid.UUID(i) for i in item_ids]))
    )).scalars().all()
    order = {iid: pos for pos, iid in enumerate(item_ids)}
    items = sorted(items, key=lambda i: order.get(str(i.id), 0))

    # Server-side timer validation (§5): trust server clocks, not the client.
    now = datetime.now(timezone.utc)
    started = attempt.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    elapsed = (now - started).total_seconds()
    time_valid = elapsed <= exam.time_limit_minutes * 60 + _TIMER_GRACE_SECONDS

    attempt.finished_at = now
    attempt.time_spent_seconds = int(elapsed)
    attempt.answers = body.answers

    results, total_score, total_max, pending = await _grade_items(attempt, items, body.answers, db)
    return await _finalize_attempt(
        attempt, exam, results, total_score, total_max, pending, time_valid, user, db,
    )


@router.post("/attempts/{attempt_id}/regrade")
async def regrade_attempt(
    attempt_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmitResponse:
    """Re-run grading for an attempt (appeal / recover from grading_pending).

    AI item caches are invalidated so the model re-judges from scratch (§5).
    The certificate, if already issued, is preserved.
    """
    attempt = (await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.id == uuid.UUID(attempt_id),
            ExamAttempt.user_id == user.id,
        )
    )).scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")
    if attempt.finished_at is None:
        raise HTTPException(status_code=400, detail="Попытка ещё не отправлена")

    exam = (await db.execute(
        select(ExamDefinition).where(ExamDefinition.id == attempt.exam_id)
    )).scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Экзамен не найден")

    item_ids = attempt.question_ids or []
    items = (await db.execute(
        select(ExamItem).where(ExamItem.id.in_([uuid.UUID(i) for i in item_ids]))
    )).scalars().all()
    order = {iid: pos for pos, iid in enumerate(item_ids)}
    items = sorted(items, key=lambda i: order.get(str(i.id), 0))

    answers = attempt.answers or {}
    for item in items:
        if item.type not in RULE_TYPES:
            await exam_grader.invalidate_cache(
                str(item.id), _answer_text(answers.get(str(item.id))),
                rubric=item.rubric, answer_key=item.answer_key,
            )

    await db.execute(delete(ExamItemAttempt).where(ExamItemAttempt.attempt_id == attempt.id))

    started = attempt.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    finished = attempt.finished_at
    if finished.tzinfo is None:
        finished = finished.replace(tzinfo=timezone.utc)
    elapsed = (finished - started).total_seconds()
    time_valid = elapsed <= exam.time_limit_minutes * 60 + _TIMER_GRACE_SECONDS

    results, total_score, total_max, pending = await _grade_items(attempt, items, answers, db)
    return await _finalize_attempt(
        attempt, exam, results, total_score, total_max, pending, time_valid, user, db,
    )


@router.get("/attempts/{attempt_id}")
async def get_attempt_detail(
    attempt_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmitResponse:
    """Detailed per-item breakdown (covered/missed/feedback) for a graded attempt."""
    attempt = (await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.id == uuid.UUID(attempt_id),
            ExamAttempt.user_id == user.id,
        )
    )).scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Попытка не найдена")

    exam = (await db.execute(
        select(ExamDefinition).where(ExamDefinition.id == attempt.exam_id)
    )).scalar_one()

    rows = (await db.execute(
        select(ExamItemAttempt).where(ExamItemAttempt.attempt_id == attempt.id)
    )).scalars().all()
    items = (await db.execute(
        select(ExamItem).where(ExamItem.id.in_([r.item_id for r in rows]))
    )).scalars().all() if rows else []
    item_by_id = {i.id: i for i in items}
    order = {iid: pos for pos, iid in enumerate(attempt.question_ids or [])}
    rows = sorted(rows, key=lambda r: order.get(str(r.item_id), 0))

    results: list[ItemResult] = []
    for r in rows:
        item = item_by_id.get(r.item_id)
        fb = r.ai_feedback or {}
        results.append(ItemResult(
            item_id=str(r.item_id),
            type=item.type if item else "",
            prompt=item.prompt if item else "",
            points=item.points if item else int(r.max_score),
            score=r.score, max_score=r.max_score, passed=r.passed, graded_by=r.graded_by,
            article_reference=item.article_reference if item else None,
            explanation=item.explanation if item else "",
            covered=fb.get("covered", []), missed=fb.get("missed", []),
            feedback=fb.get("feedback", ""),
            answer_key=item.answer_key if (item and item.type in RULE_TYPES) else None,
        ))

    return SubmitResponse(
        attempt_id=str(attempt.id),
        score_percent=attempt.score_percent or 0,
        weighted_score=attempt.weighted_score or 0.0,
        max_weighted_score=attempt.max_weighted_score or 0.0,
        passed=bool(attempt.passed),
        grading_status=attempt.grading_status or "complete",
        certificate_code=attempt.certificate_code,
        time_valid=True,
        pass_threshold=exam.pass_threshold,
        results=results,
    )


@router.get("/{exam_id}/results")
async def get_results(
    exam_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AttemptSummary]:
    attempts = (await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.user_id == user.id, ExamAttempt.exam_id == exam_id,
        ).order_by(ExamAttempt.started_at.desc())
    )).scalars().all()
    return [
        AttemptSummary(
            id=str(a.id),
            started_at=a.started_at.isoformat() if a.started_at else "",
            finished_at=a.finished_at.isoformat() if a.finished_at else None,
            score_percent=a.score_percent, correct_count=a.correct_count,
            total_count=a.total_count, passed=a.passed,
            grading_status=a.grading_status, certificate_code=a.certificate_code,
        )
        for a in attempts
    ]


@router.get("/certificate/{code}")
async def verify_certificate(
    code: str,
    db: AsyncSession = Depends(get_db),
) -> CertificatePublic:
    cert = (await db.execute(
        select(ExamCertificate).where(ExamCertificate.certificate_code == code)
    )).scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Сертификат не найден")
    exam = (await db.execute(
        select(ExamDefinition).where(ExamDefinition.id == cert.exam_id)
    )).scalar_one_or_none()
    return CertificatePublic(
        user_name=cert.user_name,
        exam_title=exam.title if exam else cert.exam_id,
        score_percent=cert.score_percent,
        issued_at=cert.issued_at.isoformat(),
        certificate_code=cert.certificate_code,
    )
