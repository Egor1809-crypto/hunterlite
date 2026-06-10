"""Championship qualification — compute real entry-condition signals.

The product gate (docs/contest/CHAMPIONSHIP_PLAN.md §3.3): a participant is
``qualified`` (and thus enters the draw pool) when they satisfy the objective
conditions. We compute them from the authoritative tables that actually exist:

  * ``exam_passed``  — the user holds an exam certificate (issued only on a
    passing attempt ≥ the exam's pass threshold, default 88%). Source:
    ``exam_certificates`` (app/models/exam.py).
  * ``subscribed``   — the user has an active *paid* subscription (plan ≠ free
    ``scout``, not expired). Source: ``user_subscriptions``.
  * ``review_left``  — the user left a (non-deleted) review. Source: ``reviews``.

⚠️ WHITE SPOT (flagged in the execution plan): course completion is **not
tracked anywhere** in the codebase — there is no course/lesson/progress model.
The paid plans bundle both courses ("Юр. аспекты" + "Эксперт. БФЛ", see the
tariff copy), so we use *active paid subscription* as the access proxy for the
"courses" requirement and surface ``courses_done`` = that proxy. It is NOT a
separate hard gate (it would double-count ``subscribed``). When real course
tracking lands, refine ``compute_metrics`` to read it.

Qualification gate = ``exam_passed AND subscribed AND review_left``.

Recomputation is lazy: ``recompute_entry`` is called on enroll and on GET /me,
and in bulk by the scheduler / operator before a draw. It only writes when a
value actually changed, so a GET stays side-effect-light.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.course_quizzes import QUIZZES
from app.models.championship import ChampionshipEntry
from app.models.course_progress import CourseLessonProgress
from app.models.exam import ExamAttempt, ExamCertificate
from app.models.review import Review
from app.models.subscription import UserSubscription
from app.models.user import User

# Free plan name — anything else is a paid plan.
_FREE_PLAN = "scout"
# Roles that get product access without a paid subscription row (comped).
_COMPED_ROLES = ("admin", "rop", "methodologist")
# Courses a participant must complete 100% (all lessons passed via mini-checks).
# A course with no lessons yet (empty) is skipped until it has content, then it
# auto-joins the gate.
_CHAMPIONSHIP_COURSES = ("yuridicheskie-aspekty", "expertnyi-uroven-bfl")


async def _courses_done(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """True when every required (non-empty) course is 100% completed."""
    for slug in _CHAMPIONSHIP_COURSES:
        total = len(QUIZZES.get(slug, {}))
        if total == 0:
            continue  # empty course not yet required
        done = (
            await db.execute(
                select(func.count(CourseLessonProgress.id)).where(
                    CourseLessonProgress.user_id == user_id,
                    CourseLessonProgress.course_slug == slug,
                    CourseLessonProgress.completed_at.isnot(None),
                )
            )
        ).scalar() or 0
        if int(done) < total:
            return False
    return True


async def _has_certificate(db: AsyncSession, user_id: uuid.UUID) -> bool:
    row = await db.execute(
        select(ExamCertificate.id).where(ExamCertificate.user_id == user_id).limit(1)
    )
    return row.first() is not None


async def _best_exam_score(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Highest passing exam score (0..100), for ranking/engagement ordering."""
    row = await db.execute(
        select(ExamAttempt.score_percent).where(
            ExamAttempt.user_id == user_id,
            ExamAttempt.score_percent.isnot(None),
        )
    )
    scores = [int(s) for (s,) in row.all() if s is not None]
    return max(scores) if scores else 0


async def _has_active_subscription(db: AsyncSession, user: User) -> bool:
    # Admin/ROP/methodologist are comped — treated as having access.
    role = getattr(user.role, "value", user.role)
    if role in _COMPED_ROLES:
        return True
    now = datetime.now(timezone.utc)
    row = await db.execute(
        select(UserSubscription).where(UserSubscription.user_id == user.id).limit(1)
    )
    sub = row.scalar_one_or_none()
    if sub is None:
        return False
    if sub.plan_type == _FREE_PLAN:
        return False
    if sub.expires_at is not None:
        # Postgres returns tz-aware; SQLite (tests) naive — normalize to UTC.
        exp = sub.expires_at if sub.expires_at.tzinfo else sub.expires_at.replace(tzinfo=timezone.utc)
        if exp <= now:
            return False
    return True


async def _has_review(db: AsyncSession, user_id: uuid.UUID) -> bool:
    row = await db.execute(
        select(Review.id).where(Review.user_id == user_id, Review.deleted.is_(False)).limit(1)
    )
    return row.first() is not None


async def compute_metrics(db: AsyncSession, user: User) -> dict:
    """Snapshot of the real qualification signals for a user."""
    exam_passed = await _has_certificate(db, user.id)
    subscribed = await _has_active_subscription(db, user)
    review_left = await _has_review(db, user.id)
    courses_done = await _courses_done(db, user.id)
    exam_score = await _best_exam_score(db, user.id)
    return {
        "exam_passed": exam_passed,
        "subscribed": subscribed,
        "review_left": review_left,
        # Real signal now (Этап 3): every required course completed 100% via
        # per-lesson mini-checks. Empty courses are skipped until populated.
        "courses_done": courses_done,
        "exam_score": exam_score,
    }


def qualifies(metrics: dict) -> bool:
    """Objective gate: certified + paid subscription + both courses 100% + review."""
    return bool(
        metrics.get("exam_passed")
        and metrics.get("subscribed")
        and metrics.get("courses_done")
        and metrics.get("review_left")
    )


def compute_score(metrics: dict) -> float:
    """Aggregate engagement score (ordering of the qualified pool / ranking
    fallback). Deterministic: exam score is the spine, conditions add bonuses."""
    score = float(metrics.get("exam_score") or 0)
    if metrics.get("subscribed"):
        score += 10
    if metrics.get("courses_done"):
        score += 10
    if metrics.get("review_left"):
        score += 5
    if metrics.get("exam_passed"):
        score += 5
    return score


async def recompute_entry(
    db: AsyncSession, entry: ChampionshipEntry, user: User, *, commit: bool = True
) -> ChampionshipEntry:
    """Refresh an entry's metrics/score/status from live signals.

    Disqualified entries are left untouched (an operator decision). Writes only
    when something changed, so a lazy recompute on GET is cheap.
    """
    if entry.status == "disqualified":
        return entry

    metrics = await compute_metrics(db, user)
    score = compute_score(metrics)
    new_status = "qualified" if qualifies(metrics) else "enrolled"

    changed = (
        entry.metrics != metrics
        or entry.score != score
        or entry.status != new_status
    )
    if changed:
        entry.metrics = metrics
        entry.score = score
        entry.status = new_status
        if commit:
            await db.commit()
            await db.refresh(entry)
    return entry


async def recompute_championship(db: AsyncSession, championship_id: uuid.UUID) -> int:
    """Bulk-recompute every non-disqualified entry of a season. Returns the
    number of entries now ``qualified``. Used by the scheduler / before a draw."""
    rows = await db.execute(
        select(ChampionshipEntry, User)
        .join(User, User.id == ChampionshipEntry.user_id)
        .where(
            ChampionshipEntry.championship_id == championship_id,
            ChampionshipEntry.status != "disqualified",
        )
    )
    qualified = 0
    for entry, user in rows.all():
        await recompute_entry(db, entry, user, commit=False)
        if entry.status == "qualified":
            qualified += 1
    await db.commit()
    return qualified
