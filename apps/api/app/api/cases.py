from __future__ import annotations

import copy
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.case_scenario import CaseAttempt, CaseProgress, CaseScenario
from app.models.training_map import TrainingMapProgress
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cases", tags=["cases"])


class ChoiceRequest(BaseModel):
    attempt_id: str
    step_id: str
    choice_id: str


class RevealFactRequest(BaseModel):
    attempt_id: str
    step_id: str


class CompleteRequest(BaseModel):
    attempt_id: str


def _strip_hidden_facts(steps: list[dict]) -> list[dict]:
    out = copy.deepcopy(steps)
    for step in out:
        hf = step.get("hidden_fact")
        if hf:
            step["hidden_fact"] = {"clue": hf["clue"]}
    return out


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
        select(
            CaseAttempt.case_id,
            func.count(CaseAttempt.id).label("attempt_count"),
        )
        .where(CaseAttempt.user_id == user.id)
        .group_by(CaseAttempt.case_id)
    )
    attempts_by_case = {row.case_id: row.attempt_count for row in attempts_result}

    completed_set = set(progress.completed_cases) if progress else set()
    best_scores = progress.best_scores if progress else {}

    items = []
    for c in cases:
        items.append({
            "id": c.id,
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


@router.get("/{case_id}")
async def get_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CaseScenario).where(CaseScenario.id == case_id, CaseScenario.is_active.is_(True))
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return {
        "id": case.id,
        "title": case.title,
        "description": case.description,
        "difficulty": case.difficulty,
        "category": case.category,
        "estimated_minutes": case.estimated_minutes,
        "max_score": case.max_score,
        "expert_analysis": case.expert_analysis,
        "optimal_path": case.optimal_path,
        "steps": _strip_hidden_facts(case.steps),
    }


@router.post("/{case_id}/start")
async def start_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CaseScenario).where(CaseScenario.id == case_id, CaseScenario.is_active.is_(True))
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    steps = case.steps
    if not steps:
        raise HTTPException(status_code=400, detail="Case has no steps")

    attempt = CaseAttempt(
        user_id=user.id,
        case_id=case_id,
        started_at=datetime.now(timezone.utc),
        choices_made=[],
        revealed_facts=[],
        score=0,
        score_percent=0,
        completed=False,
    )
    db.add(attempt)
    await db.flush()

    first_step = copy.deepcopy(steps[0])
    hf = first_step.get("hidden_fact")
    if hf:
        first_step["hidden_fact"] = {"clue": hf["clue"]}

    return {
        "attempt_id": str(attempt.id),
        "first_step": first_step,
        "case_title": case.title,
        "total_steps": len(steps),
    }


