from datetime import UTC, datetime

import pytest

from app.models.training_map import TrainingMapProgress
from app.models.user import User
from app.services import daily_attempts as wallet
from app.services import telegram_attempts as telegram


@pytest.mark.asyncio
async def test_purchase_link_does_not_grant_and_is_single_use(db_session, user_factory):
    user = User(**user_factory())
    db_session.add(user)
    await db_session.commit()
    link = await telegram.create_buy_deeplink(db_session, user=user, level=4, pack=50)
    token = link.split("buy_", 1)[1]
    result = await telegram.redeem_token(db_session, token=token, telegram_id="12345")
    assert result["ok"] and result["pack"] == 10
    assert result["checkout_available"] is False
    assert (await wallet.balance(db_session, user.id))["paid_remaining"] == 0
    assert await telegram.redeem_token(db_session, token=token, telegram_id="12345") == {
        "ok": False,
        "error": "used",
    }


@pytest.mark.asyncio
async def test_paid_package_shared_and_idempotent(db_session, user_factory):
    user = User(**user_factory())
    db_session.add(user)
    await db_session.commit()
    row = await wallet.locked_wallet(db_session, user.id)
    row.free_remaining = 0
    for _ in range(2):
        await wallet.confirm_payment(
            db_session,
            user_id=user.id,
            provider_reference="test:paid-1",
            amount_kopecks=149900,
            currency="RUB",
        )
    assert row.paid_remaining == 10
    await wallet.consume(db_session, user.id, 1)
    await wallet.consume(db_session, user.id, 80)
    assert row.paid_remaining == 8
    await db_session.commit()
    assert (await wallet.balance(db_session, user.id))["paid_remaining"] == 8


@pytest.mark.asyncio
async def test_forged_map_bonus_does_not_create_credits(db_session, user_factory):
    user = User(**user_factory())
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        TrainingMapProgress(
            user_id=user.id,
            test_map=[{"level": 1, "bonusAttempts": 99999}],
            energy={},
            cases={},
            exams={},
        )
    )
    await db_session.commit()
    row = await wallet.locked_wallet(db_session, user.id)
    assert row.paid_remaining == 0
    with pytest.raises(ValueError):
        await wallet.confirm_payment(
            db_session, user_id=user.id, provider_reference="bad", amount_kopecks=1, currency="RUB"
        )


@pytest.mark.asyncio
async def test_new_moscow_day_does_not_roll_over_paid_credits(db_session, user_factory):
    user = User(**user_factory())
    db_session.add(user)
    await db_session.commit()
    before = datetime(2026, 9, 13, 20, 59, 59, tzinfo=UTC)
    after = datetime(2026, 9, 13, 21, 0, tzinfo=UTC)
    await wallet.confirm_payment(
        db_session,
        user_id=user.id,
        provider_reference="midnight",
        amount_kopecks=149900,
        currency="RUB",
        now=before,
    )
    previous = await wallet.locked_wallet(db_session, user.id, before)
    current = await wallet.locked_wallet(db_session, user.id, after)
    assert previous.paid_remaining == 10 and current.paid_remaining == 0
    assert wallet.moscow_day(after).isoformat() == "2026-09-14"
    assert wallet.expires_at(previous.day).isoformat() == "2026-09-14T00:00:00+03:00"
