from __future__ import annotations

import random
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.database import get_db
from app.models.exam import ExamAttempt, ExamCertificate, ExamDefinition, ExamQuestion
from app.models.training_map import TrainingMapProgress
from app.models.user import User

router = APIRouter(prefix="/exams", tags=["exams"])


# ── Schemas ─────────────────────────────────────────────────────

class ExamListItem(BaseModel):
    id: str
    title: str
    description: str
    categories: list
    question_count: int
    time_limit_minutes: int
    pass_threshold: int
    order_index: int
    unlock_condition: dict
    best_score: int | None = None
    attempts_count: int = 0
    passed: bool = False
    is_locked: bool = True
    certificate_code: str | None = None


class QuestionOut(BaseModel):
    id: str
    text: str
    options: list[dict]


class StartExamResponse(BaseModel):
    attempt_id: str
    questions: list[QuestionOut]
    time_limit_minutes: int


class SubmitRequest(BaseModel):
    attempt_id: str
    answers: dict[str, str]
    time_spent_seconds: int | None = None


class QuestionResult(BaseModel):
    question_id: str
    question_text: str
    options: list[dict]
    chosen_option_id: str | None
    correct_option_id: str
    was_correct: bool
    explanation: str
    article_reference: str | None


class SubmitResponse(BaseModel):
    score_percent: int
    correct_count: int
    total_count: int
    passed: bool
    certificate_code: str | None
    results: list[QuestionResult]


class AttemptSummary(BaseModel):
    id: str
    started_at: str
    finished_at: str | None
    score_percent: int | None
    correct_count: int | None
    total_count: int | None
    passed: bool | None
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


