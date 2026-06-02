"""Learning Path API — unified progress, recommendations, daily drill, unlocks, admin overview.

Aggregates data from all training subsystems created by Agents 1-4:
  - training_map_progress (test map)
  - exam_attempts / exam_certificates (exams)
  - case_progress / case_attempts (cases)
  - session_history (practice sessions)
  - manager_progress (skills, streak)
  - knowledge_quiz_sessions (knowledge)

Endpoints:
  GET  /learning-path/progress        — full user progress across all stages
  GET  /learning-path/recommendations — personalized recommendations (max 5)
  GET  /learning-path/daily-drill     — 3 daily assignments
  GET  /learning-path/unlocks         — unlock chain status
  GET  /learning-path/admin/overview  — admin/ROP overview of all users
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.database import get_db
from app.models.case_scenario import CaseAttempt, CaseProgress, CaseScenario
from app.models.exam import ExamAttempt, ExamCertificate, ExamDefinition
from app.models.knowledge import KnowledgeQuizSession
from app.models.progress import ManagerProgress, SessionHistory
from app.models.training_map import TrainingMapProgress
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/learning-path", tags=["learning-path"])

# ──────────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────────

TOTAL_TEST_MAP_LEVELS = 100
TOTAL_EXAMS = 5
TOTAL_CASES = 12
KNOWLEDGE_TOPICS = 10


async def _get_manager_progress(user_id: uuid.UUID, db: AsyncSession) -> ManagerProgress | None:
    result = await db.execute(
        select(ManagerProgress).where(ManagerProgress.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def _get_training_map(user_id: uuid.UUID, db: AsyncSession) -> TrainingMapProgress | None:
    result = await db.execute(
        select(TrainingMapProgress).where(TrainingMapProgress.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def _count_passed_exams(user_id: uuid.UUID, db: AsyncSession) -> tuple[int, dict[str, bool]]:
    """Returns (count_passed, {exam_id: passed_bool})."""
    result = await db.execute(
        select(ExamAttempt.exam_id, func.bool_or(ExamAttempt.passed)).where(
            ExamAttempt.user_id == user_id,
            ExamAttempt.finished_at.isnot(None),
        ).group_by(ExamAttempt.exam_id)
    )
    rows = result.all()
    passed_map: dict[str, bool] = {}
    count = 0
    for exam_id, passed in rows:
        passed_map[exam_id] = bool(passed)
        if passed:
            count += 1
    return count, passed_map


async def _get_case_progress(user_id: uuid.UUID, db: AsyncSession) -> CaseProgress | None:
    result = await db.execute(
        select(CaseProgress).where(CaseProgress.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def _count_knowledge_sessions(user_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(KnowledgeQuizSession).where(
            KnowledgeQuizSession.user_id == user_id,
        )
    )
    return result.scalar_one() or 0


async def _count_training_sessions(user_id: uuid.UUID, db: AsyncSession) -> tuple[int, int, float | None, int | None]:
    """Returns (total_sessions, this_week_sessions, avg_score, best_score)."""
    result = await db.execute(
        select(
            func.count(),
            func.avg(SessionHistory.score_total),
            func.max(SessionHistory.score_total),
        ).where(SessionHistory.user_id == user_id)
    )
    row = result.one()
    total = row[0] or 0
    avg_score = float(row[1]) if row[1] is not None else None
    best_score = int(row[2]) if row[2] is not None else None

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    result2 = await db.execute(
        select(func.count()).select_from(SessionHistory).where(
            SessionHistory.user_id == user_id,
            SessionHistory.created_at >= week_ago,
        )
    )
    this_week = result2.scalar_one() or 0

    return total, this_week, avg_score, best_score


async def _count_certificates(user_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(ExamCertificate).where(
            ExamCertificate.user_id == user_id,
        )
    )
    return result.scalar_one() or 0


def _test_map_level(tmap: TrainingMapProgress | None) -> int:
    """Extract current level from test_map JSONB."""
    if not tmap or not tmap.test_map:
        return 0
    tm = tmap.test_map
    if isinstance(tm, dict):
        return int(tm.get("current_level", 0))
    return 0


def _compute_streak(mp: ManagerProgress | None) -> dict[str, Any]:
    """Build streak info from ManagerProgress."""
    if not mp:
        return {"current": 0, "best": 0, "today_completed": False}
    current = getattr(mp, "streak_days", 0) or 0
    best = getattr(mp, "best_streak", 0) or 0
    last_active = getattr(mp, "last_session_at", None)
    today = datetime.now(timezone.utc).date()
    today_done = False
    if last_active:
        if hasattr(last_active, "date"):
            today_done = last_active.date() == today
        else:
            today_done = False
    return {
        "current": current,
        "best": max(best, current),
        "today_completed": today_done,
    }


# ──────────────────────────────────────────────────────────────────────
#  GET /learning-path/progress
# ──────────────────────────────────────────────────────────────────────

@router.get("/progress")
@limiter.limit("30/minute")
async def get_progress(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Full learning progress across all stages."""
    user_id = user.id

    # Gather all data in parallel-ish (sequential but fast)
    mp = await _get_manager_progress(user_id, db)
    tmap = await _get_training_map(user_id, db)
    exams_passed, exams_map = await _count_passed_exams(user_id, db)
    case_prog = await _get_case_progress(user_id, db)
    knowledge_count = await _count_knowledge_sessions(user_id, db)
    total_sessions, this_week_sessions, avg_score, best_score = await _count_training_sessions(user_id, db)
    certs_count = await _count_certificates(user_id, db)

    # Compute per-stage progress
    test_level = _test_map_level(tmap)
    cases_completed = len(case_prog.completed_cases) if case_prog and case_prog.completed_cases else 0
    knowledge_progress = min(100, int((knowledge_count / max(KNOWLEDGE_TOPICS, 1)) * 100))
    test_progress = min(100, int((test_level / TOTAL_TEST_MAP_LEVELS) * 100))
    cases_progress = min(100, int((cases_completed / TOTAL_CASES) * 100))
    exams_progress = min(100, int((exams_passed / TOTAL_EXAMS) * 100))
    practice_progress = min(100, int(total_sessions * 5))  # 20 sessions = 100%

    overall = int(
        (knowledge_progress + test_progress + cases_progress + exams_progress + practice_progress) / 5
    )

    stages = [
        {
            "id": "knowledge",
            "title": "База знаний",
            "icon": "\U0001f4da",
            "progress_percent": knowledge_progress,
            "detail": f"Пройдено {knowledge_count} квизов",
            "status": "completed" if knowledge_progress >= 100 else "in_progress" if knowledge_progress > 0 else "locked",
        },
        {
            "id": "tests",
            "title": "Карта тестов",
            "icon": "\U0001f5fa️",
            "progress_percent": test_progress,
            "detail": f"Пройдено {test_level} из {TOTAL_TEST_MAP_LEVELS} уровней",
            "status": "completed" if test_progress >= 100 else "in_progress" if test_progress > 0 else "locked",
        },
        {
            "id": "cases",
            "title": "Кейсы",
            "icon": "\U0001f4cb",
            "progress_percent": cases_progress,
            "detail": f"Решено {cases_completed} из {TOTAL_CASES} кейсов",
            "status": "completed" if cases_progress >= 100 else "in_progress" if cases_progress > 0 else "locked",
        },
        {
            "id": "exams",
            "title": "Экзамены",
            "icon": "\U0001f393",
            "progress_percent": exams_progress,
            "detail": f"Сдан {exams_passed} из {TOTAL_EXAMS} экзаменов",
            "status": "completed" if exams_progress >= 100 else "in_progress" if exams_progress > 0 else "locked",
        },
        {
            "id": "practice",
            "title": "Практика",
            "icon": "\U0001f3af",
            "progress_percent": practice_progress,
            "detail": f"{total_sessions} тренировок проведено",
            "status": "completed" if practice_progress >= 100 else "in_progress" if practice_progress > 0 else "locked",
        },
    ]

    streak = _compute_streak(mp)

    stats = {
        "total_sessions": total_sessions,
        "total_hours": round(total_sessions * 0.35, 1),  # ~21 min avg session
        "average_score": round(avg_score) if avg_score is not None else 0,
        "best_score": best_score or 0,
        "this_week_sessions": this_week_sessions,
        "certificates_earned": certs_count,
    }

    # Build progress map for frontend compatibility
    progress_map = {
        "knowledge": knowledge_progress,
        "tests": test_progress,
        "cases": cases_progress,
        "exams": exams_progress,
        "practice": practice_progress,
    }

    return {
        "overall_percent": overall,
        "stages": stages,
        "streak": streak,
        "stats": stats,
        "progress": progress_map,
    }


