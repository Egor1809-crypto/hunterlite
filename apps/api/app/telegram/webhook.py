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

    # Telegram only accepts HTTPS webhook URLs. In local dev the base url
    # resolves to http://localhost:8000, which Telegram rejects — and any
    # set_webhook call here would also fight the polling runner
    # (scripts/run_bot_polling.py). Skip webhook mode unless we have a real
    # public HTTPS endpoint; dev relies on polling instead.
    if not base_url.startswith("https://"):
        logger.info(
            "Telegram webhook base url is not HTTPS (%s) — skipping webhook "
            "setup; use polling in dev",
            base_url,
        )
        return

    _bot = create_bot()
    _dp = create_dispatcher()

    webhook_url = f"{base_url}/api/telegram/webhook"
    # Pass the signature secret so Telegram echoes it back in the
    # X-Telegram-Bot-Api-Secret-Token header on every update; the handler
    # below rejects any request missing it. Without a secret the endpoint is
    # forgeable (account-linking / attempt grants).
    secret = settings.telegram_webhook_secret or None
    try:
        if secret:
            await _bot.set_webhook(
                webhook_url, drop_pending_updates=True, secret_token=secret,
            )
        else:
            logger.warning(
                "Telegram webhook set WITHOUT a signature secret "
                "(TELEGRAM_WEBHOOK_SECRET unset) — the endpoint is "
                "unauthenticated. Set TELEGRAM_WEBHOOK_SECRET in production."
            )
            await _bot.set_webhook(webhook_url, drop_pending_updates=True)
        logger.info("Telegram webhook set: %s", webhook_url)
    except Exception as e:
        # Most common cause: the host cannot reach api.telegram.org (RU
        # datacenters block it). Log a concise, actionable line instead of a
        # multi-frame aiohttp traceback on every startup; the bot stays dark
        # until a reachable TELEGRAM_PROXY is configured.
        logger.warning(
            "Telegram webhook setup failed (%s: %s). The host likely cannot "
            "reach api.telegram.org — set TELEGRAM_PROXY to a reachable "
            "socks5/http proxy. Bot is dark until then.",
            type(e).__name__, str(e)[:160],
        )
        _bot = None
        _dp = None


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

    # Verify the webhook signature (audit CRITICAL #1). When a secret is
    # configured, Telegram sends it back in this header on every update; reject
    # anything that does not match (constant-time compare). Forged updates would
    # otherwise link arbitrary telegram_ids and grant attempts.
    from app.config import settings
    secret = settings.telegram_webhook_secret
    if secret:
        import hmac
        received = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not hmac.compare_digest(received, secret):
            logger.warning("Telegram webhook rejected: bad/missing secret token")
            return Response(status_code=403)

    update_data = await request.json()
    update = Update.model_validate(update_data, context={"bot": _bot})
    await _dp.feed_update(bot=_bot, update=update)
    return Response(status_code=200)
