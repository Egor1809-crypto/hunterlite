import logging

from aiogram.types import Update
from fastapi import APIRouter, Request, Response

from app.telegram.bot import create_bot, create_dispatcher

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["telegram"])

_bot = None
_dp = None


async def setup_webhook(base_url: str) -> None:
    global _bot, _dp
    from app.config import settings

    if not settings.telegram_bot_token:
        logger.info("Telegram bot token not set — skipping webhook setup")
        return

    _bot = create_bot()
    _dp = create_dispatcher()

    webhook_url = f"{base_url}/api/telegram/webhook"
    await _bot.set_webhook(webhook_url, drop_pending_updates=True)
    logger.info("Telegram webhook set: %s", webhook_url)


async def shutdown_bot() -> None:
    global _bot
    if _bot:
        await _bot.delete_webhook()
        await _bot.session.close()
        logger.info("Telegram bot shutdown complete")


@router.post("/webhook")
async def telegram_webhook(request: Request) -> Response:
    if not _bot or not _dp:
        return Response(status_code=200)

    update_data = await request.json()
    update = Update.model_validate(update_data, context={"bot": _bot})
    await _dp.feed_update(bot=_bot, update=update)
    return Response(status_code=200)
