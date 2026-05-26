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


def _main_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="Начать тренировку",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/training"),
        )],
        [InlineKeyboardButton(
            text="Арена знаний",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/pvp"),
        )],
        [InlineKeyboardButton(
            text="Мой профиль",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/profile"),
        )],
        [InlineKeyboardButton(
            text="Открыть платформу",
            url=WEBAPP_URL,
        )],
    ])


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    await message.answer(
        "<b>BankrotTrainer</b>\n\n"
        "Бот-тренажёр для менеджеров по банкротству.\n\n"
        "<b>Возможности:</b>\n"
        "- AI-тренировки: звонки и чаты с виртуальными клиентами\n"
        "- Арена знаний: тесты по законодательству о банкротстве\n"
        "- Отслеживание прогресса и статистики\n\n"
        "Выбери действие:",
        parse_mode=ParseMode.HTML,
        reply_markup=_main_keyboard(),
    )


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        "<b>Команды:</b>\n\n"
        "/start - Главное меню\n"
        "/train - Начать тренировку\n"
        "/arena - Арена знаний\n"
        "/profile - Мой профиль\n"
        "/help - Список команд",
        parse_mode=ParseMode.HTML,
    )


@router.message(Command("train"))
async def cmd_train(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="Режим звонка",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/training"),
        )],
        [InlineKeyboardButton(
            text="Режим чата",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/training"),
        )],
    ])
    await message.answer(
        "<b>Тренировка</b>\n\n"
        "Выбери режим тренировки с AI-клиентом:",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )


@router.message(Command("arena"))
async def cmd_arena(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="Открыть арену",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/pvp"),
        )],
    ])
    await message.answer(
        "<b>Арена знаний</b>\n\n"
        "Проверь свои знания по банкротству!\n"
        "Квизы, дуэли, разбор ошибок.",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )


@router.message(Command("profile"))
async def cmd_profile(message: Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="Открыть профиль",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/profile"),
        )],
    ])
    await message.answer(
        "<b>Профиль</b>\n\n"
        "Статистика, достижения, история тренировок.",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )


@router.message(F.text)
async def fallback_text(message: Message) -> None:
    await message.answer(
        "Используй команды или кнопки меню.\n"
        "Нажми /start для главного меню.",
        reply_markup=_main_keyboard(),
    )


def create_bot() -> Bot:
    return Bot(token=settings.telegram_bot_token)


def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.include_router(router)
    return dp
