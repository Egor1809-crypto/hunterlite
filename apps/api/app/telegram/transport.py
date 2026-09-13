"""Bounded retries for bot replies; polling retains aiogram's own backoff.

Retry only the HTTP request, never the command handler or its database writes.
Telegram may have accepted a reply before a response was lost, so a transient
network failure can produce a duplicate message, but never a second grant.
"""

import asyncio
import logging

from aiogram.client.session.middlewares.base import BaseRequestMiddleware
from aiogram.exceptions import TelegramNetworkError, TelegramServerError
from aiogram.methods import GetUpdates

logger = logging.getLogger(__name__)


class RetryTransientRequests(BaseRequestMiddleware):
    async def __call__(self, make_request, bot, method):
        if isinstance(method, GetUpdates):
            return await make_request(bot, method)
        for attempt in range(3):
            try:
                return await make_request(bot, method)
            except (TelegramNetworkError, TelegramServerError):
                if attempt == 2:
                    raise
                logger.warning(
                    "Telegram %s temporarily unavailable; retry %d/2",
                    type(method).__name__,
                    attempt + 1,
                )
                await asyncio.sleep(0.5 * 2**attempt)
