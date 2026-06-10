"""Course progress + per-lesson mini-check API (Course Progress, Этап 1).

A lesson is «пройдено» when the user answers its 3-question mini-check 3/3.
Grading is server-side — the client never receives the correct answers, and the
response does NOT reveal which answers were wrong (no highlighting). 3 attempts
per cycle; re-watching resets the counter. Course % = passed lessons / total.

Endpoints (all auth):
  GET  /courses/progress
  GET  /courses/{slug}/lessons/{index}/quiz
  POST /courses/{slug}/lessons/{index}/quiz/submit   {answers:[int,...]}
  POST /courses/{slug}/lessons/{index}/rewatch        (reset attempts)
"""
from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.data.course_quizzes import QUIZZES, lesson_quiz
from app.database import get_db
from app.models.course_progress import MAX_ATTEMPTS, CourseLessonProgress
from app.models.user import User
from app.services.course_schedule import is_unlocked, unlock_at

router = APIRouter()


# ──────────────────────────── schemas ────────────────────────────

class QuizQuestionOut(BaseModel):
    q: str
    options: list[str]


class QuizOut(BaseModel):
    course_slug: str
    lesson_index: int
    questions: list[QuizQuestionOut]
    completed: bool
    attempts_used: int
    max_attempts: int


class QuizSubmitIn(BaseModel):
    answers: list[int] = Field(min_length=1, max_length=10)


class QuizSubmitOut(BaseModel):
    passed: bool
    completed: bool
    attempts_used: int
    attempts_left: int
    max_attempts: int


class LessonProgressOut(BaseModel):
    lesson_index: int
    completed: bool
    attempts_used: int
    locked: bool
    unlock_at: str | None = None  # ISO 8601 UTC, when the lesson opens


class CourseProgressOut(BaseModel):
    course_slug: str
    total_lessons: int
    completed_lessons: int
    percent: int
    next_unlock_at: str | None = None  # nearest future lesson unlock (ISO UTC)
    lessons: list[LessonProgressOut]


class ProgressOut(BaseModel):
    courses: list[CourseProgressOut]


# ──────────────────────────── helpers ────────────────────────────

def _quiz_or_404(course_slug: str, lesson_index: int) -> list[dict]:
    q = lesson_quiz(course_slug, lesson_index)
    if not q:
        raise HTTPException(status_code=404, detail="Урок или мини-проверка не найдены")
    return q


def _require_unlocked(course_slug: str, lesson_index: int) -> None:
    if not is_unlocked(course_slug, lesson_index):
        raise HTTPException(status_code=409, detail="Урок ещё не открыт по расписанию")


def _option_order(user_id, course_slug: str, lesson_index: int, q_index: int, n: int) -> list[int]:
    """Deterministic per (user, lesson, question) permutation of option indices,
    so the correct answer is NOT always first AND the order is stable between the
    GET (what the client saw) and the submit (how we grade). ``order[shown]`` =
    original option index."""
    rng = random.Random(f"{user_id}:{course_slug}:{lesson_index}:{q_index}")
    order = list(range(n))
    rng.shuffle(order)
    return order


async def _row(
    db: AsyncSession, user_id, course_slug: str, lesson_index: int
) -> CourseLessonProgress | None:
    res = await db.execute(
        select(CourseLessonProgress).where(
            CourseLessonProgress.user_id == user_id,
            CourseLessonProgress.course_slug == course_slug,
            CourseLessonProgress.lesson_index == lesson_index,
        )
    )
    return res.scalar_one_or_none()


async def _get_or_create_row(
    db: AsyncSession, user_id, course_slug: str, lesson_index: int
) -> CourseLessonProgress:
    row = await _row(db, user_id, course_slug, lesson_index)
    if row is not None:
        return row
    row = CourseLessonProgress(
        user_id=user_id, course_slug=course_slug, lesson_index=lesson_index, attempts=0
    )
    db.add(row)
    try:
        await db.commit()
        await db.refresh(row)
    except IntegrityError:
        await db.rollback()
        row = await _row(db, user_id, course_slug, lesson_index)
        if row is None:  # pragma: no cover — UNIQUE guarantees it exists
            raise
    return row


# ──────────────────────────── routes ────────────────────────────

