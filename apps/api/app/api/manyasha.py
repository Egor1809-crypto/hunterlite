from __future__ import annotations

import openai
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/manyasha", tags=["manyasha"])


class ChatRequest(BaseModel):
    message: str
    history: list[dict] | None = None  # [{"role": "user"/"assistant", "content": "..."}]


class ChatResponse(BaseModel):
    reply: str
    model: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = openai.AsyncOpenAI(
        base_url=settings.local_llm_url,
        api_key=settings.local_llm_api_key,
    )
    model = getattr(settings, "knowledge_ai_model", "deepseek-v4-pro")

    messages = [
        {
            "role": "system",
            "content": (
                "Ты — Маняша, AI-помощник платформы HunterLite для обучения менеджеров по банкротству.\n\n"
                "Твой характер: дружелюбная, умная, с чувством юмора. Обращайся на \"ты\". "
                "Используй эмодзи умеренно.\n\n"
                "Ты помогаешь пользователю:\n"
                "- Разобраться с платформой (как пройти тест, где найти кейс, как работает экзамен)\n"
                "- Объяснить юридические термины (ФЗ-127, банкротство, субсидиарная ответственность)\n"
                "- Мотивировать учиться (\"давай пройдём ещё один уровень!\")\n"
                "- Подсказать следующий шаг в обучении\n\n"
                "Будь краткой (2-4 предложения). Если вопрос сложный — отвечай подробнее, но структурированно."
            ),
        },
    ]

    if body.history:
        messages.extend(body.history[-10:])  # last 10 messages for context

    messages.append({"role": "user", "content": body.message})

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=512,
        temperature=0.7,
    )

    return ChatResponse(
        reply=response.choices[0].message.content,
        model=model,
    )
