import logging
from html import escape
from aiogram import Bot, Dispatcher, Router, F
from aiogram.filters import CommandStart, Command, CommandObject
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)
from aiogram.enums import ParseMode
from app.config import settings
from app.database import async_session
from app.services import telegram_attempts

logger = logging.getLogger(__name__)

router = Router()

WEBAPP_URL = settings.frontend_url


def _web_button(text: str, path: str) -> InlineKeyboardButton:
    # Account linking is not Telegram WebApp authentication. Ordinary links
    # open the platform's supported browser login/session flow.
    return InlineKeyboardButton(text=text, url=f"{WEBAPP_URL.rstrip('/')}{path}")


def _main_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [_web_button("🎯 Тесты", "/training?tab=tests")],
        [InlineKeyboardButton(text="10 попыток · 1 499 ₽", callback_data="daily_attempts")],
        [_web_button("📚 Кейсы", "/cases")],
        [_web_button("🎓 Экзамен", "/exam")],
        [_web_button("📖 База знаний", "/knowledge")],
        [InlineKeyboardButton(
            text="🌐 Открыть платформу",
            url=WEBAPP_URL,
        )],
    ])


async def _handle_deeplink(message: Message, arg: str) -> bool:
    """Process a ``/start buy_<token>`` / ``link_<token>`` deeplink.

    Returns True if the arg was a recognised deeplink (handled here), False
    otherwise so the caller can show the normal welcome.
    """
    if not (arg.startswith("buy_") or arg.startswith("link_")):
        return False

    token = arg.split("_", 1)[1]
    tg_id = str(message.from_user.id) if message.from_user else ""

    async with async_session() as db:
        result = await telegram_attempts.redeem_token(db, token=token, telegram_id=tg_id)

    if not result.get("ok"):
        err = result.get("error")
        text = {
            "not_found": "Ссылка не найдена. Сгенерируйте новую на платформе.",
            "used": "Эта ссылка уже использована. Сгенерируйте новую на платформе.",
            "expired": "Срок действия ссылки истёк. Сгенерируйте новую на платформе.",
            "account_linked": "Аккаунт платформы уже привязан к другому Telegram. Обратитесь в поддержку для смены привязки.",
            "tg_taken": "Этот Telegram уже привязан к другому аккаунту платформы.",
            "user_gone": "Аккаунт не найден. Попробуйте ещё раз с платформы.",
        }.get(err, "Не удалось обработать ссылку. Попробуйте ещё раз.")
        await message.answer(f"⚠️ {text}", parse_mode=ParseMode.HTML, reply_markup=_main_keyboard())
        return True

    linked_line = "🔗 Telegram привязан к вашему аккаунту.\n\n" if result.get("linked") else ""

    if result.get("purpose") == "buy":
        await message.answer(
            f"{linked_line}" + _offer_text(),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[_web_button("Вернуться к тестам", "/training?tab=tests")]]),
        )
    else:
        await message.answer(
            f"{linked_line}"
            "✅ <b>Аккаунт привязан</b>\n\n"
            "Ваша привязка сохранена. Проверить прогресс — /status. Узнать о пакете попыток — /buy.",
            parse_mode=ParseMode.HTML,
            reply_markup=_main_keyboard(),
        )
    return True


@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject) -> None:
    arg = (command.args or "").strip()
    if arg and await _handle_deeplink(message, arg):
        return

    user_name = escape(message.from_user.first_name if message.from_user else "Коллега")
    await message.answer(
        f"<b>Добро пожаловать, {user_name}!</b>\n\n"
        "🏛 <b>LegalHunter</b> — учебная платформа для арбитражных управляющих\n\n"
        "📋 <b>Что внутри:</b>\n"
        "• AI-тренировки с реалистичными должниками\n"
        "• Интерактивные кейсы из практики\n"
        "• Экзамены с сертификацией (24 ак. часа ПК)\n"
        "• База знаний по ФЗ-127\n\n"
        "Выберите раздел:",
        parse_mode=ParseMode.HTML,
        reply_markup=_main_keyboard(),
    )


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        "<b>📋 Команды:</b>\n\n"
        "/start — Главное меню\n"
        "/train — Обучение и тренировки\n"
        "/cases — Интерактивные кейсы\n"
        "/exam — Экзамен и сертификация\n"
        "/knowledge — База знаний ФЗ-127\n"
        "/status — Мой прогресс и энергия\n"
        "/buy — 10 общих попыток на день\n"
        "/help — Список команд",
        parse_mode=ParseMode.HTML,
    )


@router.message(Command("train"))
async def cmd_train(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [_web_button("💬 Тренировка с клиентом", "/training?tab=builder")],
        [_web_button("🎯 Тесты по ФЗ-127", "/training?tab=tests")],
    ])
    await message.answer(
        "<b>🎯 Обучение</b>\n\n"
        "AI-тренировки с реалистичными клиентами.\n"
        "Каждая сессия — практика переговоров + ак. часы ПК.",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )


@router.message(Command("cases"))
async def cmd_cases(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [_web_button("📚 Открыть кейсы", "/cases")],
    ])
    await message.answer(
        "<b>📚 Интерактивные кейсы</b>\n\n"
        "Реальные ситуации из арбитражной практики.\n"
        "Ветвящиеся сценарии — каждое решение меняет исход.",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )


