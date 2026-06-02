"""Integration tests for the exam-rebuild API (start → submit → regrade → detail).

The AI grader (exam_grader.grade_item) is monkeypatched so CI never hits navy.
Covers the contracts that matter for §4/§5/§8:
  * AI item passes → weighted score, certificate issued only on full grade,
  * navy down → grading_status=pending, NO certificate, regrade recovers it,
  * rule-only exam graded deterministically,
  * server-side timer: an over-time attempt never certifies even on a pass.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.exam import ExamAttempt, ExamDefinition, ExamItem
from app.models.user import User
from app.services import exam_grader


@pytest.fixture(autouse=True)
def _reset_redis_pool():
    """deps.get_current_user touches a module-level Redis singleton bound to the
    event loop that created it. pytest-asyncio gives each test a fresh loop, so a
    leaked pool raises "Event loop is closed" and the auth check denies access.
    Reset the singleton around every test so get_redis() rebuilds it in-loop."""
    import app.core.redis_pool as rp
    rp._pool = None
    yield
    rp._pool = None


async def _seed_user(db) -> User:
    u = User(id=uuid.uuid4(), email=f"{uuid.uuid4().hex}@t.io",
             hashed_password="x", full_name="Тест Юрист", is_active=True)
    db.add(u)
    await db.commit()
    return u


async def _seed_case_exam(db, *, threshold=75) -> ExamDefinition:
    d = ExamDefinition(
        id="exam-3", title="Анализ дела", description="d", categories=["Банкротство физлиц"],
        question_count=0, time_limit_minutes=45, pass_threshold=threshold,
        unlock_condition={}, order_index=3, mechanic="case_analysis",
        blueprint={"items": [{"type": "case_analysis", "count": 2}]},
    )
    db.add(d)
    for n in range(2):
        db.add(ExamItem(
            id=uuid.uuid4(), exam_id="exam-3", order_index=n, type="case_analysis",
            prompt=f"Проанализируйте дело {n}", payload={"fact_pattern": "факты"},
            answer_key={}, rubric={"key_points": [{"id": "kp1", "text": "x", "weight": 1}]},
            points=10, difficulty=3, explanation="экспл",
        ))
    await db.commit()
    return d


async def _seed_rule_exam(db) -> ExamDefinition:
    d = ExamDefinition(
        id="exam-1", title="Основы", description="d", categories=["x"],
        question_count=0, time_limit_minutes=45, pass_threshold=80,
        unlock_condition={}, order_index=1, mechanic="hard_mcq",
        blueprint={"items": [{"type": "mcq", "count": 1}, {"type": "numeric", "count": 1}]},
    )
    db.add(d)
    db.add(ExamItem(id=uuid.uuid4(), exam_id="exam-1", order_index=0, type="mcq",
                    prompt="q", payload={"options": [{"id": "a", "text": "A"}]},
                    answer_key={"correct_option_id": "a"}, points=1))
    db.add(ExamItem(id=uuid.uuid4(), exam_id="exam-1", order_index=1, type="numeric",
                    prompt="срок?", payload={"unit": "дней"},
                    answer_key={"value": 30, "tolerance": 0}, points=1))
    await db.commit()
    return d


def _grade_ok(**kw):
    return exam_grader.ExamGrade(
        score=kw["max_score"], max_score=kw["max_score"], percent=100,
        covered=["kp1"], missed=[], feedback="Отлично", model="deepseek-v4-pro",
    )


def _grade_pct(pct):
    def _mk(**kw):
        ms = kw["max_score"]
        return exam_grader.ExamGrade(
            score=round(pct / 100 * ms, 2), max_score=ms, percent=pct,
            covered=["kp1"], missed=[], feedback="", model="deepseek-v4-pro",
        )
    return _mk


@pytest.mark.asyncio
async def test_case_exam_full_flow_issues_certificate(client, db_session, make_token, monkeypatch, mock_redis_pool):
    user = await _seed_user(db_session)
    await _seed_case_exam(db_session)
    monkeypatch.setattr(exam_grader, "grade_item", lambda **kw: _async(_grade_ok(**kw)))
    headers = {"Authorization": f"Bearer {make_token(user.id)}", "X-CSRF-Token": "test-csrf-token"}
    client.cookies.set("csrf_token", "test-csrf-token")

    start = await client.post("/api/exams/exam-3/start", json={}, headers=headers)
    assert start.status_code == 200, start.text
    s = start.json()
    assert s["mechanic"] == "case_analysis" and len(s["items"]) == 2
    # items carry no answer_key / rubric
    assert all("answer_key" not in it and "rubric" not in it for it in s["items"])

    answers = {it["id"]: "развёрнутый корректный анализ" for it in s["items"]}
    sub = await client.post("/api/exams/exam-3/submit",
                            json={"attempt_id": s["attempt_id"], "answers": answers}, headers=headers)
    assert sub.status_code == 200, sub.text
    r = sub.json()
    assert r["score_percent"] == 100
    assert r["grading_status"] == "complete"
    assert r["passed"] is True
    assert r["certificate_code"]
    assert r["weighted_score"] == 20.0 and r["max_weighted_score"] == 20.0
    assert all(item["covered"] == ["kp1"] for item in r["results"])


@pytest.mark.asyncio
async def test_navy_down_is_pending_no_cert_then_regrade_recovers(client, db_session, make_token, monkeypatch, mock_redis_pool):
    user = await _seed_user(db_session)
    await _seed_case_exam(db_session)
    headers = {"Authorization": f"Bearer {make_token(user.id)}", "X-CSRF-Token": "test-csrf-token"}
    client.cookies.set("csrf_token", "test-csrf-token")

    # navy down → grade_item returns None
    monkeypatch.setattr(exam_grader, "grade_item", lambda **kw: _async(None))
    start = (await client.post("/api/exams/exam-3/start", json={}, headers=headers)).json()
    answers = {it["id"]: "ответ" for it in start["items"]}
    sub = (await client.post("/api/exams/exam-3/submit",
                             json={"attempt_id": start["attempt_id"], "answers": answers}, headers=headers)).json()
    assert sub["grading_status"] == "pending"
    assert sub["passed"] is False
    assert sub["certificate_code"] is None

    # navy back → regrade recovers and certifies
    monkeypatch.setattr(exam_grader, "grade_item", lambda **kw: _async(_grade_ok(**kw)))
    monkeypatch.setattr(exam_grader, "invalidate_cache", lambda *a, **k: _async(None))
    rg = (await client.post(f"/api/exams/attempts/{start['attempt_id']}/regrade", headers=headers)).json()
    assert rg["grading_status"] == "complete"
    assert rg["passed"] is True
    assert rg["certificate_code"]


async def _start_and_pass_case(client, headers, monkeypatch):
    monkeypatch.setattr(exam_grader, "grade_item", lambda **kw: _async(_grade_ok(**kw)))
    monkeypatch.setattr(exam_grader, "invalidate_cache", lambda *a, **k: _async(None))
    start = (await client.post("/api/exams/exam-3/start", json={}, headers=headers)).json()
    answers = {it["id"]: "корректный анализ" for it in start["items"]}
    sub = (await client.post("/api/exams/exam-3/submit",
                             json={"attempt_id": start["attempt_id"], "answers": answers}, headers=headers)).json()
    return start["attempt_id"], sub


@pytest.mark.asyncio
async def test_downward_regrade_below_threshold_revokes_certificate(client, db_session, make_token, monkeypatch, mock_redis_pool):
    user = await _seed_user(db_session)
    await _seed_case_exam(db_session)  # threshold 75
    headers = {"Authorization": f"Bearer {make_token(user.id)}", "X-CSRF-Token": "t"}
    client.cookies.set("csrf_token", "t")
    attempt_id, sub = await _start_and_pass_case(client, headers, monkeypatch)
    assert sub["passed"] and sub["certificate_code"]
    code = sub["certificate_code"]
    # cert is publicly verifiable
    assert (await client.get(f"/api/exams/certificate/{code}")).status_code == 200

    # appeal re-grades to 40% (< 75) → fail → certificate must be revoked
    monkeypatch.setattr(exam_grader, "grade_item", lambda **kw: _async(_grade_pct(40)(**kw)))
    rg = (await client.post(f"/api/exams/attempts/{attempt_id}/regrade", headers=headers)).json()
    assert rg["passed"] is False
    assert rg["certificate_code"] is None
    # the old code must no longer resolve
    assert (await client.get(f"/api/exams/certificate/{code}")).status_code == 404


@pytest.mark.asyncio
async def test_downward_regrade_still_passing_syncs_cert_score(client, db_session, make_token, monkeypatch, mock_redis_pool):
    user = await _seed_user(db_session)
    await _seed_case_exam(db_session)  # threshold 75
    headers = {"Authorization": f"Bearer {make_token(user.id)}", "X-CSRF-Token": "t"}
    client.cookies.set("csrf_token", "t")
    attempt_id, sub = await _start_and_pass_case(client, headers, monkeypatch)
    code = sub["certificate_code"]
    assert sub["score_percent"] == 100

    # appeal re-grades to 80% (still ≥ 75) → keep cert, sync its score
    monkeypatch.setattr(exam_grader, "grade_item", lambda **kw: _async(_grade_pct(80)(**kw)))
    rg = (await client.post(f"/api/exams/attempts/{attempt_id}/regrade", headers=headers)).json()
    assert rg["passed"] is True
    assert rg["certificate_code"] == code  # same cert preserved
    assert rg["score_percent"] == 80
    cert = (await client.get(f"/api/exams/certificate/{code}")).json()
    assert cert["score_percent"] == 80  # verifiable cert synced, not stale 100


@pytest.mark.asyncio
async def test_regrade_transient_outage_keeps_earned_certificate(client, db_session, make_token, monkeypatch, mock_redis_pool):
    user = await _seed_user(db_session)
    await _seed_case_exam(db_session)
    headers = {"Authorization": f"Bearer {make_token(user.id)}", "X-CSRF-Token": "t"}
    client.cookies.set("csrf_token", "t")
    attempt_id, sub = await _start_and_pass_case(client, headers, monkeypatch)
    code = sub["certificate_code"]

    # appeal during a navy outage (grade_item → None) must NOT revoke the earned cert
    monkeypatch.setattr(exam_grader, "grade_item", lambda **kw: _async(None))
    rg = (await client.post(f"/api/exams/attempts/{attempt_id}/regrade", headers=headers)).json()
    assert rg["passed"] is True
    assert rg["grading_status"] == "complete"
    assert rg["certificate_code"] == code
    assert (await client.get(f"/api/exams/certificate/{code}")).status_code == 200


@pytest.mark.asyncio
async def test_rule_exam_deterministic(client, db_session, make_token, mock_redis_pool):
    user = await _seed_user(db_session)
    await _seed_rule_exam(db_session)
    headers = {"Authorization": f"Bearer {make_token(user.id)}", "X-CSRF-Token": "test-csrf-token"}
    client.cookies.set("csrf_token", "test-csrf-token")
    start = (await client.post("/api/exams/exam-1/start", json={}, headers=headers)).json()
    mcq = next(i for i in start["items"] if i["type"] == "mcq")
    num = next(i for i in start["items"] if i["type"] == "numeric")
    answers = {mcq["id"]: "a", num["id"]: "30"}
    r = (await client.post("/api/exams/exam-1/submit",
                           json={"attempt_id": start["attempt_id"], "answers": answers}, headers=headers)).json()
    assert r["score_percent"] == 100 and r["passed"] is True
    assert r["grading_status"] == "complete"


@pytest.mark.asyncio
async def test_over_time_attempt_does_not_certify(client, db_session, make_token, monkeypatch, mock_redis_pool):
    user = await _seed_user(db_session)
    await _seed_case_exam(db_session)
    monkeypatch.setattr(exam_grader, "grade_item", lambda **kw: _async(_grade_ok(**kw)))
    headers = {"Authorization": f"Bearer {make_token(user.id)}", "X-CSRF-Token": "test-csrf-token"}
    client.cookies.set("csrf_token", "test-csrf-token")
    start = (await client.post("/api/exams/exam-3/start", json={}, headers=headers)).json()

    # Backdate started_at well beyond the 45-min limit + grace.
    att = (await db_session.execute(
        __import__("sqlalchemy").select(ExamAttempt).where(
            ExamAttempt.id == uuid.UUID(start["attempt_id"]))
    )).scalar_one()
    att.started_at = datetime.now(timezone.utc) - timedelta(hours=2)
    await db_session.commit()

    answers = {it["id"]: "корректный анализ" for it in start["items"]}
    r = (await client.post("/api/exams/exam-3/submit",
                           json={"attempt_id": start["attempt_id"], "answers": answers}, headers=headers)).json()
    assert r["score_percent"] == 100      # graded fine
    assert r["time_valid"] is False        # but over time
    assert r["passed"] is False            # so no pass
    assert r["certificate_code"] is None   # and no certificate


# tiny awaitable helper so monkeypatched sync lambdas satisfy `await`
async def _async(value):
    return value
