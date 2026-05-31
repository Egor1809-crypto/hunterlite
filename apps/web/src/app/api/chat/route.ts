/**
 * Пример серверного эндпоинта чата для Next.js (App Router).
 * Положи как:  src/app/api/chat/route.ts
 *
 * Виджет шлёт сюда POST { messages: [{role, content}, ...] }
 * и ожидает в ответ { reply: string }.
 *
 * Ключ провайдера и адрес LLM — только из переменных окружения.
 * НИКОГДА не хардкодь ключ в коде и не коммить .env.
 *
 *   .env.local:
 *     LLM_API_KEY=sk-...
 *     LLM_BASE_URL=https://api.navy/v1      # адрес OpenAI-совместимого API
 *     LLM_MODEL=gpt-4o-mini
 *
 * Это минимальный шаблон без rate-limit. На проде добавь ограничение
 * по IP + глобальный лимит, чтобы не слить бюджет API (как в боевой версии).
 */

import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.LLM_API_KEY;
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.navy/v1";
const MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT =
  [
    "Ты — Маняша, AI-помощник платформы LegalHunter.",
    "Твоя специализация — банкротство физических лиц в России: 127-ФЗ, судебная практика, внесудебное банкротство через МФЦ, реструктуризация долгов, реализация имущества, исполнительные производства, взаимодействие с кредиторами, ФССП, арбитражными управляющими и судами.",
    "Отвечай как высококвалифицированный юрист-практик по БФЛ: уверенно, точно, простым русским языком и по существу.",
    "Помогай пользователю понять ситуацию, риски, документы, порядок действий, сроки и возможные последствия.",
    "Если данных недостаточно, сначала задай 1-3 коротких уточняющих вопроса.",
    "Не придумывай факты, суммы, судебные решения и нормы. Если не уверенна, прямо скажи, что нужно проверить актуальную редакцию закона или документы пользователя.",
    "Не обещай гарантированный результат и не выдавай ответ за индивидуальное юридическое заключение. При высоком риске рекомендуй проверить позицию с юристом по документам.",
    "Держи тон дружелюбный, спокойный и профессиональный. Не пиши длинные полотна: сначала дай краткий вывод, затем шаги или список документов.",
  ].join(" ");

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    // Валидация структуры сообщений
    for (const msg of messages) {
      if (
        typeof msg !== "object" ||
        !msg ||
        typeof msg.role !== "string" ||
        typeof msg.content !== "string" ||
        !["user", "assistant"].includes(msg.role)
      ) {
        return NextResponse.json({ error: "Invalid message format" }, { status: 400 });
      }
    }

    // Ограничиваем историю и длину каждого сообщения — экономия токенов и защита.
    const trimmed = messages
      .slice(-10)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content.slice(0, 2000),
      }));

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("LLM API error:", response.status);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content ?? "Извините, не могу ответить сейчас.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
