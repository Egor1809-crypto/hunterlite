from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.case_scenario import CaseAttempt, CaseProgress, CaseScenario
from app.models.training_map import TrainingMapProgress
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cases", tags=["cases"])

STAGE1_PER_QUESTION = 10  # 5 вопросов → 50
STAGE2_MAX = 50


# ── Schemas ─────────────────────────────────────────────────────────────
class AnswerRequest(BaseModel):
    attempt_id: str
    node_id: str
    option_id: str


class SubmitOrderRequest(BaseModel):
    attempt_id: str
    order: list[str]


class CompleteRequest(BaseModel):
    attempt_id: str


# ── Helpers ─────────────────────────────────────────────────────────────
def _strip_question_node(node: dict) -> dict:
    """Question node without correctness/branching leaked to the client."""
    return {
        "id": node.get("id"),
        "type": "question",
        "step": node.get("step"),
        "title": node.get("title", ""),
        "question": node.get("question", ""),
        "facts": node.get("facts", []),
        "options": [{"id": o["id"], "text": o["text"]} for o in node.get("options", [])],
    }


def _outcome_node(node: dict) -> dict:
    return {
        "id": node.get("id"),
        "type": "outcome",
        "outcome": node.get("outcome"),
        "title": node.get("title", ""),
        "summary": node.get("summary", ""),
    }


def _info_node(node_id: str, node: dict, nodes: dict) -> dict:
    """Branch "разбор" node. Embeds the resolved `next` node so the client
    can continue the tree without an extra round-trip (info nodes are not
    answered — they only explain a wrong choice and converge forward)."""
    next_id = node.get("next")
    next_node = nodes.get(next_id) if next_id else None
    return {
        "id": node_id,
        "type": "info",
        "step": node.get("step"),
        "title": node.get("title", ""),
        "body": node.get("body", ""),
        "facts": node.get("facts", []),
        "next": _public_node(next_id, next_node, nodes) if next_node else None,
    }


def _public_node(node_id: str, node: dict, nodes: dict | None = None) -> dict:
    n = dict(node)
    n["id"] = node_id
    node_type = n.get("type")
    if node_type == "outcome":
        return _outcome_node(n)
    if node_type == "info":
        return _info_node(node_id, n, nodes or {})
    return _strip_question_node(n)


def _count_questions(stage1: dict) -> int:
    return sum(1 for n in stage1.get("nodes", {}).values() if n.get("type") == "question")


