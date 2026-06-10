"""API tests for course progress + per-lesson mini-check (Course Progress Этап 1).

Covers the contracts that matter:
  * GET quiz returns questions WITHOUT the correct answer (no leak),
  * a 3/3 submit marks the lesson passed and moves the course %,
  * a wrong answer consumes an attempt without revealing what was wrong,
  * 3 failed attempts lock the lesson until a re-watch resets the counter.
"""
import uuid

import pytest

from app.api.courses import _option_order
from app.data.course_quizzes import QUIZZES
from app.models.user import User

SLUG = "yuridicheskie-aspekty"


@pytest.fixture(autouse=True)
def _reset_redis_pool():
    import app.core.redis_pool as rp

    rp._pool = None
    yield
    rp._pool = None


async def _seed_user(db, full_name="Иван Петров") -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4().hex}@t.io",
        hashed_password="x",
        full_name=full_name,
        is_active=True,
    )
    db.add(u)
    await db.commit()
    return u


def _hdr(make_token, user, client=None):
    if client is not None:
        client.cookies.set("csrf_token", "test-csrf")
    return {"Authorization": f"Bearer {make_token(user.id)}", "X-CSRF-Token": "test-csrf"}


def _answers(user_id, lesson_index: int, *, correct: bool) -> list[int]:
    """Build the SHOWN-position answers for a lesson, all-correct or all-wrong,
    using the same deterministic shuffle the server grades with."""
    quiz = QUIZZES[SLUG][lesson_index]
    out = []
    for qi, q in enumerate(quiz):
        order = _option_order(user_id, SLUG, lesson_index, qi, len(q["options"]))
        right = order.index(q["correct"])  # shown position of the correct option
        out.append(right if correct else (right + 1) % len(order))
    return out


async def test_get_quiz_hides_correct_answer(client, db_session, make_token, mock_redis_pool):
    user = await _seed_user(db_session)
    hdr = _hdr(make_token, user, client)
    r = await client.get(f"/api/courses/{SLUG}/lessons/0/quiz", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert len(body["questions"]) == 3
    assert body["completed"] is False and body["attempts_used"] == 0
    # No correct-answer field leaks to the client.
    for q in body["questions"]:
        assert "correct" not in q and len(q["options"]) >= 2


async def test_submit_three_of_three_passes_and_moves_percent(
    client, db_session, make_token, mock_redis_pool
):
    user = await _seed_user(db_session)
    hdr = _hdr(make_token, user, client)

    r = await client.post(
        f"/api/courses/{SLUG}/lessons/0/quiz/submit",
        headers=hdr,
        json={"answers": _answers(user.id, 0, correct=True)},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["passed"] is True and body["completed"] is True

    prog = (await client.get("/api/courses/progress", headers=hdr)).json()
    course = next(c for c in prog["courses"] if c["course_slug"] == SLUG)
    assert course["completed_lessons"] == 1
    assert course["percent"] == round(1 / course["total_lessons"] * 100)


async def test_wrong_answer_consumes_attempt_without_leak(
    client, db_session, make_token, mock_redis_pool
):
    user = await _seed_user(db_session)
    hdr = _hdr(make_token, user, client)
    r = await client.post(
        f"/api/courses/{SLUG}/lessons/1/quiz/submit",
        headers=hdr,
        json={"answers": _answers(user.id, 1, correct=False)},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["passed"] is False and body["completed"] is False
    assert body["attempts_used"] == 1 and body["attempts_left"] == 2
    # Response must not reveal which answers were right.
    assert "correct" not in body and "correct_answers" not in body


async def test_three_fails_lock_then_rewatch_resets(
    client, db_session, make_token, mock_redis_pool
):
    user = await _seed_user(db_session)
    hdr = _hdr(make_token, user, client)
    wrong = {"answers": _answers(user.id, 2, correct=False)}

    for _ in range(3):
        assert (await client.post(f"/api/courses/{SLUG}/lessons/2/quiz/submit", headers=hdr, json=wrong)).status_code == 200
    # 4th attempt blocked.
    locked = await client.post(f"/api/courses/{SLUG}/lessons/2/quiz/submit", headers=hdr, json=wrong)
    assert locked.status_code == 409

    # Re-watch resets the counter → can try again and pass.
    assert (await client.post(f"/api/courses/{SLUG}/lessons/2/rewatch", headers=hdr)).status_code == 204
    ok = await client.post(
        f"/api/courses/{SLUG}/lessons/2/quiz/submit",
        headers=hdr,
        json={"answers": _answers(user.id, 2, correct=True)},
    )
    assert ok.status_code == 200 and ok.json()["passed"] is True


async def test_unknown_lesson_404(client, db_session, make_token, mock_redis_pool):
    user = await _seed_user(db_session)
    hdr = _hdr(make_token, user, client)
    assert (await client.get(f"/api/courses/{SLUG}/lessons/999/quiz", headers=hdr)).status_code == 404


async def test_locked_future_lesson_rejected(client, db_session, make_token, mock_redis_pool):
    """A lesson whose drip unlock is still in the future is gated (409) on both
    quiz fetch and submit; progress marks it locked with an unlock_at."""
    from datetime import datetime, timedelta, timezone

    from app.services.course_schedule import unlock_at

    user = await _seed_user(db_session)
    hdr = _hdr(make_token, user, client)

    # Find a lesson that is genuinely still locked (unlock in the future).
    now = datetime.now(timezone.utc)
    locked_idx = next(
        (i for i in sorted(QUIZZES[SLUG]) if (ua := unlock_at(SLUG, i)) and ua > now + timedelta(days=1)),
        None,
    )
    if locked_idx is None:
        pytest.skip("no future-locked lesson at current date")

    assert (await client.get(f"/api/courses/{SLUG}/lessons/{locked_idx}/quiz", headers=hdr)).status_code == 409
    submit = await client.post(
        f"/api/courses/{SLUG}/lessons/{locked_idx}/quiz/submit",
        headers=hdr,
        json={"answers": _answers(user.id, locked_idx, correct=True)},
    )
    assert submit.status_code == 409

    prog = (await client.get("/api/courses/progress", headers=hdr)).json()
    course = next(c for c in prog["courses"] if c["course_slug"] == SLUG)
    locked_lesson = next(l for l in course["lessons"] if l["lesson_index"] == locked_idx)
    assert locked_lesson["locked"] is True and locked_lesson["unlock_at"]
