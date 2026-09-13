#!/usr/bin/env python3
"""Run the Telegram bot in long-polling mode (including polling deployments).

Use one consumer per token; pending commands survive a process restart.
"""
import asyncio
import logging
import sys
import os

# Ensure the apps/api package is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.telegram.bot import create_bot, create_dispatcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("bot_polling")


async def main() -> None:
    if not settings.telegram_bot_token:
        logger.error("TELEGRAM_BOT_TOKEN is not set in .env — cannot start bot")
        sys.exit(1)

    bot = create_bot()
    dp = create_dispatcher()

    # Delete any existing webhook so polling works
    await bot.delete_webhook(drop_pending_updates=False)
    logger.info("Webhook deleted. Starting long-polling...")

    me = await bot.get_me()
    logger.info("Bot started: @%s (%s)", me.username, me.full_name)

    try:
        await dp.start_polling(
            bot, polling_timeout=25,
            allowed_updates=dp.resolve_used_update_types(),
            tasks_concurrency_limit=32,
        )
    finally:
        await bot.session.close()
        logger.info("Bot stopped.")


if __name__ == "__main__":
    asyncio.run(main())
