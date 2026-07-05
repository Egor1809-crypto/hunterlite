"""Championship / giveaway (чемпионат-розыгрыш) API.

Endpoints (see CHAMPIONSHIP_PLAN §3.2):

- GET  /championship/current             — current season + prizes + status (public).
- GET  /championship/{id}/leaderboard    — qualified pool / engagement ordering (public).
- GET  /championship/winners             — winners history across finished seasons (public).
- POST /championship/enroll              — enroll into the current season (auth).
- GET  /championship/me                  — my entry + progress against entry conditions (auth).

Winner determination itself (the draw among qualified participants) is an
operator action recorded into ``championship_winners`` — not exposed here.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.championship import (
    Championship,
    ChampionshipEntry,
    ChampionshipWinner,
)
from app.models.user import User
from app.services.championship_qualification import (
    compute_metrics,
    recompute_championship,
    recompute_entry,
)
from app.services.championship_season import advance_season_states

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────── schemas ────────────────────────────

class ChampionshipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    season_type: str
    title: str
    starts_at: datetime
    tally_starts_at: datetime
    ends_at: datetime
    status: str
    winner_mode: str
    prize_fund: list | None = None


class CurrentChampionshipOut(BaseModel):
    championship: ChampionshipOut | None
    qualified_count: int = 0


class LeaderboardRow(BaseModel):
    rank: int
    name: str
    score: float
    status: str


class WinnerRow(BaseModel):
    championship_number: int
    season_type: str
    rank: int
    prize: str
    name: str


class MyEntryOut(BaseModel):
    enrolled: bool
    status: str | None = None
    score: float = 0
    criteria: dict


# ──────────────────────────── helpers ────────────────────────────

def _abbrev(full_name: str | None) -> str:
    """«Иван Петров» → «И. Петров» (privacy-conscious public display)."""
    if not full_name:
        return "Участник"
    parts = full_name.split()
    if len(parts) >= 2:
        return f"{parts[0][:1]}. {parts[-1]}"
    return parts[0]


async def _current_championship(db: AsyncSession) -> Championship | None:
    """The season users currently interact with: active/tallying, else the
    nearest upcoming, else the most recent."""
    for statuses in (("active", "tallying"), ("upcoming",), ("finished",)):
        row = await db.execute(
            select(Championship)
            .where(Championship.status.in_(statuses))
            .order_by(Championship.number.desc())
            .limit(1)
        )
        champ = row.scalar_one_or_none()
        if champ is not None:
            return champ
    return None


# ──────────────────────────── routes ────────────────────────────

@router.get("/championship/current", response_model=CurrentChampionshipOut)
async def current_championship(db: AsyncSession = Depends(get_db)):
    # Lazy FSM: reconcile season status with the calendar on read (cheap,
    # idempotent). Never let an FSM hiccup break the public page.
    try:
        await advance_season_states(db)
    except Exception:  # pragma: no cover — defensive
        logger.warning("advance_season_states failed on /current", exc_info=True)
    champ = await _current_championship(db)
    if champ is None:
        return CurrentChampionshipOut(championship=None, qualified_count=0)
    qcount = await db.execute(
        select(func.count(ChampionshipEntry.id)).where(
            ChampionshipEntry.championship_id == champ.id,
            ChampionshipEntry.status == "qualified",
        )
    )
    return CurrentChampionshipOut(
        championship=ChampionshipOut.model_validate(champ),
        qualified_count=int(qcount.scalar() or 0),
    )


@router.get("/championship/{championship_id}/leaderboard", response_model=list[LeaderboardRow])
async def leaderboard(
    championship_id: uuid.UUID, limit: int = 20, db: AsyncSession = Depends(get_db)
):
    """Qualified pool, ordered by score (engagement). Does NOT determine the
    winner — winners are drawn among qualified participants (winner_mode='draw')."""
    limit = max(1, min(limit, 100))
    rows = await db.execute(
        select(ChampionshipEntry, User.full_name)
        .join(User, User.id == ChampionshipEntry.user_id)
        .where(
            ChampionshipEntry.championship_id == championship_id,
            ChampionshipEntry.status != "disqualified",
        )
        .order_by(ChampionshipEntry.score.desc(), ChampionshipEntry.created_at.asc())
        .limit(limit)
    )
    out: list[LeaderboardRow] = []
    for i, (entry, full_name) in enumerate(rows.all(), start=1):
        out.append(
            LeaderboardRow(
                rank=i, name=_abbrev(full_name), score=entry.score, status=entry.status
            )
        )
    return out


@router.get("/championship/winners", response_model=list[WinnerRow])
async def winners(db: AsyncSession = Depends(get_db)):
    """Winners history (empty for the first championship — renders as empty-state)."""
    rows = await db.execute(
        select(ChampionshipWinner, Championship, User.full_name)
        .join(Championship, Championship.id == ChampionshipWinner.championship_id)
        .join(User, User.id == ChampionshipWinner.user_id, isouter=True)
        .where(Championship.status == "finished")
        .order_by(Championship.number.desc(), ChampionshipWinner.rank.asc())
    )
    out: list[WinnerRow] = []
    for winner, champ, full_name in rows.all():
        out.append(
            WinnerRow(
                championship_number=champ.number,
                season_type=champ.season_type,
                rank=winner.rank,
                prize=winner.prize,
                name=winner.published_name or _abbrev(full_name),
            )
        )
    return out


def _entry_out(entry: ChampionshipEntry) -> MyEntryOut:
    return MyEntryOut(
        enrolled=True,
        status=entry.status,
        score=entry.score,
        criteria=entry.metrics or {},
    )


async def _fetch_entry(
    db: AsyncSession, championship_id, user_id
) -> ChampionshipEntry | None:
    row = await db.execute(
        select(ChampionshipEntry).where(
            ChampionshipEntry.championship_id == championship_id,
            ChampionshipEntry.user_id == user_id,
        )
    )
    return row.scalar_one_or_none()


async def _get_or_create_entry(
    db: AsyncSession, championship_id, user_id
) -> ChampionshipEntry:
    """Idempotent + race-safe. Two concurrent enrolls hit UNIQUE(championship,
    user); the loser catches IntegrityError, rolls back and re-reads the row the
    winner inserted — never a 500 (CLAUDE.md §4.1)."""
    entry = await _fetch_entry(db, championship_id, user_id)
    if entry is not None:
        return entry
    entry = ChampionshipEntry(
        championship_id=championship_id,
        user_id=user_id,
        status="enrolled",
        metrics=None,
    )
    db.add(entry)
    try:
        await db.commit()
        await db.refresh(entry)
    except IntegrityError:
        await db.rollback()
        entry = await _fetch_entry(db, championship_id, user_id)
        if entry is None:  # pragma: no cover — UNIQUE guaranteed it exists
            raise
    return entry


@router.post("/championship/enroll", response_model=MyEntryOut)
async def enroll(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    champ = await _current_championship(db)
    if champ is None or champ.status not in ("active", "upcoming"):
        raise HTTPException(status_code=409, detail="Приём заявок сейчас закрыт")

    entry = await _get_or_create_entry(db, champ.id, user.id)
    # Recompute real qualification signals → may promote enrolled→qualified.
    await recompute_entry(db, entry, user)
    return _entry_out(entry)


@router.get("/championship/me", response_model=MyEntryOut)
async def my_entry(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    champ = await _current_championship(db)
    if champ is None:
        return MyEntryOut(enrolled=False, criteria=await compute_metrics(db, user))
    entry = await _fetch_entry(db, champ.id, user.id)
    if entry is None:
        return MyEntryOut(enrolled=False, criteria=await compute_metrics(db, user))
    # Lazy recompute so the user sees live progress against the conditions.
    await recompute_entry(db, entry, user)
    return _entry_out(entry)


# ──────────────────────── operator: recompute + draw ────────────────────────

class DrawWinnerIn(BaseModel):
    user_id: uuid.UUID
    rank: int


class DrawIn(BaseModel):
    # Explicit ordered result of the external randomizer (random.org Third-Party
    # Draw): rank→user. The fixation (video/verification) happens off-platform;
    # we record the verification reference and persist the result.
    winners: list[DrawWinnerIn] | None = None
    # Fallback for winner_mode='ranking': pick top-N qualified by score.
    auto_rank: bool = False
    # Public verification URL / code from random.org (legal fixation reference).
    random_org_verification: str | None = None
    # Set the season status to 'finished' after recording winners.
    finalize: bool = True


@router.post("/championship/{championship_id}/recompute")
async def recompute_pool(
    championship_id: uuid.UUID,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Operator: refresh the qualification pool from live signals."""
    qualified = await recompute_championship(db, championship_id)
    return {"qualified_count": qualified}