@router.message(Command("exam"))
async def cmd_exam(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [_web_button("🎓 Начать экзамен", "/exam")],
    ])
    await message.answer(
        "<b>🎓 Экзамен и сертификация</b>\n\n"
        "8 модулей аттестации под AI-прокторингом.\n"
        "Сертификат с QR-верификацией — 24 ак. часа ПК.",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )


@router.message(Command("knowledge"))
async def cmd_knowledge(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [_web_button("📖 Открыть базу знаний", "/knowledge")],
    ])
    await message.answer(
        "<b>📖 База знаний</b>\n\n"
        "ФЗ-127, судебная практика, AI-помощник.\n"
        "Законодательный радар с актуальными изменениями.",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )


@router.message(Command("arena"))
async def cmd_arena(message: Message) -> None:
    """Legacy command — redirect to exam."""
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [_web_button("🎓 Перейти к экзаменам", "/exam")],
    ])
    await message.answer(
        "<b>Арена переименована в Экзамен</b>\n\n"
        "Проверьте свои знания в модулях аттестации!",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )


@router.message(Command("profile"))
async def cmd_profile(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [_web_button("👤 Мой профиль", "/home")],
        [_web_button("📊 История", "/history")],
    ])
    await message.answer(
        "<b>👤 Профиль</b>\n\n"
        "Статистика, прогресс, история тренировок.",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )


@router.message(Command("status"))
async def cmd_status(message: Message) -> None:
    tg_id = str(message.from_user.id) if message.from_user else ""
    async with async_session() as db:
        summary = await telegram_attempts.get_progress_summary(db, telegram_id=tg_id)

    if summary is None:
        await message.answer(
            "<b>📊 Статус</b>\n\n"
            "Ваш Telegram ещё не привязан к аккаунту платформы.\n"
            "Откройте платформу и нажмите «Привязать Telegram», "
            "чтобы я мог показывать прогресс и начислять попытки.",
            parse_mode=ParseMode.HTML,
            reply_markup=_main_keyboard(),
        )
        return

    name = escape(summary.get("user_name") or "Коллега")
    completed = summary.get("completed", 0)
    total = summary.get("total", 100)
    energy = summary.get("energy_remaining")
    energy_line = (
        f"⚡️ Энергия сегодня: <b>{energy}</b>\n"
        if energy is not None
        else "⚡️ Энергия сегодня: ещё не тратилась\n"
    )
    await message.answer(
        f"<b>📊 Статус — {name}</b>\n\n"
        f"✅ Пройдено уровней: <b>{completed}</b> из {total}\n"
        f"Бесплатных попыток: <b>{summary['attempts']['free_remaining']}</b>\n"
        f"Общих дополнительных попыток: <b>{summary['attempts']['paid_remaining']}</b>\n"
        "Обновление дня — 00:00 по Москве.\n\n"
        "Продолжайте тренировку, чтобы открыть новые уровни.",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [_web_button("▶️ Продолжить тренировку", "/training?tab=tests")],
            [_web_button("📊 Полная история", "/history")],
        ]),
    )


async def notify_user(bot: Bot, telegram_id: str, text: str) -> bool:
    """Send a notification to a linked Telegram account.

    Returns True if delivered, False if Telegram rejected it (e.g. the user
    blocked the bot or never started a chat). Callers should treat False as
    "not reachable", not as a hard error.
    """
    try:
        await bot.send_message(
            chat_id=str(telegram_id),
            text=text,
            parse_mode=ParseMode.HTML,
        )
        return True
    except Exception:
        logger.warning("Failed to deliver Telegram notification to %s", telegram_id)
        return False


def _offer_text() -> str:
    return ("<b>10 попыток · 1 499 ₽</b>\n\n"
            "Общий пакет для всех тестов. Действует до 00:00 по Москве в день оплаты.\n\n"
            "Покупка пока недоступна: приём платежей ещё не подключён. "
            "Деньги не списываются, дополнительные попытки не начисляются.")

@router.message(Command("buy"))
async def cmd_buy(message: Message) -> None:
    await message.answer(_offer_text(), parse_mode=ParseMode.HTML, reply_markup=_main_keyboard())

@router.callback_query(F.data == "daily_attempts")
async def daily_attempts_callback(callback) -> None:
    await callback.answer()
    if callback.message:
        await callback.message.answer(_offer_text(), parse_mode=ParseMode.HTML, reply_markup=_main_keyboard())

@router.message(F.text)
async def fallback_text(message: Message) -> None:
    await message.answer(
        "Используйте команды или кнопки меню.\n"
        "Нажмите /start для главного меню.",
        reply_markup=_main_keyboard(),
    )


def create_bot() -> Bot:
    # Route the bot's outbound Telegram API traffic through a proxy when set —
    # required where the host can't reach api.telegram.org directly (RU
    # datacenters block it). Without it, set_webhook and every sendMessage
    # time out. http(s):// proxies work via aiohttp natively; socks5:// needs
    # the aiohttp_socks extra (declared in pyproject).
    proxy = (settings.telegram_proxy or "").strip()
    if proxy:
        from aiogram.client.session.aiohttp import AiohttpSession
        session = AiohttpSession(proxy=proxy)
        return Bot(token=settings.telegram_bot_token, session=session)
    return Bot(token=settings.telegram_bot_token)


def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.include_router(router)
    return dp
