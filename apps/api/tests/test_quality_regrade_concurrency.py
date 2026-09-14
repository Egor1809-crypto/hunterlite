"""Real PostgreSQL row locks protect ownership and exactly-once rubric migration."""

import asyncio
import os
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.requests import Request

from app.api import training
from app.models.character import Character
from app.models.scenario import Scenario, ScenarioType
from app.models.training import SessionStatus, TrainingSession
from app.models.user import User
from app.services import conversation_quality as quality


@pytest.mark.asyncio
async def test_concurrent_regrade_keeps_previous_score_and_only_grades_once(monkeypatch):
    url = os.getenv("TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Requires disposable migrated PostgreSQL")
    engine = create_async_engine(url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    uid, sid, scenario_id, cid = [uuid.uuid4() for _ in range(4)]
    count = 0
    report = quality.aggregate_assessment(
        {"awards": [], "violations": [], "summary": "Полезных действий не выполнено."}, [], []
    )

    async def score(*args):
        nonlocal count
        count += 1
        await asyncio.sleep(0.1)
        return quality.to_breakdown(report)

    monkeypatch.setattr(training, "calculate_scores", score)
    monkeypatch.setattr(
        training,
        "generate_recommendations",
        AsyncMock(return_value="Нужно представиться и выяснить ситуацию."),
    )
    handler = training.rescore_call.__wrapped__

    def request():
        return Request(
            {
                "type": "http",
                "method": "POST",
                "path": f"/training/sessions/{sid}/rescore-call",
                "headers": [],
            }
        )

    try:
        async with sessions() as db:
            db.add(
                User(
                    id=uid,
                    email=f"quality-qa-{uid}@hunterlite.test",
                    full_name="Quality QA",
                    hashed_password="unused",
                    role="manager",
                )
            )
            db.add(
                Character(
                    id=cid,
                    name="Quality QA",
                    slug=f"quality-{cid}",
                    description="Test",
                    prompt_path="unused",
                )
            )
            await db.flush()
            db.add(
                Scenario(
                    character_id=cid,
                    id=scenario_id,
                    title="Quality QA",
                    description="Test",
                    scenario_type=ScenarioType.consultation,
                )
            )
            await db.flush()
            db.add(
                TrainingSession(
                    id=sid,
                    user_id=uid,
                    scenario_id=scenario_id,
                    status=SessionStatus.completed,
                    score_total=40.4,
                    scoring_details={"judge": {"verdict": "mixed"}, "_scoring_pending": False},
                )
            )
            await db.commit()
        async with sessions() as db:
            with pytest.raises(HTTPException) as exc:
                await handler(sid, request(), user=SimpleNamespace(id=uuid.uuid4()), db=db)
            assert exc.value.status_code == 404

        async def regrade():
            async with sessions() as db:
                return await handler(sid, request(), user=SimpleNamespace(id=uid), db=db)

        results = await asyncio.gather(*(regrade() for _ in range(5)))
        assert results == [{"score_total": 0}] * 5
        assert count == 1
        async with sessions() as db:
            session = await db.scalar(select(TrainingSession).where(TrainingSession.id == sid))
            assert session.status == SessionStatus.completed
            assert session.scoring_details["_previous_assessment"]["score_total"] == 40.4
            assert session.scoring_details["_scoring_version"] == quality.VERSION
            assert "judge" not in session.scoring_details
            assert session.score_total == 0
    finally:
        async with sessions() as db:
            await db.execute(delete(TrainingSession).where(TrainingSession.id == sid))
            await db.execute(delete(Scenario).where(Scenario.id == scenario_id))
            await db.execute(delete(Character).where(Character.id == cid))
            await db.execute(delete(User).where(User.id == uid))
            await db.commit()
        await engine.dispose()
