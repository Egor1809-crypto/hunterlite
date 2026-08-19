"""Signed bridge for the tech-pravo.ru quiz campaign.

This module is intentionally server-to-server only.  It provisions/link users,
keeps the LegalHunter championship as the source of truth, and records a
separate, revocable qualification grant after email confirmation.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from datetime import UTC, datetime

import httpx
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.championship import DrawIn, DrawWinnerIn, conduct_draw
from app.config import settings
from app.core.redis_pool import get_redis
from app.core.security import hash_password
from app.database import get_db
from app.models.championship import (
    Championship,
    ChampionshipEntry,
    ChampionshipExternalGrant,
    ChampionshipWinner,
)
from app.models.subscription import PlanType, UserSubscription
from app.models.user import User, UserConsent
from app.schemas.auth import _check_password_strength
from app.services.championship_qualification import recompute_championship, recompute_entry

router = APIRouter(prefix="/internal/tech-pravo")


def build_bridge_signature(
    secret: str, timestamp: str, nonce: str, method: str, path: str, body: bytes
) -> str:
    canonical = b"\n".join(
        [timestamp.encode(), nonce.encode(), method.upper().encode(), path.encode(), body]
    )
    return hmac.new(secret.encode(), canonical, hashlib.sha256).hexdigest()


async def require_bridge_signature(request: Request) -> None:
    secret = settings.tech_pravo_bridge_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Bridge disabled")
    timestamp = request.headers.get("x-techpravo-timestamp", "")
    nonce = request.headers.get("x-techpravo-nonce", "")
    supplied = request.headers.get("x-techpravo-signature", "")
    if not timestamp.isdigit() or not (16 <= len(nonce) <= 128) or len(supplied) != 64:
        raise HTTPException(status_code=401, detail="Invalid bridge signature")
    if abs(int(time.time()) - int(timestamp)) > settings.tech_pravo_bridge_clock_skew_seconds:
        raise HTTPException(status_code=401, detail="Expired bridge signature")
    body = await request.body()
    expected = build_bridge_signature(
        secret, timestamp, nonce, request.method, request.url.path, body
    )
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="Invalid bridge signature")
    try:
        redis = get_redis()
        accepted = await redis.set(f"bridge:nonce:{nonce}", "1", nx=True, ex=600)
    except aioredis.RedisError as exc:
        raise HTTPException(status_code=503, detail="Bridge replay protection unavailable") from exc
    if not accepted:
        raise HTTPException(status_code=409, detail="Bridge request already used")


class ProvisionIn(BaseModel):
    external_ref: str = Field(min_length=10, max_length=128)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255)
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    audience: str = Field(pattern=r"^(arbitration_manager|lawyer)$")
    quiz_result: str = Field(max_length=64)
    maturity_score: int = Field(ge=0, le=16)
    landing_path: str = Field(max_length=300)
    consent_version: str = Field(max_length=50)
    marketing_consent: bool = False
    championship_number: int = Field(default=1, ge=1)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _check_password_strength(value)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ConfirmIn(BaseModel):
    external_ref: str = Field(min_length=10, max_length=128)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255)
    verified_at: datetime


class ChampionshipRefIn(BaseModel):
    championship_number: int = Field(default=1, ge=1)


async def _championship(db: AsyncSession, number: int) -> Championship:
    championship = (
        await db.execute(select(Championship).where(Championship.number == number))
    ).scalar_one_or_none()
    if championship is None:
        raise HTTPException(status_code=404, detail="Championship not found")
    return championship


@router.post("/provision", dependencies=[Depends(require_bridge_signature)])
async def provision(payload: ProvisionIn, db: AsyncSession = Depends(get_db)):
    championship = await _championship(db, payload.championship_number)
    grant = (
        await db.execute(
            select(ChampionshipExternalGrant).where(
                ChampionshipExternalGrant.source_system == "tech-pravo.ru",
                ChampionshipExternalGrant.external_ref == payload.external_ref,
            )
        )
    ).scalar_one_or_none()
    if grant is not None:
        user = await db.get(User, grant.user_id)
        if user is None or user.email.lower() != payload.email:
            raise HTTPException(status_code=409, detail="External reference conflict")
        return {
            "state": "existing",
            "user_id": str(user.id),
            "grant_status": "confirmed" if grant.confirmed_at else "pending_email",
        }

    user = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    account_state = "existing"
    if user is None:
        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            preferences={"registration_source": "tech-pravo.ru", "audience": payload.audience},
            email_verified=False,
            is_active=False,
        )
        db.add(user)
        await db.flush()
        db.add(
            UserSubscription(
                user_id=user.id,
                plan_type=PlanType.scout.value,
                expires_at=None,
                metadata_json={"source": "tech-pravo.ru", "external_ref": payload.external_ref},
            )
        )
        db.add(
            UserConsent(
                user_id=user.id,
                consent_type="personal_data_processing",
                version=payload.consent_version,
                accepted=True,
            )
        )
        db.add(
            UserConsent(
                user_id=user.id,
                consent_type="marketing_communications",
                version=payload.consent_version,
                accepted=payload.marketing_consent,
            )
        )
        account_state = "created"

    existing_for_user = (
        await db.execute(
            select(ChampionshipExternalGrant).where(
                ChampionshipExternalGrant.championship_id == championship.id,
                ChampionshipExternalGrant.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if existing_for_user is None:
        grant = ChampionshipExternalGrant(
            championship_id=championship.id,
            user_id=user.id,
            source_system="tech-pravo.ru",
            external_ref=payload.external_ref,
            audience=payload.audience,
            quiz_result=payload.quiz_result,
            metadata_json={
                "maturity_score": payload.maturity_score,
                "landing_path": payload.landing_path,
                "account_created": account_state == "created",
            },
        )
        db.add(grant)
    else:
        grant = existing_for_user
        if grant.confirmed_at is None:
            # A repeated form submission by the same person supersedes an
            # unconfirmed token.  Keep the single-user championship invariant
            # while ensuring that the newest tech-pravo verification link can
            # actually confirm the grant.
            grant.external_ref = payload.external_ref
            grant.audience = payload.audience
            grant.quiz_result = payload.quiz_result
            grant.metadata_json = {
                "maturity_score": payload.maturity_score,
                "landing_path": payload.landing_path,
                "account_created": bool((grant.metadata_json or {}).get("account_created")),
            }
        elif grant.external_ref != payload.external_ref:
            raise HTTPException(
                status_code=409,
                detail="This user is already qualified by another submission",
            )
    await db.commit()
    return {
        "state": account_state,
        "user_id": str(user.id),
        "grant_status": "confirmed" if grant.confirmed_at else "pending_email",
    }


@router.post("/confirm", dependencies=[Depends(require_bridge_signature)])
async def confirm(payload: ConfirmIn, db: AsyncSession = Depends(get_db)):
    row = await db.execute(
        select(ChampionshipExternalGrant, User)
        .join(User, User.id == ChampionshipExternalGrant.user_id)
        .where(
            ChampionshipExternalGrant.source_system == "tech-pravo.ru",
            ChampionshipExternalGrant.external_ref == payload.external_ref,
        )
    )
    pair = row.first()
    if pair is None:
        raise HTTPException(status_code=404, detail="Grant not found")
    grant, user = pair
    if user.email.lower() != payload.email.strip().lower():
        raise HTTPException(status_code=409, detail="Email mismatch")
    if grant.revoked_at is not None:
        raise HTTPException(status_code=409, detail="Grant revoked")

    verified_at = payload.verified_at.astimezone(UTC)
    grant.confirmed_at = grant.confirmed_at or verified_at
    user.email_verified = True
    if bool((grant.metadata_json or {}).get("account_created")):
        user.is_active = True
    entry = (
        await db.execute(
            select(ChampionshipEntry).where(
                ChampionshipEntry.championship_id == grant.championship_id,
                ChampionshipEntry.user_id == grant.user_id,
            )
        )
    ).scalar_one_or_none()
    if entry is None:
        entry = ChampionshipEntry(
            championship_id=grant.championship_id,
            user_id=grant.user_id,
            status="enrolled",
            metrics=None,
        )
        db.add(entry)
        await db.flush()
    await recompute_entry(db, entry, user, commit=False)
    await db.commit()
    await db.refresh(entry)
    return {
        "ok": True,
        "user_id": str(user.id),
        "entry_id": str(entry.id),
        "status": entry.status,
    }


@router.post("/championship/snapshot", dependencies=[Depends(require_bridge_signature)])
async def snapshot(payload: ChampionshipRefIn, db: AsyncSession = Depends(get_db)):
    championship = await _championship(db, payload.championship_number)
    rows = await db.execute(
        select(ChampionshipEntry, User, ChampionshipExternalGrant)
        .join(User, User.id == ChampionshipEntry.user_id)
        .outerjoin(
            ChampionshipExternalGrant,
            and_(
                ChampionshipExternalGrant.championship_id == ChampionshipEntry.championship_id,
                ChampionshipExternalGrant.user_id == ChampionshipEntry.user_id,
            ),
        )
        .where(ChampionshipEntry.championship_id == championship.id)
        .order_by(ChampionshipEntry.created_at.asc())
    )
    participants = []
    for entry, user, grant in rows.all():
        participants.append(
            {
                "entry_id": str(entry.id),
                "user_id": str(user.id),
                "name": user.full_name,
                "email": user.email,
                "status": entry.status,
                "score": entry.score,
                "created_at": entry.created_at.isoformat(),
                "source": grant.source_system if grant else "legalhunter.pro",
                "external_ref": grant.external_ref if grant else None,
                "audience": grant.audience if grant else None,
                "quiz_result": grant.quiz_result if grant else None,
                "confirmed_at": (
                    grant.confirmed_at.isoformat() if grant and grant.confirmed_at else None
                ),
            }
        )
    winners_rows = await db.execute(
        select(ChampionshipWinner, User)
        .join(User, User.id == ChampionshipWinner.user_id)
        .where(ChampionshipWinner.championship_id == championship.id)
        .order_by(ChampionshipWinner.rank.asc())
    )
    winners = [
        {
            "rank": winner.rank,
            "prize": winner.prize,
            "user_id": str(user.id),
            "name": user.full_name,
            "email": user.email,
        }
        for winner, user in winners_rows.all()
    ]
    return {
        "championship": {
            "id": str(championship.id),
            "number": championship.number,
            "title": championship.title,
            "status": championship.status,
            "starts_at": championship.starts_at.isoformat(),
            "tally_starts_at": championship.tally_starts_at.isoformat(),
            "ends_at": championship.ends_at.isoformat(),
            "prize_fund": championship.prize_fund or [],
            "draw_verification": championship.draw_verification,
            "drawn_at": championship.drawn_at.isoformat() if championship.drawn_at else None,
        },
        "participants": participants,
        "winners": winners,
    }


@router.post("/championship/draw", dependencies=[Depends(require_bridge_signature)])
async def draw(payload: ChampionshipRefIn, db: AsyncSession = Depends(get_db)):
    championship = await _championship(db, payload.championship_number)
    if championship.status not in ("tallying", "finished"):
        raise HTTPException(status_code=409, detail="Draw is not available before tallying")
    await recompute_championship(db, championship.id)
    await_rows = await db.execute(
        select(ChampionshipEntry.user_id).where(
            ChampionshipEntry.championship_id == championship.id,
            ChampionshipEntry.status == "qualified",
        )
    )
    qualified_ids = sorted((row[0] for row in await_rows.all()), key=str)
    prize_count = min(len(championship.prize_fund or []), len(qualified_ids))
    if prize_count == 0:
        raise HTTPException(status_code=409, detail="No qualified participants")

    url = settings.drand_public_url.rstrip("/") + "/public/latest"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            beacon = response.json()
        randomness = bytes.fromhex(str(beacon["randomness"]))
        round_number = int(beacon["round"])
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Verifiable randomness unavailable") from exc

    ordered = sorted(
        qualified_ids,
        key=lambda user_id: hashlib.sha256(
            randomness + championship.id.bytes + user_id.bytes
        ).digest(),
    )
    winners = [
        DrawWinnerIn(user_id=user_id, rank=index + 1)
        for index, user_id in enumerate(ordered[:prize_count])
    ]
    pool_hash = hashlib.sha256(
        "\n".join(str(value) for value in qualified_ids).encode()
    ).hexdigest()
    proof = (
        f"{settings.drand_public_url.rstrip('/')}/public/{round_number}"
        f";algorithm=sha256-sort-v1;pool_sha256={pool_hash}"
    )
    result = await conduct_draw(
        championship.id,
        DrawIn(winners=winners, random_org_verification=proof, finalize=True),
        _admin=None,  # signature dependency above is the operator authorization
        db=db,
    )
    winner_ids = [winner.user_id for winner in winners]
    winner_users = await db.execute(select(User).where(User.id.in_(winner_ids)))
    email_by_id = {user.id: user.email for user in winner_users.scalars().all()}
    return {
        "proof": proof,
        "round": round_number,
        "winners": [
            {**row.model_dump(), "email": email_by_id.get(winners[index].user_id)}
            for index, row in enumerate(result)
        ],
    }