async def _load_case(db: AsyncSession, case_id: str) -> CaseScenario:
    result = await db.execute(
        select(CaseScenario).where(CaseScenario.id == case_id, CaseScenario.is_active.is_(True))
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


async def _load_attempt(db: AsyncSession, attempt_id: str, user_id, case_id: str) -> CaseAttempt:
    try:
        aid = uuid.UUID(attempt_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid attempt_id")
    result = await db.execute(
        select(CaseAttempt).where(
            CaseAttempt.id == aid,
            CaseAttempt.user_id == user_id,
            CaseAttempt.case_id == case_id,
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt


# ── List ────────────────────────────────────────────────────────────────
@router.get("/")
async def list_cases(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cases_result = await db.execute(
        select(CaseScenario).where(CaseScenario.is_active.is_(True)).order_by(CaseScenario.order_index)
    )
    cases = cases_result.scalars().all()

    progress_result = await db.execute(
        select(CaseProgress).where(CaseProgress.user_id == user.id)
    )
    progress = progress_result.scalar_one_or_none()

    attempts_result = await db.execute(
        select(CaseAttempt.case_id, func.count(CaseAttempt.id).label("attempt_count"))
        .where(CaseAttempt.user_id == user.id)
        .group_by(CaseAttempt.case_id)
    )
    attempts_by_case = {row.case_id: row.attempt_count for row in attempts_result}

    completed_set = set(progress.completed_cases) if progress else set()
    best_scores = progress.best_scores if progress else {}

    items = []
    for i, c in enumerate(cases):
        items.append({
            "id": c.id,
            "code": f"БФЛ_{i + 1:02d}",
            "title": c.title,
            "description": c.description,
            "difficulty": c.difficulty,
            "category": c.category,
            "estimated_minutes": c.estimated_minutes,
            "max_score": c.max_score,
            "order_index": c.order_index,
            "completed": c.id in completed_set,
            "best_score": best_scores.get(c.id),
            "attempts": attempts_by_case.get(c.id, 0),
        })

    return {
        "cases": items,
        "stats": {
            "total": len(cases),
            "completed": len(completed_set),
            "average_score": progress.average_score if progress else None,
            "total_attempts": progress.total_attempts if progress else 0,
        },
    }


# ── Detail ──────────────────────────────────────────────────────────────
@router.get("/{case_id}")
async def get_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await _load_case(db, case_id)
    pool = [{"id": s["id"], "text": s["text"]} for s in case.stage2.get("pool", [])]
    random.shuffle(pool)
    return {
        "id": case.id,
        "title": case.title,
        "description": case.description,
        "difficulty": case.difficulty,
        "category": case.category,
        "estimated_minutes": case.estimated_minutes,
        "max_score": case.max_score,
        "stage1_intro": case.stage1.get("intro", ""),
        "total_questions": _count_questions(case.stage1),
        "stage2_prompt": case.stage2.get("prompt", ""),
        "stage2_pool": pool,
    }


# ── Start ───────────────────────────────────────────────────────────────
@router.post("/{case_id}/start")
async def start_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await _load_case(db, case_id)
    start_id = case.stage1.get("start")
    nodes = case.stage1.get("nodes", {})
    if not start_id or start_id not in nodes:
        raise HTTPException(status_code=400, detail="Case stage1 is not configured")

    attempt = CaseAttempt(
        user_id=user.id,
        case_id=case_id,
        started_at=datetime.now(timezone.utc),
        stage1_answers=[],
        stage2_order=[],
        stage1_score=0,
        stage2_score=0,
        score=0,
        score_percent=0,
        completed=False,
    )
    db.add(attempt)
    await db.flush()

    return {
        "attempt_id": str(attempt.id),
        "case_title": case.title,
        "stage1_intro": case.stage1.get("intro", ""),
        "total_questions": _count_questions(case.stage1),
        "node": _public_node(start_id, nodes[start_id]),
    }


# ── Answer a decision-tree question ─────────────────────────────────────
@router.post("/{case_id}/answer")
async def answer_question(
    case_id: str,
    body: AnswerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await _load_case(db, case_id)
    attempt = await _load_attempt(db, body.attempt_id, user.id, case_id)
    if attempt.completed:
        raise HTTPException(status_code=400, detail="Attempt already completed")

    nodes = case.stage1.get("nodes", {})
    node = nodes.get(body.node_id)
    if not node or node.get("type") != "question":
        raise HTTPException(status_code=400, detail="Invalid node_id")

    option = next((o for o in node.get("options", []) if o["id"] == body.option_id), None)
    if not option:
        raise HTTPException(status_code=400, detail="Invalid option_id")

    is_correct = bool(option.get("correct", False))
    attempt.stage1_answers = list(attempt.stage1_answers) + [
        {"node_id": body.node_id, "option_id": body.option_id, "correct": is_correct}
    ]

    next_id = option.get("next")
    next_node = nodes.get(next_id) if next_id else None
    # The decision tree branches: a wrong answer routes through an "info"
    # разбор-node before converging to the next spine question. The outcome
    # may therefore be reached either directly (correct last answer) or via
    # an info node embedded inside this response. Maintain a running score on
    # every answer so the client always has it when it lands on the outcome.
    is_outcome = bool(next_node and next_node.get("type") == "outcome")

    # Only spine questions are ever answered (info nodes are not), so counting
    # correct answers == correct spine questions.
    correct_count = sum(1 for a in attempt.stage1_answers if a.get("correct"))
    attempt.stage1_score = correct_count * STAGE1_PER_QUESTION

    await db.flush()

    return {
        "correct": is_correct,
        "explain": option.get("explain", ""),
        "next": _public_node(next_id, next_node, nodes) if next_node else None,
        "is_outcome": is_outcome,
        "stage1_score": attempt.stage1_score,
    }


# ── Submit chronology ordering (stage 2) ────────────────────────────────
@router.post("/{case_id}/submit-order")
async def submit_order(
    case_id: str,
    body: SubmitOrderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await _load_case(db, case_id)
    attempt = await _load_attempt(db, body.attempt_id, user.id, case_id)
    if attempt.completed:
        raise HTTPException(status_code=400, detail="Attempt already completed")

    pool = {s["id"]: s for s in case.stage2.get("pool", [])}
    correct_seq: list[str] = case.stage2.get("correct_sequence", [])

    feedback = []
    matched = 0
    for idx, item_id in enumerate(body.order):
        item = pool.get(item_id)
        if not item:
            continue
        expected = correct_seq[idx] if idx < len(correct_seq) else None
        placed_right = item_id == expected
        if placed_right:
            matched += 1
        feedback.append({
            "id": item_id,
            "text": item["text"],
            "placed_position": idx + 1,
            "correct_position": item.get("order"),
            "is_distractor": not item.get("is_correct", False),
            "placed_correctly": placed_right,
            "explain": item.get("explain", ""),
        })

    total_correct = len(correct_seq) or 1
    stage2_score = round(STAGE2_MAX * matched / total_correct)

    attempt.stage2_order = list(body.order)
    attempt.stage2_score = stage2_score
    await db.flush()

    return {
        "stage2_score": stage2_score,
        "stage2_max": STAGE2_MAX,
        "matched": matched,
        "total_correct": len(correct_seq),
        "feedback": feedback,
    }


# ── Complete ────────────────────────────────────────────────────────────
@router.post("/{case_id}/complete")
async def complete_case(
    case_id: str,
    body: CompleteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await _load_case(db, case_id)
    attempt = await _load_attempt(db, body.attempt_id, user.id, case_id)
    if attempt.completed:
        raise HTTPException(status_code=400, detail="Attempt already completed")

    total = attempt.stage1_score + attempt.stage2_score
    score_percent = round((total / case.max_score) * 100) if case.max_score > 0 else 0

    attempt.score = total
    attempt.score_percent = score_percent
    attempt.completed = True
    attempt.finished_at = datetime.now(timezone.utc)

    progress_result = await db.execute(
        select(CaseProgress).where(CaseProgress.user_id == user.id)
    )
    progress = progress_result.scalar_one_or_none()

    if not progress:
        progress = CaseProgress(
            user_id=user.id,
            completed_cases=[case_id],
            best_scores={case_id: score_percent},
            total_attempts=1,
            average_score=float(score_percent),
        )
        db.add(progress)
    else:
        completed = list(progress.completed_cases)
        if case_id not in completed:
            completed.append(case_id)
        progress.completed_cases = completed

        best = dict(progress.best_scores)
        if score_percent > best.get(case_id, 0):
            best[case_id] = score_percent
        progress.best_scores = best

        progress.total_attempts = progress.total_attempts + 1
        all_scores = list(best.values())
        progress.average_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else None

    await db.flush()

    try:
        map_result = await db.execute(
            select(TrainingMapProgress).where(TrainingMapProgress.user_id == user.id)
        )
        training_map = map_result.scalar_one_or_none()
        cases_data = {
            "completed": list(progress.completed_cases),
            "best_scores": dict(progress.best_scores),
            "total_attempts": progress.total_attempts,
            "average_score": progress.average_score,
        }
        if training_map:
            training_map.cases = cases_data
        else:
            db.add(TrainingMapProgress(user_id=user.id, test_map={}, exams={}, cases=cases_data))
        await db.flush()
    except Exception:
        logger.warning("Failed to sync cases to training_map_progress", exc_info=True)

    # Разбор: правильная цепочка хронологии с пояснениями
    pool = {s["id"]: s for s in case.stage2.get("pool", [])}
    sequence_review = [
        {"position": i + 1, "text": pool[sid]["text"], "explain": pool[sid].get("explain", "")}
        for i, sid in enumerate(case.stage2.get("correct_sequence", []))
        if sid in pool
    ]

    return {
        "stage1_score": attempt.stage1_score,
        "stage2_score": attempt.stage2_score,
        "score": total,
        "score_percent": score_percent,
        "max_score": case.max_score,
        "expert_analysis": case.expert_analysis,
        "sequence_review": sequence_review,
    }


# ── History ─────────────────────────────────────────────────────────────
@router.get("/{case_id}/history")
async def case_history(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CaseAttempt)
        .where(CaseAttempt.user_id == user.id, CaseAttempt.case_id == case_id)
        .order_by(CaseAttempt.started_at.desc())
    )
    attempts = result.scalars().all()
    return {
        "attempts": [
            {
                "id": str(a.id),
                "started_at": a.started_at.isoformat() if a.started_at else None,
                "finished_at": a.finished_at.isoformat() if a.finished_at else None,
                "stage1_score": a.stage1_score,
                "stage2_score": a.stage2_score,
                "score": a.score,
                "score_percent": a.score_percent,
                "completed": a.completed,
            }
            for a in attempts
        ]
    }