@router.get("/courses/progress", response_model=ProgressOut)
async def courses_progress(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(CourseLessonProgress).where(CourseLessonProgress.user_id == user.id)
        )
    ).scalars().all()
    by_course: dict[str, dict[int, CourseLessonProgress]] = {}
    for r in rows:
        by_course.setdefault(r.course_slug, {})[r.lesson_index] = r

    now = datetime.now(timezone.utc)
    out: list[CourseProgressOut] = []
    for slug, lessons in QUIZZES.items():
        indices = sorted(lessons.keys())
        total = len(indices)
        prog = by_course.get(slug, {})
        completed = sum(1 for i in indices if prog.get(i) and prog[i].completed_at is not None)

        lesson_rows: list[LessonProgressOut] = []
        next_unlock: datetime | None = None
        for i in indices:
            ua = unlock_at(slug, i)
            locked = not is_unlocked(slug, i, now)
            if locked and ua is not None and (next_unlock is None or ua < next_unlock):
                next_unlock = ua
            lesson_rows.append(
                LessonProgressOut(
                    lesson_index=i,
                    completed=bool(prog.get(i) and prog[i].completed_at is not None),
                    attempts_used=prog[i].attempts if prog.get(i) else 0,
                    locked=locked,
                    unlock_at=ua.isoformat() if ua is not None else None,
                )
            )
        out.append(
            CourseProgressOut(
                course_slug=slug,
                total_lessons=total,
                completed_lessons=completed,
                percent=round(completed / total * 100) if total else 0,
                next_unlock_at=next_unlock.isoformat() if next_unlock else None,
                lessons=lesson_rows,
            )
        )
    return ProgressOut(courses=out)


@router.get("/courses/{course_slug}/lessons/{lesson_index}/quiz", response_model=QuizOut)
async def get_lesson_quiz(
    course_slug: str,
    lesson_index: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    quiz = _quiz_or_404(course_slug, lesson_index)
    _require_unlocked(course_slug, lesson_index)
    row = await _row(db, user.id, course_slug, lesson_index)
    # Questions WITHOUT the correct index, options shuffled deterministically.
    questions = []
    for qi, q in enumerate(quiz):
        order = _option_order(user.id, course_slug, lesson_index, qi, len(q["options"]))
        questions.append(
            QuizQuestionOut(q=q["q"], options=[q["options"][o] for o in order])
        )
    return QuizOut(
        course_slug=course_slug,
        lesson_index=lesson_index,
        questions=questions,
        completed=bool(row and row.completed_at is not None),
        attempts_used=row.attempts if row else 0,
        max_attempts=MAX_ATTEMPTS,
    )


@router.post(
    "/courses/{course_slug}/lessons/{lesson_index}/quiz/submit",
    response_model=QuizSubmitOut,
)
async def submit_lesson_quiz(
    course_slug: str,
    lesson_index: int,
    payload: QuizSubmitIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    quiz = _quiz_or_404(course_slug, lesson_index)
    _require_unlocked(course_slug, lesson_index)
    if len(payload.answers) != len(quiz):
        raise HTTPException(status_code=422, detail="Неверное число ответов")

    row = await _get_or_create_row(db, user.id, course_slug, lesson_index)

    # Already passed — idempotent, no attempt consumed.
    if row.completed_at is not None:
        return QuizSubmitOut(
            passed=True, completed=True, attempts_used=row.attempts,
            attempts_left=0, max_attempts=MAX_ATTEMPTS,
        )

    if row.attempts >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=409,
            detail="Попытки исчерпаны. Пересмотрите урок и попробуйте снова.",
        )

    # Server-side grading — strict 3/3. ``answers[i]`` is the SHOWN position the
    # client picked; map it back through the same deterministic permutation to
    # the original option index, then compare to the correct one.
    correct = 0
    for qi, q in enumerate(quiz):
        order = _option_order(user.id, course_slug, lesson_index, qi, len(q["options"]))
        shown = payload.answers[qi]
        if 0 <= shown < len(order) and order[shown] == q["correct"]:
            correct += 1
    passed = correct == len(quiz)

    row.attempts += 1
    if passed:
        row.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)

    return QuizSubmitOut(
        passed=passed,
        completed=row.completed_at is not None,
        attempts_used=row.attempts,
        attempts_left=max(0, MAX_ATTEMPTS - row.attempts),
        max_attempts=MAX_ATTEMPTS,
    )


@router.post("/courses/{course_slug}/lessons/{lesson_index}/rewatch", status_code=204)
async def rewatch_lesson(
    course_slug: str,
    lesson_index: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset the attempt counter so the user can retry the mini-check after
    re-watching. No-op if the lesson is already passed."""
    _quiz_or_404(course_slug, lesson_index)
    row = await _row(db, user.id, course_slug, lesson_index)
    if row and row.completed_at is None and row.attempts != 0:
        row.attempts = 0
        await db.commit()
