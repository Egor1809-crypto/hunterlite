"""Championship season FSM + date formulas.

Two seasons per year, sequential championship numbering
(docs/contest/CHAMPIONSHIP_PLAN.md §2 / §5.2):

  * ``summer_autumn`` — starts **1 June**, ends **30 November** (23:59:59);
    tally week = the **last 7 days** of November (24–30).
  * ``winter_spring`` — starts **1 December** of year Y, ends **31 May** of
    Y+1; tally week = the **last 7 days** of May (25–31 of Y+1).

The "last 7 days of the final month" rule is deterministic and matches the
seeded season #1 (tally 24 Nov → 30 Nov), avoiding any "last full week"
weekday ambiguity.

State machine (by date): ``upcoming`` → ``active`` → ``tallying`` → ``finished``.
``advance_season_states`` reconciles the latest season's status with ``now`` and,
once it is finished, creates the next ``upcoming`` season (race-safe on the
UNIQUE championship number).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.championship import Championship

SEASON_SUMMER_AUTUMN = "summer_autumn"
SEASON_WINTER_SPRING = "winter_spring"


def season_dates(start_year: int, season_type: str) -> tuple[datetime, datetime, datetime]:
    """(starts_at, tally_starts_at, ends_at) for a season, identified by the
    calendar year of its **start**. UTC, timezone-aware."""
    if season_type == SEASON_SUMMER_AUTUMN:
        starts = datetime(start_year, 6, 1, tzinfo=timezone.utc)
        ends = datetime(start_year, 11, 30, 23, 59, 59, tzinfo=timezone.utc)
        tally = datetime(start_year, 11, 24, tzinfo=timezone.utc)  # 30 − 6
    elif season_type == SEASON_WINTER_SPRING:
        starts = datetime(start_year, 12, 1, tzinfo=timezone.utc)
        ends = datetime(start_year + 1, 5, 31, 23, 59, 59, tzinfo=timezone.utc)
        tally = datetime(start_year + 1, 5, 25, tzinfo=timezone.utc)  # 31 − 6
    else:  # pragma: no cover — guarded by callers
        raise ValueError(f"unknown season_type: {season_type!r}")
    return starts, tally, ends


def season_title(start_year: int, season_type: str) -> str:
    if season_type == SEASON_SUMMER_AUTUMN:
        return f"Чемпионат сезона · Лето–Осень {start_year}"
    return f"Чемпионат сезона · Зима–Весна {start_year}/{start_year + 1}"


def next_season(start_year: int, season_type: str) -> tuple[int, str]:
    """The season that follows: summer→winter same year, winter→summer next year."""
    if season_type == SEASON_SUMMER_AUTUMN:
        return start_year, SEASON_WINTER_SPRING
    return start_year + 1, SEASON_SUMMER_AUTUMN


def _aware(dt: datetime) -> datetime:
    """Treat a tz-naive datetime as UTC. Postgres (timezone=True) returns aware
    datetimes; SQLite (tests) returns naive — normalize so comparisons never
    raise 'offset-naive vs offset-aware'."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def status_for(champ: Championship, now: datetime) -> str:
    """The status a season *should* have at ``now`` purely by its dates."""
    return status_for_dates(
        _aware(champ.starts_at), _aware(champ.tally_starts_at), _aware(champ.ends_at), now
    )


def _start_year_of(champ: Championship) -> int:
    return champ.starts_at.year


async def advance_season_states(db: AsyncSession, now: datetime | None = None) -> dict:
    """Reconcile the latest season's status with the calendar and, once it is
    finished, spawn the next upcoming season. Idempotent and race-safe.

    Returns a small report dict (what changed) for logging/tests.
    """
    now = now or datetime.now(timezone.utc)
    report: dict = {"status_changed": None, "created": None}

    latest = (
        await db.execute(
            select(Championship).order_by(Championship.number.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if latest is None:
        return report

    # 1. Advance the latest season's status to match the calendar.
    target = status_for(latest, now)
    if latest.status != target:
        report["status_changed"] = {"number": latest.number, "from": latest.status, "to": target}
        latest.status = target
        await db.commit()
        await db.refresh(latest)

    # 2. When the latest is finished, ensure the next season exists.
    if latest.status == "finished":
        ny, ntype = next_season(_start_year_of(latest), latest.season_type)
        starts, tally, ends = season_dates(ny, ntype)
        new = Championship(
            number=latest.number + 1,
            season_type=ntype,
            title=season_title(ny, ntype),
            starts_at=starts,
            tally_starts_at=tally,
            ends_at=ends,
            status=status_for_dates(starts, tally, ends, now),
            winner_mode=latest.winner_mode,
            prize_fund=latest.prize_fund,
        )
        db.add(new)
        try:
            await db.commit()
            await db.refresh(new)
            report["created"] = {"number": new.number, "season_type": ntype, "status": new.status}
        except IntegrityError:
            # Another worker already created it — fine.
            await db.rollback()

    return report


def status_for_dates(
    starts_at: datetime, tally_starts_at: datetime, ends_at: datetime, now: datetime
) -> str:
    if now < starts_at:
        return "upcoming"
    if now < tally_starts_at:
        return "active"
    if now < ends_at:
        return "tallying"
    return "finished"
