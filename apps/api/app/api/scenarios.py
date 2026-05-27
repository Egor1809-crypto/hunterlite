"""GET /api/scenarios/ — list active scenarios for the training catalog.

The frontend's useTrainingStore.fetchScenarios() calls this endpoint to
populate the scenario grid on /training. Returns a merged list from both
the legacy `scenarios` table and the newer `scenario_templates` table.
"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.scenario import Scenario, ScenarioTemplate
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/scenarios/")
async def list_scenarios(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all active scenarios for the training catalog.

    Merges legacy Scenario rows with ScenarioTemplate rows so the frontend
    gets a unified list regardless of which table the data lives in.
    """
    results = []

    # 1) Legacy scenarios table
    legacy_q = select(Scenario).where(Scenario.is_active.is_(True))
    legacy_rows = (await db.execute(legacy_q)).scalars().all()
    seen_ids = set()
    for s in legacy_rows:
        seen_ids.add(str(s.id))
        results.append({
            "id": str(s.id),
            "title": s.title,
            "description": s.description,
            "scenario_type": s.scenario_type.value if s.scenario_type else "cold_call",
            "difficulty": s.difficulty,
            "estimated_duration_minutes": s.estimated_duration_minutes,
            "character_name": None,
        })

    # 2) ScenarioTemplate rows (v2) — only those not already represented
    tmpl_q = select(ScenarioTemplate).where(ScenarioTemplate.is_active.is_(True))
    tmpl_rows = (await db.execute(tmpl_q)).scalars().all()
    for t in tmpl_rows:
        if str(t.id) in seen_ids:
            continue
        # Map template group to legacy type for frontend compat
        code = t.code or ""
        if code.startswith("cold"):
            stype = "cold_call"
        elif code.startswith("warm"):
            stype = "warm_call"
        elif code.startswith("in_"):
            stype = "incoming_call"
        else:
            stype = "special"
        results.append({
            "id": str(t.id),
            "title": t.name,
            "description": t.description,
            "scenario_type": stype,
            "difficulty": t.difficulty,
            "estimated_duration_minutes": t.typical_duration_minutes,
            "character_name": None,
        })

    logger.info("list_scenarios: returned %d items for user %s", len(results), user.id)
    return results
