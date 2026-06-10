"""API tests for the championship + reviews feature (Phase 1).

Covers the contracts that matter:
  * GET /championship/current exposes the seeded season (public),
  * POST /championship/enroll is idempotent (one entry per user),
  * GET /championship/winners is empty for the first championship,
  * reviews go through a moderation gate (hidden until approved) and a user
    cannot post two active reviews (409).
"""
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select, update

from app.models.championship import (
    Championship,
    ChampionshipEntry,
    ChampionshipWinner,
)
from app.data.course_quizzes import QUIZZES
from app.models.course_progress import CourseLessonProgress
from app.models.exam import ExamAttempt, ExamCertificate, ExamDefinition
from app.models.review import Review
from app.models.subscription import UserSubscription
from app.models.user import User
from app.services.championship_season import advance_season_states

# Courses a champion must complete 100% (mirror of qualification gate).
_REQUIRED_COURSES = ("yuridicheskie-aspekty", "expertnyi-uroven-bfl")


@pytest.fixture(autouse=True)
def _reset_redis_pool():
    """get_current_user touches a loop-bound Redis singleton; reset around each
    test so it rebuilds in the current event loop (see test_exam_api_flow)."""
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


_THREE_PRIZES = [
    {"rank": 1, "name": "MacBook Air 13 M4", "value": 130000},
    {"rank": 2, "name": "iPhone 15", "value": 80000},
    {"rank": 3, "name": "AirPods 4", "value": 20000},
]


async def _seed_championship(
    db, *, status="active", number=1, prizes=None, winner_mode="draw"
) -> Championship:
    c = Championship(
        id=uuid.uuid4(),
        number=number,
        season_type="summer_autumn",
        title="Тестовый чемпионат",
        starts_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        tally_starts_at=datetime(2026, 11, 24, tzinfo=timezone.utc),
        ends_at=datetime(2026, 11, 30, 23, 59, 59, tzinfo=timezone.utc),
        status=status,
        winner_mode=winner_mode,
        prize_fund=prizes if prizes is not None else [_THREE_PRIZES[0]],
    )
    db.add(c)
    await db.commit()
    return c


async def _ensure_exam_def(db, exam_id="champ-exam") -> str:
    existing = (
        await db.execute(select(ExamDefinition).where(ExamDefinition.id == exam_id))
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            ExamDefinition(
                id=exam_id,
                title="Аттестация",
                description="тест",
                categories=[],
                question_count=10,
                time_limit_minutes=30,
            )
        )
        await db.commit()
    return exam_id


async def _make_certificate(db, user, *, score=95) -> None:
    """Seed the exam chain so the user counts as attested (≥88%)."""
    exam_id = await _ensure_exam_def(db)
    attempt = ExamAttempt(
        id=uuid.uuid4(), user_id=user.id, exam_id=exam_id,
        score_percent=score, passed=True, grading_status="complete",
    )
    db.add(attempt)
    await db.commit()
    db.add(
        ExamCertificate(
            id=uuid.uuid4(), user_id=user.id, exam_id=exam_id, attempt_id=attempt.id,
            certificate_code=uuid.uuid4().hex, score_percent=score, user_name=user.full_name,
        )
    )
    await db.commit()


async def _make_subscription(db, user, *, plan="hunter") -> None:
    db.add(UserSubscription(id=uuid.uuid4(), user_id=user.id, plan_type=plan, expires_at=None))
    await db.commit()


async def _make_review(db, user) -> None:
    db.add(
        Review(
            id=uuid.uuid4(), user_id=user.id, name=user.full_name, role="Менеджер",
            text="Отличная платформа, всем советую пройти курс!", rating=5,
            approved=True, deleted=False,
        )
    )
    await db.commit()


async def _complete_courses(db, user) -> None:
    """Mark every lesson of every required (non-empty) course passed — 100%."""
    for slug in _REQUIRED_COURSES:
        for idx in QUIZZES.get(slug, {}):
            db.add(
                CourseLessonProgress(
                    id=uuid.uuid4(), user_id=user.id, course_slug=slug, lesson_index=idx,
                    completed_at=datetime.now(timezone.utc),
                )
            )
    await db.commit()


async def _qualify_user(db, champ, name) -> User:
    """A user that satisfies all objective conditions + an enrolled entry, so a
    recompute promotes them to ``qualified`` (the draw pool)."""
    user = await _seed_user(db, full_name=name)
    await _make_certificate(db, user)
    await _make_subscription(db, user)
    await _make_review(db, user)
    await _complete_courses(db, user)
    db.add(
        ChampionshipEntry(
            id=uuid.uuid4(), championship_id=champ.id, user_id=user.id, status="enrolled",
        )
    )
    await db.commit()
    return user


