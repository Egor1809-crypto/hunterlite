import logging
from aiogram import Bot, Dispatcher, Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
)
from aiogram.enums import ParseMode
from app.config import settings

logger = logging.getLogger(__name__)

router = Router()

WEBAPP_URL = settings.frontend_url


def _is_https() -> bool:
    """WebApp buttons require HTTPS. Fall back to regular URL buttons in dev."""
    return WEBAPP_URL.startswith("https://")


def _web_button(text: str, path: str) -> InlineKeyboardButton:
    """Create a button — WebApp if HTTPS, otherwise a regular URL link."""
    url = f"{WEBAPP_URL}{path}"
    if _is_https():
        return InlineKeyboardButton(text=text, web_app=WebAppInfo(url=url))
    return InlineKeyboardButton(text=text, url=url)


def _main_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [_web_button("🎯 Обучение", "/training")],
        [_web_button("📚 Кейсы", "/cases")],
        [_web_button("🎓 Экзамен", "/exam")],
        [_web_button("📖 База знаний", "/knowledge")],
        [InlineKeyboardButton(
            text="🌐 Открыть платформу",
            url=WEBAPP_URL,
        )],
    ])


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    user_name = message.from_user.first_name if message.from_user else "Коллега"
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
        "/help — Список команд",
        parse_mode=ParseMode.HTML,
    )


@router.message(Command("train"))
async def cmd_train(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [_web_button("💬 Текстовая тренировка", "/training")],
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


@router.message(F.text)
async def fallback_text(message: Message) -> None:
    await message.answer(
        "Используйте команды или кнопки меню.\n"
        "Нажмите /start для главного меню.",
        reply_markup=_main_keyboard(),
    )


def create_bot() -> Bot:
    return Bot(token=settings.telegram_bot_token)


def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.include_router(router)
    return dp
