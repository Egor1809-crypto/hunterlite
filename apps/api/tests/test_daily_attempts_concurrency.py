"""Transactional wallet tests; requires a migrated disposable PostgreSQL DB."""

import asyncio
import os
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.user import User
from app.services import daily_attempts as wallet


@pytest.mark.asyncio
async def test_concurrent_grants_and_spends_are_exactly_once():
    url = os.getenv("TEST_POSTGRES_URL")
    if not url:
        pytest.skip("TEST_POSTGRES_URL must name a disposable migrated database")
    engine = create_async_engine(url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    uid = uuid.uuid4()
    try:
        async with sessions() as db:
            db.add(
                User(
                    id=uid,
                    email=f"wallet-qa-{uid}@hunterlite.test",
                    full_name="Wallet concurrency test",
                    hashed_password="unused",
                    role="manager",
                    is_active=True,
                )
            )
            await db.commit()

        async def grant():
            async with sessions() as db:
                granted = await wallet.confirm_payment(
                    db,
                    user_id=uid,
                    provider_reference=f"qa:{uid}",
                    amount_kopecks=149900,
                    currency="RUB",
                )
                await db.commit()
                return granted

        assert sum(await asyncio.gather(*(grant() for _ in range(8)))) == 1
        async with sessions() as db:
            row = await wallet.locked_wallet(db, uid)
            row.free_remaining = 0
            await db.commit()

        async def spend(level):
            async with sessions() as db:
                try:
                    await wallet.consume(db, uid, level)
                    await db.commit()
                    return True
                except HTTPException as exc:
                    assert exc.status_code == 409
                    return False

        assert sum(await asyncio.gather(*(spend(i + 1) for i in range(15)))) == 10
        async with sessions() as db:
            balance = await wallet.balance(db, uid)
            assert balance["paid_remaining"] == 0
            assert sum(balance["level_uses"].values()) == 10
    finally:
        async with sessions() as db:
            await db.execute(delete(User).where(User.id == uid))
            await db.commit()
        await engine.dispose()