def _hdr(make_token, user, client=None):
    # Double-submit CSRF: the header must equal the csrf_token cookie. Set the
    # matching cookie on the client so mutating requests pass the gate.
    if client is not None:
        client.cookies.set("csrf_token", "test-csrf")
    return {"Authorization": f"Bearer {make_token(user.id)}", "X-CSRF-Token": "test-csrf"}


async def test_current_championship_public(client, db_session):
    await _seed_championship(db_session)
    r = await client.get("/api/championship/current")
    assert r.status_code == 200
    body = r.json()
    assert body["championship"]["number"] == 1
    assert body["championship"]["winner_mode"] == "draw"
    assert body["qualified_count"] == 0


async def test_enroll_is_idempotent(client, db_session, make_token, mock_redis_pool):
    user = await _seed_user(db_session)
    await _seed_championship(db_session)
    hdr = _hdr(make_token, user, client)

    me = (await client.get("/api/championship/me", headers=hdr)).json()
    assert me["enrolled"] is False

    r1 = await client.post("/api/championship/enroll", headers=hdr)
    assert r1.status_code == 200 and r1.json()["enrolled"] is True

    # Second enroll must not create a second entry nor error.
    r2 = await client.post("/api/championship/enroll", headers=hdr)
    assert r2.status_code == 200 and r2.json()["enrolled"] is True

    me2 = (await client.get("/api/championship/me", headers=hdr)).json()
    assert me2["enrolled"] is True and me2["status"] == "enrolled"


async def test_winners_empty_for_first_championship(client, db_session):
    await _seed_championship(db_session)
    r = await client.get("/api/championship/winners")
    assert r.status_code == 200 and r.json() == []


async def test_review_moderation_gate_and_duplicate(client, db_session, make_token, mock_redis_pool):
    user = await _seed_user(db_session)
    hdr = _hdr(make_token, user, client)

    # Public wall starts empty.
    assert (await client.get("/api/reviews")).json() == []

    # Submit → goes to moderation (approved=False) → still hidden.
    r = await client.post(
        "/api/reviews", headers=hdr, json={"text": "Очень полезная платформа, рекомендую!", "rating": 5}
    )
    assert r.status_code == 201
    assert (await client.get("/api/reviews")).json() == []

    # Duplicate active review → 409.
    r2 = await client.post(
        "/api/reviews", headers=hdr, json={"text": "Второй отзыв, дубликат для теста.", "rating": 4}
    )
    assert r2.status_code == 409

    # Approve it → now visible on the public wall.
    await db_session.execute(update(Review).values(approved=True))
    await db_session.commit()
    body = (await client.get("/api/reviews")).json()
    assert len(body) == 1
    assert body[0]["text"].startswith("Очень полезная")
    assert body[0]["name"] == "Иван Петров"  # falls back to user's full name


# ───────────────────────── Phase C: qualification ─────────────────────────