@router.post("/{case_id}/choose")
async def make_choice(
    case_id: str,
    body: ChoiceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attempt_result = await db.execute(
        select(CaseAttempt).where(
            CaseAttempt.id == uuid.UUID(body.attempt_id),
            CaseAttempt.user_id == user.id,
            CaseAttempt.case_id == case_id,
        )
    )
    attempt = attempt_result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.completed:
        raise HTTPException(status_code=400, detail="Attempt already completed")

    case_result = await db.execute(select(CaseScenario).where(CaseScenario.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    step = None
    for s in case.steps:
        if s["id"] == body.step_id:
            step = s
            break
    if not step:
        raise HTTPException(status_code=400, detail="Invalid step_id")

    choice = None
    for c in step["choices"]:
        if c["id"] == body.choice_id:
            choice = c
            break
    if not choice:
        raise HTTPException(status_code=400, detail="Invalid choice_id")

    new_choices = list(attempt.choices_made) + [
        {"step_id": body.step_id, "choice_id": body.choice_id, "score_impact": choice["score_impact"]}
    ]
    new_score = attempt.score + choice["score_impact"]

    new_facts = list(attempt.revealed_facts)
    if choice.get("reveals_fact"):
        new_facts.append(choice["reveals_fact"])

    attempt.choices_made = new_choices
    attempt.score = new_score
    attempt.revealed_facts = new_facts

    next_step_id = choice.get("next_step_id")
    next_step = None
    if next_step_id:
        for s in case.steps:
            if s["id"] == next_step_id:
                next_step = copy.deepcopy(s)
                hf = next_step.get("hidden_fact")
                if hf:
                    next_step["hidden_fact"] = {"clue": hf["clue"]}
                break

    await db.flush()

    return {
        "consequence": choice["consequence"],
        "is_optimal": choice.get("is_optimal", False),
        "score_impact": choice["score_impact"],
        "new_score": new_score,
        "next_step": next_step,
        "reveals_fact": choice.get("reveals_fact"),
    }


@router.post("/{case_id}/reveal-fact")
async def reveal_fact(
    case_id: str,
    body: RevealFactRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attempt_result = await db.execute(
        select(CaseAttempt).where(
            CaseAttempt.id == uuid.UUID(body.attempt_id),
            CaseAttempt.user_id == user.id,
            CaseAttempt.case_id == case_id,
        )
    )
    attempt = attempt_result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.completed:
        raise HTTPException(status_code=400, detail="Attempt already completed")

    case_result = await db.execute(select(CaseScenario).where(CaseScenario.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    step = None
    for s in case.steps:
        if s["id"] == body.step_id:
            step = s
            break
    if not step:
        raise HTTPException(status_code=400, detail="Invalid step_id")

    hidden_fact = step.get("hidden_fact")
    if not hidden_fact:
        raise HTTPException(status_code=400, detail="No hidden fact in this step")

    fact_text = hidden_fact["fact"]
    if fact_text in attempt.revealed_facts:
        return {"fact_text": fact_text, "new_score": attempt.score, "already_revealed": True}

    new_facts = list(attempt.revealed_facts) + [fact_text]
    new_score = attempt.score + 5

    attempt.revealed_facts = new_facts
    attempt.score = new_score
    await db.flush()

    return {"fact_text": fact_text, "new_score": new_score, "already_revealed": False}


@router.post("/{case_id}/complete")
async def complete_case(
    case_id: str,
    body: CompleteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attempt_result = await db.execute(
        select(CaseAttempt).where(
            CaseAttempt.id == uuid.UUID(body.attempt_id),
            CaseAttempt.user_id == user.id,
            CaseAttempt.case_id == case_id,
        )
    )
    attempt = attempt_result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.completed:
        raise HTTPException(status_code=400, detail="Attempt already completed")

    case_result = await db.execute(select(CaseScenario).where(CaseScenario.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    score_percent = round((attempt.score / case.max_score) * 100) if case.max_score > 0 else 0

    attempt.completed = True
    attempt.finished_at = datetime.now(timezone.utc)
    attempt.score_percent = score_percent

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
            training_map = TrainingMapProgress(
                user_id=user.id,
                test_map={},
                exams={},
                cases=cases_data,
            )
            db.add(training_map)
        await db.flush()
    except Exception:
        logger.warning("Failed to sync cases to training_map_progress", exc_info=True)

    choices_with_optimal = []
    for cm in attempt.choices_made:
        step = None
        for s in case.steps:
            if s["id"] == cm["step_id"]:
                step = s
                break
        choice_detail = None
        if step:
            for c in step["choices"]:
                if c["id"] == cm["choice_id"]:
                    choice_detail = c
                    break
        choices_with_optimal.append({
            **cm,
            "is_optimal": choice_detail.get("is_optimal", False) if choice_detail else False,
            "text": choice_detail.get("text", "") if choice_detail else "",
            "consequence": choice_detail.get("consequence", "") if choice_detail else "",
            "step_title": step["title"] if step else "",
        })

    return {
        "score": attempt.score,
        "score_percent": score_percent,
        "max_score": case.max_score,
        "choices_made": choices_with_optimal,
        "revealed_facts": attempt.revealed_facts,
        "expert_analysis": case.expert_analysis,
        "optimal_path": case.optimal_path,
    }


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
                "score": a.score,
                "score_percent": a.score_percent,
                "completed": a.completed,
                "choices_made": a.choices_made,
                "revealed_facts": a.revealed_facts,
            }
            for a in attempts
        ]
    }