@router.post("/championship/{championship_id}/draw", response_model=list[WinnerRow])
async def conduct_draw(
    championship_id: uuid.UUID,
    payload: DrawIn,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Operator-only: record the draw result among **qualified** participants.

    Randomness comes from an external verifiable service (random.org); this
    endpoint validates the result against the qualified pool and the prize fund
    and persists ``championship_winners`` (rank→prize). For winner_mode='ranking'
    pass ``auto_rank=true`` to take the top-N by score instead.
    """
    champ = (
        await db.execute(select(Championship).where(Championship.id == championship_id))
    ).scalar_one_or_none()
    if champ is None:
        raise HTTPException(status_code=404, detail="Чемпионат не найден")
    if champ.status not in ("tallying", "finished"):
        raise HTTPException(
            status_code=409,
            detail="Розыгрыш доступен только в фазе подсчёта (tallying) или после неё",
        )

    existing = await db.execute(
        select(func.count(ChampionshipWinner.id)).where(
            ChampionshipWinner.championship_id == champ.id
        )
    )
    if int(existing.scalar() or 0) > 0:
        raise HTTPException(status_code=409, detail="Розыгрыш уже проведён")

    prizes = champ.prize_fund or []
    if not prizes:
        raise HTTPException(status_code=409, detail="Призовой фонд пуст")
    prize_by_rank = {int(p["rank"]): str(p["name"]) for p in prizes}

    # Fresh qualification snapshot before drawing.
    await recompute_championship(db, champ.id)
    pool_rows = await db.execute(
        select(ChampionshipEntry, User.full_name)
        .join(User, User.id == ChampionshipEntry.user_id)
        .where(
            ChampionshipEntry.championship_id == champ.id,
            ChampionshipEntry.status == "qualified",
        )
        .order_by(ChampionshipEntry.score.desc(), ChampionshipEntry.created_at.asc())
    )
    pool = pool_rows.all()
    name_by_user = {entry.user_id: full_name for entry, full_name in pool}
    qualified_ids = list(name_by_user.keys())
    if not qualified_ids:
        raise HTTPException(status_code=409, detail="Нет квалифицированных участников")

    # Audit #17: a championship declared as a "draw" (winner_mode="draw", as
    # required for a стимулирующее мероприятие / ст.9 ФЗ-38) must NOT be settled
    # by auto-ranking — that would silently turn a lottery into a leaderboard
    # and break the legal basis. Reject the mismatch instead of guessing.
    if champ.winner_mode == "draw" and payload.auto_rank:
        raise HTTPException(
            status_code=422,
            detail="Чемпионат в режиме розыгрыша (draw) — auto_rank недопустим; "
                   "передайте результат рандомайзера в winners.",
        )

    # Decide the (rank, user_id) pairs.
    use_ranking = payload.auto_rank or (champ.winner_mode == "ranking" and not payload.winners)
    if use_ranking:
        chosen = [entry.user_id for entry, _ in pool][: len(prize_by_rank)]
        pairs = list(enumerate(chosen, start=1))  # already score-ordered
    else:
        if not payload.winners:
            raise HTTPException(
                status_code=422,
                detail="Нужен список победителей (результат рандомайзера) или auto_rank=true",
            )
        pairs = [(w.rank, w.user_id) for w in payload.winners]

    # Validate ranks + membership.
    ranks = [r for r, _ in pairs]
    users = [u for _, u in pairs]
    if len(set(ranks)) != len(ranks):
        raise HTTPException(status_code=422, detail="Ранги победителей не уникальны")
    if len(set(users)) != len(users):
        raise HTTPException(status_code=422, detail="Один участник не может занять два места")
    for r in ranks:
        if r not in prize_by_rank:
            raise HTTPException(status_code=422, detail=f"Нет приза для ранга {r}")
    for u in users:
        if u not in name_by_user:
            raise HTTPException(
                status_code=422, detail="Победитель отсутствует в пуле квалифицированных"
            )

    for rank, user_id in pairs:
        db.add(
            ChampionshipWinner(
                championship_id=champ.id,
                user_id=user_id,
                rank=rank,
                prize=prize_by_rank[rank],
                published_name=None,
                publish_consent=False,
            )
        )
    # Provenance: сохраняем верификацию рандомайзера (RANDOM.ORG живёт
    # off-platform — тут ссылка на его результат) и момент проведения — чтобы
    # честность розыгрыша была доказуема «по нажатию», а не только в логе.
    champ.draw_verification = payload.random_org_verification
    champ.drawn_at = datetime.now(timezone.utc)
    if payload.finalize:
        champ.status = "finished"
    # TOCTOU: guard «розыгрыш уже проведён» (выше) читает счётчик ДО коммита,
    # поэтому два одновременных admin-draw могут оба пройти его. Уникальный
    # ключ (championship_id, rank) на championship_winners ловит гонку на
    # коммите — отдаём чистый 409 вместо 500 (паттерн как в enroll).
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Розыгрыш уже проведён")

    logger.info(
        "championship %s draw recorded: %d winners, mode=%s, verification=%s",
        champ.number,
        len(pairs),
        "ranking" if use_ranking else "draw",
        payload.random_org_verification or "—",
    )

    return [
        WinnerRow(
            championship_number=champ.number,
            season_type=champ.season_type,
            rank=rank,
            prize=prize_by_rank[rank],
            name=_abbrev(name_by_user[user_id]),
        )
        for rank, user_id in sorted(pairs)
    ]