async def test_enroll_promotes_to_qualified_when_all_conditions_met(
    client, db_session, make_token, mock_redis_pool
):
    """Cert (≥88%) + active paid sub + 100% courses + review → enrolled→qualified."""
    user = await _seed_user(db_session)
    champ = await _seed_championship(db_session)
    await _make_certificate(db_session, user)
    await _make_subscription(db_session, user)
    await _make_review(db_session, user)
    await _complete_courses(db_session, user)
    hdr = _hdr(make_token, user, client)

    r = await client.post("/api/championship/enroll", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "qualified"
    assert body["criteria"]["exam_passed"] is True
    assert body["criteria"]["subscribed"] is True
    assert body["criteria"]["courses_done"] is True
    assert body["criteria"]["review_left"] is True

    cnt = await db_session.execute(
        select(func.count(ChampionshipEntry.id)).where(
            ChampionshipEntry.championship_id == champ.id,
            ChampionshipEntry.status == "qualified",
        )
    )
    assert int(cnt.scalar()) == 1


async def test_enroll_stays_enrolled_when_a_condition_is_missing(
    client, db_session, make_token, mock_redis_pool
):
    """No certificate → not attested → stays enrolled, never qualified."""
    user = await _seed_user(db_session)
    await _seed_championship(db_session)
    await _make_subscription(db_session, user)
    await _make_review(db_session, user)  # but no certificate
    hdr = _hdr(make_token, user, client)

    body = (await client.post("/api/championship/enroll", headers=hdr)).json()
    assert body["status"] == "enrolled"
    assert body["criteria"]["exam_passed"] is False
    assert body["criteria"]["subscribed"] is True


async def test_incomplete_courses_block_qualification(
    client, db_session, make_token, mock_redis_pool
):
    """Cert + sub + review but courses NOT 100% → stays enrolled (Этап 3 gate)."""
    user = await _seed_user(db_session)
    await _seed_championship(db_session)
    await _make_certificate(db_session, user)
    await _make_subscription(db_session, user)
    await _make_review(db_session, user)
    # Only one lesson done — far from 100%.
    db_session.add(
        CourseLessonProgress(
            id=uuid.uuid4(), user_id=user.id, course_slug="yuridicheskie-aspekty",
            lesson_index=0, completed_at=datetime.now(timezone.utc),
        )
    )
    await db_session.commit()
    hdr = _hdr(make_token, user, client)

    body = (await client.post("/api/championship/enroll", headers=hdr)).json()
    assert body["status"] == "enrolled"
    assert body["criteria"]["courses_done"] is False


async def test_parallel_enroll_same_user_keeps_one_entry(db_session):
    """A genuine concurrency burst (asyncio.gather) of enrolls for the SAME
    (championship, user) must let exactly one INSERT commit; the rest hit
    UNIQUE(championship_id, user_id) and lose. This is the contract
    ``_get_or_create_entry`` relies on to re-read instead of 500'ing
    (CLAUDE.md §4.1).

    Tested at the model layer with one fresh session per task (the established
    pattern in test_methodology_concurrency) — under SQLite+StaticPool a
    cross-session SELECT count isn't reliable, but the one-winner/four-loser
    IntegrityError split is the real proof.
    """
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    user = await _seed_user(db_session)
    champ = await _seed_championship(db_session)
    engine = db_session.bind
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _try_insert(idx: int) -> bool:
        async with factory() as own_db:
            own_db.add(
                ChampionshipEntry(
                    id=uuid.uuid4(),
                    championship_id=champ.id,
                    user_id=user.id,
                    status="enrolled",
                )
            )
            try:
                await own_db.commit()
                return True
            except IntegrityError:
                await own_db.rollback()
                return False

    results = await asyncio.gather(*(_try_insert(i) for i in range(5)))
    assert sum(results) == 1, f"exactly one enroll must win the UNIQUE race; got {results}"
    assert sum(1 for r in results if r is False) == 4, results


# ───────────────────────── Phase C: season FSM ─────────────────────────

async def test_season_fsm_advances_and_spawns_next(db_session):
    """A season whose ends_at has passed flips to 'finished' and the next season
    (sequential number, next type) is created."""
    await _seed_championship(db_session, status="active")  # summer_autumn 2026
    # A point in time after 30 Nov 2026.
    now = datetime(2027, 1, 15, tzinfo=timezone.utc)

    report = await advance_season_states(db_session, now=now)
    assert report["status_changed"]["to"] == "finished"
    assert report["created"]["number"] == 2
    assert report["created"]["season_type"] == "winter_spring"

    champs = (
        await db_session.execute(select(Championship).order_by(Championship.number))
    ).scalars().all()
    assert [c.number for c in champs] == [1, 2]
    assert champs[0].status == "finished"
    # winter_spring 2026 runs 1 Dec 2026 – 31 May 2027 → active at 2027-01-15.
    assert champs[1].season_type == "winter_spring"
    assert champs[1].status == "active"

    # Idempotent: a second call does not spawn a third season.
    await advance_season_states(db_session, now=now)
    cnt = await db_session.execute(select(func.count(Championship.id)))
    assert int(cnt.scalar()) == 2


# ───────────────────────── Phase C: operator draw ─────────────────────────

async def test_draw_records_winners_among_qualified(
    client, db_session, make_token, mock_redis_pool
):
    champ = await _seed_championship(
        db_session, status="tallying", prizes=_THREE_PRIZES
    )
    u1 = await _qualify_user(db_session, champ, "Анна Иванова")
    u2 = await _qualify_user(db_session, champ, "Борис Петров")
    u3 = await _qualify_user(db_session, champ, "Вера Сидорова")

    admin = await _seed_user(db_session, full_name="Админ")
    admin.role = "admin"
    await db_session.commit()
    hdr = _hdr(make_token, admin, client)

    payload = {
        "winners": [
            {"user_id": str(u1.id), "rank": 1},
            {"user_id": str(u2.id), "rank": 2},
            {"user_id": str(u3.id), "rank": 3},
        ],
        "random_org_verification": "https://www.random.org/draws/...",
        "finalize": True,
    }
    r = await client.post(f"/api/championship/{champ.id}/draw", headers=hdr, json=payload)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 3
    assert {row["rank"] for row in rows} == {1, 2, 3}
    assert rows[0]["prize"] == "MacBook Air 13 M4"

    # Persisted + season finalized.
    wcnt = await db_session.execute(
        select(func.count(ChampionshipWinner.id)).where(
            ChampionshipWinner.championship_id == champ.id
        )
    )
    assert int(wcnt.scalar()) == 3
    await db_session.refresh(champ)
    assert champ.status == "finished"

    # Idempotent: a second draw is rejected.
    r2 = await client.post(f"/api/championship/{champ.id}/draw", headers=hdr, json=payload)
    assert r2.status_code == 409


async def test_draw_rejects_non_qualified_winner(
    client, db_session, make_token, mock_redis_pool
):
    champ = await _seed_championship(
        db_session, status="tallying", prizes=_THREE_PRIZES
    )
    u1 = await _qualify_user(db_session, champ, "Анна Иванова")
    # A user who never qualified.
    outsider = await _seed_user(db_session, full_name="Чужак")

    admin = await _seed_user(db_session, full_name="Админ")
    admin.role = "admin"
    await db_session.commit()
    hdr = _hdr(make_token, admin, client)

    payload = {"winners": [{"user_id": str(outsider.id), "rank": 1}]}
    r = await client.post(f"/api/championship/{champ.id}/draw", headers=hdr, json=payload)
    assert r.status_code == 422

    # Sanity: a qualified winner is accepted.
    ok = await client.post(
        f"/api/championship/{champ.id}/draw",
        headers=hdr,
        json={"winners": [{"user_id": str(u1.id), "rank": 1}]},
    )
    assert ok.status_code == 200


async def test_draw_requires_admin(client, db_session, make_token, mock_redis_pool):
    champ = await _seed_championship(db_session, status="tallying", prizes=_THREE_PRIZES)
    user = await _seed_user(db_session)  # plain manager
    hdr = _hdr(make_token, user, client)
    r = await client.post(
        f"/api/championship/{champ.id}/draw",
        headers=hdr,
        json={"auto_rank": True},
    )
    assert r.status_code == 403


# ───────────────────────── Phase E: review moderation ─────────────────────────

async def test_review_moderation_admin_approve_and_reject(
    client, db_session, make_token, mock_redis_pool
):
    user = await _seed_user(db_session, full_name="Пользователь Один")
    admin = await _seed_user(db_session, full_name="Модератор")
    admin.role = "admin"
    await db_session.commit()
    uhdr = _hdr(make_token, user, client)
    ahdr = _hdr(make_token, admin, client)

    # User submits → moderation queue, not on the public wall yet.
    r = await client.post(
        "/api/reviews", headers=uhdr, json={"text": "Хочу на стену отзывов, очень круто!", "rating": 5}
    )
    assert r.status_code == 201
    review_id = r.json()["id"]
    assert (await client.get("/api/reviews")).json() == []

    # Non-admin cannot see the moderation queue.
    assert (await client.get("/api/reviews/pending", headers=uhdr)).status_code == 403

    # Admin sees it pending, then approves → it appears publicly.
    pending = (await client.get("/api/reviews/pending", headers=ahdr)).json()
    assert len(pending) == 1 and pending[0]["id"] == review_id
    ok = await client.post(f"/api/reviews/{review_id}/approve", headers=ahdr)
    assert ok.status_code == 200 and ok.json()["approved"] is True
    wall = (await client.get("/api/reviews")).json()
    assert len(wall) == 1 and wall[0]["id"] == review_id

    # A second user's review gets rejected (soft-deleted) → stays hidden and the
    # user's one-review slot frees up so they can re-submit.
    user2 = await _seed_user(db_session, full_name="Пользователь Два")
    u2hdr = _hdr(make_token, user2, client)
    r2 = await client.post(
        "/api/reviews", headers=u2hdr, json={"text": "Второй отзыв на модерацию, тест.", "rating": 4}
    )
    rid2 = r2.json()["id"]
    rej = await client.post(f"/api/reviews/{rid2}/reject", headers=ahdr)
    assert rej.status_code == 204
    assert (await client.get("/api/reviews/pending", headers=ahdr)).json() == []  # queue cleared
    # Slot freed: user2 can submit again (no 409).
    again = await client.post(
        "/api/reviews", headers=u2hdr, json={"text": "Переотправка после отклонения, ок.", "rating": 5}
    )
    assert again.status_code == 201