async def _check_exam_unlocked(
    exam: ExamDefinition,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
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

    passed_exams: set[str] = set()
    for eid, att_list in attempts_by_exam.items():
        if any(a.passed for a in att_list):
            passed_exams.add(eid)

    result = []
    for exam in exams:
        att_list = attempts_by_exam.get(exam.id, [])
        best = max((a.score_percent for a in att_list if a.score_percent is not None), default=None)
        is_passed = exam.id in passed_exams
        cert_code = None
        for a in att_list:
            if a.certificate_code:
                cert_code = a.certificate_code
                break

        is_locked = not await _check_exam_unlocked(exam, user.id, db)

        result.append(ExamListItem(
            id=exam.id,
            title=exam.title,
            description=exam.description,
            categories=exam.categories,
            question_count=exam.question_count,
            time_limit_minutes=exam.time_limit_minutes,
            pass_threshold=exam.pass_threshold,
            order_index=exam.order_index,
            unlock_condition=exam.unlock_condition,
            best_score=best,
            attempts_count=len(att_list),
            passed=is_passed,
            is_locked=is_locked,
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

    questions_query = select(ExamQuestion).where(
        ExamQuestion.category.in_(exam.categories),
        ExamQuestion.is_active.is_(True),
    )
    all_questions = (await db.execute(questions_query)).scalars().all()

    if len(all_questions) < exam.question_count:
        selected = all_questions
    else:
        selected = random.sample(list(all_questions), exam.question_count)

    random.shuffle(selected)

    question_ids = [str(q.id) for q in selected]

    attempt = ExamAttempt(
        id=uuid.uuid4(),
        user_id=user.id,
        exam_id=exam_id,
        started_at=datetime.now(timezone.utc),
        question_ids=question_ids,
    )
    db.add(attempt)
    await db.flush()

    questions_out = []
    for q in selected:
        opts = list(q.options)
        random.shuffle(opts)
        questions_out.append(QuestionOut(
            id=str(q.id),
            text=q.question_text,
            options=opts,
        ))

    return StartExamResponse(
        attempt_id=str(attempt.id),
        questions=questions_out,
        time_limit_minutes=exam.time_limit_minutes,
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

    question_ids = attempt.question_ids or []
    if not question_ids:
        raise HTTPException(status_code=400, detail="Нет вопросов в попытке")

    questions = (await db.execute(
        select(ExamQuestion).where(
            ExamQuestion.id.in_([uuid.UUID(qid) for qid in question_ids])
        )
    )).scalars().all()
    q_map = {str(q.id): q for q in questions}

    exam = (await db.execute(
        select(ExamDefinition).where(ExamDefinition.id == exam_id)
    )).scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Экзамен не найден")

    correct_count = 0
    total_count = len(question_ids)
    results: list[QuestionResult] = []

    for qid in question_ids:
        q = q_map.get(qid)
        if not q:
            continue
        chosen = body.answers.get(qid)
        was_correct = chosen == q.correct_option_id
        if was_correct:
            correct_count += 1
        results.append(QuestionResult(
            question_id=qid,
            question_text=q.question_text,
            options=q.options,
            chosen_option_id=chosen,
            correct_option_id=q.correct_option_id,
            was_correct=was_correct,
            explanation=q.explanation,
            article_reference=q.article_reference,
        ))

    score_percent = round(correct_count / total_count * 100) if total_count > 0 else 0
    passed = score_percent >= exam.pass_threshold

    certificate_code = None
    if passed:
        existing_best = (await db.execute(
            select(func.max(ExamAttempt.score_percent)).where(
                ExamAttempt.user_id == user.id,
                ExamAttempt.exam_id == exam_id,
                ExamAttempt.passed.is_(True),
            )
        )).scalar_one()
        if existing_best is None or score_percent >= existing_best:
            certificate_code = _generate_certificate_code(exam_id)
            cert = ExamCertificate(
                id=uuid.uuid4(),
                user_id=user.id,
                exam_id=exam_id,
                attempt_id=attempt.id,
                certificate_code=certificate_code,
                score_percent=score_percent,
                issued_at=datetime.now(timezone.utc),
                user_name=user.full_name,
            )
            db.add(cert)

    now = datetime.now(timezone.utc)
    attempt.finished_at = now
    attempt.time_spent_seconds = body.time_spent_seconds
    attempt.answers = body.answers
    attempt.score_percent = score_percent
    attempt.correct_count = correct_count
    attempt.total_count = total_count
    attempt.passed = passed
    attempt.certificate_code = certificate_code

    progress = (await db.execute(
        select(TrainingMapProgress).where(TrainingMapProgress.user_id == user.id)
    )).scalar_one_or_none()
    exam_data = {
        "exam_id": exam_id,
        "score_percent": score_percent,
        "passed": passed,
        "finished_at": now.isoformat(),
    }
    if progress:
        exams_dict = dict(progress.exams) if progress.exams else {}
        exams_dict[exam_id] = exam_data
        await db.execute(
            update(TrainingMapProgress)
            .where(TrainingMapProgress.user_id == user.id)
            .values(exams=exams_dict, updated_at=now)
        )
    else:
        new_progress = TrainingMapProgress(
            user_id=user.id,
            test_map={},
            exams={exam_id: exam_data},
            cases={},
        )
        db.add(new_progress)

    await db.flush()

    return SubmitResponse(
        score_percent=score_percent,
        correct_count=correct_count,
        total_count=total_count,
        passed=passed,
        certificate_code=certificate_code,
        results=results,
    )


@router.get("/{exam_id}/results")
async def get_results(
    exam_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AttemptSummary]:
    attempts = (await db.execute(
        select(ExamAttempt)
        .where(
            ExamAttempt.user_id == user.id,
            ExamAttempt.exam_id == exam_id,
        )
        .order_by(ExamAttempt.started_at.desc())
    )).scalars().all()

    return [
        AttemptSummary(
            id=str(a.id),
            started_at=a.started_at.isoformat() if a.started_at else "",
            finished_at=a.finished_at.isoformat() if a.finished_at else None,
            score_percent=a.score_percent,
            correct_count=a.correct_count,
            total_count=a.total_count,
            passed=a.passed,
            certificate_code=a.certificate_code,
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