# ──────────────────────────────────────────────────────────────────────
#  GET /learning-path/recommendations
# ──────────────────────────────────────────────────────────────────────

@router.get("/recommendations")
@limiter.limit("20/minute")
async def get_recommendations(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Personalized recommendations based on weak spots and progress."""
    user_id = user.id
    recs: list[dict[str, Any]] = []

    mp = await _get_manager_progress(user_id, db)
    tmap = await _get_training_map(user_id, db)
    exams_passed, exams_map = await _count_passed_exams(user_id, db)
    case_prog = await _get_case_progress(user_id, db)
    total_sessions, _, avg_score, _ = await _count_training_sessions(user_id, db)

    # 1. Weak exam categories
    failed_exams = await db.execute(
        select(ExamAttempt.exam_id).where(
            ExamAttempt.user_id == user_id,
            ExamAttempt.passed == False,
        ).order_by(ExamAttempt.finished_at.desc()).limit(3)
    )
    for row in failed_exams.all():
        exam_id = row[0]
        if not exams_map.get(exam_id, False):
            recs.append({
                "type": "weak_spot",
                "title": f"Повторите Экзамен: {exam_id}",
                "description": "Вы не сдали этот экзамен. Подготовьтесь лучше!",
                "action_url": f"/exam",
                "action_label": "К экзаменам",
            })

    # 2. Next exam to take
    for i in range(1, TOTAL_EXAMS + 1):
        eid = f"exam-{i}"
        if not exams_map.get(eid, False):
            if i == 1 or exams_map.get(f"exam-{i-1}", False):
                recs.append({
                    "type": "next_step",
                    "title": f"Следующий шаг: Экзамен {i}",
                    "description": f"{'Вы сдали предыдущий экзамен. ' if i > 1 else ''}Время для следующего!",
                    "action_url": "/exam",
                    "action_label": "Начать экзамен",
                })
            break

    # 3. Cases not started
    cases_completed = case_prog.completed_cases if case_prog and case_prog.completed_cases else []
    if len(cases_completed) < TOTAL_CASES:
        recs.append({
            "type": "next_step",
            "title": "Решите ещё кейсов",
            "description": f"Решено {len(cases_completed)} из {TOTAL_CASES}. Каждый кейс прокачивает навыки.",
            "action_url": "/cases",
            "action_label": "К кейсам",
        })

    # 4. Low score — practice more
    if avg_score is not None and avg_score < 60:
        recs.append({
            "type": "weak_spot",
            "title": "Слабое место: Средний балл",
            "description": f"Ваш средний балл {round(avg_score)}. Практикуйтесь чаще.",
            "action_url": "/training",
            "action_label": "Тренироваться",
        })

    # 5. Haven't trained recently
    if total_sessions == 0:
        recs.append({
            "type": "next_step",
            "title": "Начните тренироваться",
            "description": "Проведите первую тренировку с AI-клиентом.",
            "action_url": "/training",
            "action_label": "Начать",
        })

    # 6. Knowledge quiz suggestion
    test_level = _test_map_level(tmap)
    if test_level < 30:
        recs.append({
            "type": "next_step",
            "title": "Пройдите больше тестов",
            "description": f"Уровень {test_level} из {TOTAL_TEST_MAP_LEVELS}. Тесты — основа знаний.",
            "action_url": "/training",
            "action_label": "К тестам",
        })

    return {"recommendations": recs[:5]}


# ──────────────────────────────────────────────────────────────────────
#  GET /learning-path/daily-drill
# ──────────────────────────────────────────────────────────────────────

@router.get("/daily-drill")
@limiter.limit("30/minute")
async def get_daily_drill(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Generate 3 daily drill assignments."""
    user_id = user.id

    mp = await _get_manager_progress(user_id, db)
    case_prog = await _get_case_progress(user_id, db)

    # Determine a weak category for quiz
    weak_category = "procedures"
    if mp:
        skills = mp.skills_dict()
        if skills:
            weakest = min(skills, key=skills.get)
            weak_category = weakest

    # Find an uncompleted case
    completed_cases = case_prog.completed_cases if case_prog and case_prog.completed_cases else []
    uncompleted_case_result = await db.execute(
        select(CaseScenario.id).where(
            CaseScenario.is_active == True,
            ~CaseScenario.id.in_(completed_cases) if completed_cases else CaseScenario.is_active == True,
        ).order_by(CaseScenario.order_index).limit(1)
    )
    next_case_id = uncompleted_case_result.scalar_one_or_none() or "case-1"

    # Check if drills are done today
    streak = _compute_streak(mp)
    today_done = streak.get("today_completed", False)

    drills = [
        {
            "id": "quiz",
            "title": "Быстрый тест",
            "description": f"5 вопросов по теме «{weak_category}»",
            "duration": "3 мин",
            "icon": "⚡",
            "action_url": f"/knowledge?tab=quiz&category={weak_category}",
            "completed": False,
        },
        {
            "id": "case",
            "title": "Мини-кейс",
            "description": "Один юридический сценарий",
            "duration": "5 мин",
            "icon": "\U0001f4cb",
            "action_url": f"/cases/{next_case_id}",
            "completed": False,
        },
        {
            "id": "call",
            "title": "Тренировочный звонок",
            "description": "AI-клиент средней сложности",
            "duration": "10 мин",
            "icon": "\U0001f4de",
            "action_url": "/training",
            "completed": today_done,
        },
    ]

    return {
        "drills": drills,
        "streak": streak,
    }


# ──────────────────────────────────────────────────────────────────────
#  GET /learning-path/unlocks
# ──────────────────────────────────────────────────────────────────────

@router.get("/unlocks")
@limiter.limit("30/minute")
async def get_unlocks(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """What content is unlocked for the user."""
    user_id = user.id

    _, exams_map = await _count_passed_exams(user_id, db)
    tmap = await _get_training_map(user_id, db)
    test_level = _test_map_level(tmap)

    # Exam unlocks: exam-N requires exam-(N-1) passed
    exams_unlocks: dict[str, dict[str, Any]] = {}
    for i in range(1, TOTAL_EXAMS + 1):
        eid = f"exam-{i}"
        if i == 1:
            exams_unlocks[eid] = {"unlocked": True, "reason": "Всегда доступен"}
        else:
            prev = f"exam-{i-1}"
            if exams_map.get(prev, False):
                exams_unlocks[eid] = {"unlocked": True, "reason": f"Экзамен {i-1} сдан"}
            else:
                exams_unlocks[eid] = {"unlocked": False, "reason": f"Сдайте Экзамен {i-1}"}

    # Case unlocks:
    # 1-4: always unlocked (basic)
    # 5-8: after level 30 on test map
    # 9-12: after level 60
    cases_unlocks: dict[str, dict[str, Any]] = {}
    for i in range(1, TOTAL_CASES + 1):
        cid = f"case-{i}"
        if i <= 4:
            cases_unlocks[cid] = {"unlocked": True, "reason": "Базовый кейс"}
        elif i <= 8:
            if test_level >= 30:
                cases_unlocks[cid] = {"unlocked": True, "reason": "Уровень 30+ на карте тестов"}
            else:
                cases_unlocks[cid] = {"unlocked": False, "reason": f"Пройдите уровень 30 на карте тестов (сейчас {test_level})"}
        else:
            if test_level >= 60:
                cases_unlocks[cid] = {"unlocked": True, "reason": "Уровень 60+ на карте тестов"}
            else:
                cases_unlocks[cid] = {"unlocked": False, "reason": f"Пройдите уровень 60 на карте тестов (сейчас {test_level})"}

    return {
        "exams": exams_unlocks,
        "cases": cases_unlocks,
    }


# ──────────────────────────────────────────────────────────────────────
#  GET /learning-path/admin/overview
# ──────────────────────────────────────────────────────────────────────

@router.get("/admin/overview")
@limiter.limit("10/minute")
async def admin_overview(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Admin/ROP overview of all users' progress."""
    # Check admin/rop role
    role = getattr(user, "role", None) or ""
    if role not in ("admin", "rop", "methodologist"):
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    # Get all users with progress
    result = await db.execute(
        select(User).where(User.is_active == True).order_by(User.full_name)
    )
    all_users = result.scalars().all()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    users_data: list[dict[str, Any]] = []
    total_progress = 0
    active_count = 0

    for u in all_users:
        uid = u.id
        mp = await _get_manager_progress(uid, db)
        tmap = await _get_training_map(uid, db)
        exams_passed, _ = await _count_passed_exams(uid, db)
        case_prog = await _get_case_progress(uid, db)
        total_sessions, this_week, avg_score, _ = await _count_training_sessions(uid, db)

        test_level = _test_map_level(tmap)
        cases_done = len(case_prog.completed_cases) if case_prog and case_prog.completed_cases else 0

        # Compute overall %
        k_p = min(100, int(total_sessions * 10))  # simplified knowledge proxy
        t_p = min(100, int((test_level / TOTAL_TEST_MAP_LEVELS) * 100))
        c_p = min(100, int((cases_done / TOTAL_CASES) * 100))
        e_p = min(100, int((exams_passed / TOTAL_EXAMS) * 100))
        pr_p = min(100, int(total_sessions * 5))
        overall = int((k_p + t_p + c_p + e_p + pr_p) / 5)
        total_progress += overall

        if this_week > 0:
            active_count += 1

        streak_days = getattr(mp, "streak_days", 0) or 0 if mp else 0
        last_active = getattr(mp, "last_session_at", None) if mp else None

        # Determine where user is stuck
        stuck_at = None
        if overall > 0 and overall < 100:
            stages_progress = [
                ("Знания", k_p), ("Тесты", t_p), ("Кейсы", c_p),
                ("Экзамены", e_p), ("Практика", pr_p),
            ]
            weakest_stage = min(stages_progress, key=lambda x: x[1])
            if weakest_stage[1] < 50:
                stuck_at = weakest_stage[0]

        users_data.append({
            "id": str(uid),
            "name": u.full_name or "Без имени",
            "overall_percent": overall,
            "stages": {
                "knowledge": k_p,
                "tests": t_p,
                "cases": c_p,
                "exams": e_p,
                "practice": pr_p,
            },
            "streak": streak_days,
            "last_active": last_active.isoformat() if last_active else None,
            "stuck_at": stuck_at,
        })

    avg_progress = int(total_progress / max(len(all_users), 1))

    return {
        "total_users": len(all_users),
        "active_this_week": active_count,
        "average_progress": avg_progress,
        "users": users_data,
    }
