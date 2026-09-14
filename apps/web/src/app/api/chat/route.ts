import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.LLM_API_KEY;
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.navy/v1";
// The general LLM_MODEL may be a slow reasoning model. Keep interactive
// assistant routing independent; both defaults are available on navy /models.
const MODEL = process.env.MANYASHA_MODEL ?? "deepseek-v4-flash";
const FALLBACK_MODEL = process.env.MANYASHA_FALLBACK_MODEL ?? "gemini-2.5-flash";
const PROVIDER_TIMEOUT_MS = 8000;
const UNAVAILABLE = "Маняша пока не смогла ответить. Попробуйте отправить вопрос ещё раз.";

// Справка о чемпионате/розыгрыше — Маняша авто-открывается на странице
// /championship и должна уметь отвечать по условиям, призам, срокам и налогам.
// Это справочные факты (не побуждение к теме): использовать, когда пользователь
// спрашивает про розыгрыш/чемпионат. Подробности/споры — отсылать к Положению.
const CHAMPIONSHIP_KNOWLEDGE =
  [
    "СПРАВКА О ЧЕМПИОНАТЕ (отвечай по ней, если спрашивают про розыгрыш/чемпионат/призы):",
    "— Это стимулирующее мероприятие (ст. 9 ФЗ-38 «О рекламе»), НЕ лотерея. Плата за участие не взимается.",
    "— Призы: 1 место — MacBook Air 13 M4, 2 место — iPhone 15, 3 место — AirPods 4.",
    "— Условия участия: сдать аттестацию (все экзамены ≥ 88%, именной сертификат); активная платная подписка (открывает доступ к курсам); пройти курсы «Юридические аспекты» и «Экспертный уровень БФЛ» на 100% (после каждого урока — мини-проверка); оставленный отзыв о платформе.",
    "— Победители определяются розыгрышем (жребием) среди ВСЕХ квалифицированных участников через независимый сервис RANDOM.ORG; результат фиксируется верификационным кодом и видеозаписью. Место в рейтинге активности победителя НЕ определяет.",
    "— Сроки: два сезона в год. Зимне-весенний: с 1 декабря по 31 мая. Летне-осенний: с 1 июня по 30 ноября. Последняя неделя сезона — неделя подсчёта итогов.",
    "— Налоги: стоимость приза свыше 4 000 ₽ облагается НДФЛ 35% (резидент РФ) с суммы превышения. Призы неденежные, поэтому организатор налог не удерживает — победитель сам декларирует доход (3-НДФЛ) и платит налог.",
    "— Организатор: ООО «АСПБ», ИНН 6452098049, ОГРН 1126450005406.",
    "— Полные правила — в Положении о Чемпионате (страница /championship/rules). Точные даты текущего сезона и список победителей — на странице чемпионата. Если спрашивают детали сверх этой справки — отсылай к Положению, не выдумывай.",
  ].join(" ");

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
    "Пиши обычным текстом без markdown: НЕ используй заголовки решёткой (#, ##, ###), НЕ выделяй жирным/курсивом звёздочками (**, *), НЕ используй хэштеги (#тег). Разделы нумеруй цифрой, списки — тире.",
    CHAMPIONSHIP_KNOWLEDGE,
  ].join(" ");

// Manyasha's reply is rendered as RAW text (no markdown parser), so flatten
// markdown (### headings, **bold**, *italic*, `code`, bullets) and drop hashtags
// to clean plain text. Mirrors the backend strip_markdown_formatting
// (content_filter.py) for the surfaces that hit this route directly (floating
// widget + quiz наставник).
function cleanManyashaText(text: string): string {
  return text
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "") // "### Title" → "Title"
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **x** → x
    .replace(/__([^_]+)__/g, "$1") // __x__ → x
    .replace(/^[ \t]*[*\-+][ \t]+/gm, "• ") // "* item" → "• item" (before italic)
    .replace(/\*([^*\n]+)\*/g, "$1") // *x* → x
    .replace(/`([^`]+)`/g, "$1") // `x` → x
    .replace(/#[0-9A-Za-zА-Яа-яЁё_][0-9A-Za-zА-Яа-яЁё_-]*/g, "") // #тег → removed
    .replace(/\*\*/g, "").replace(/__/g, "") // leftover stray markers
    .replace(/^[ \t]*[:;\-–—,.][ \t]*/gm, "") // orphan punct at line start
    .replace(/[ \t]+([.,:;!?…])/g, "$1") // space before punctuation
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

    for (const model of [...new Set([MODEL, FALLBACK_MODEL])]) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
      try {
        const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
            max_tokens: 2000,
            temperature: 0.7,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          console.warn("Manyasha provider rejected request", { model, status: response.status });
          continue;
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        // Internal reasoning is never a substitute for a user-facing answer.
        const reply = typeof content === "string" ? cleanManyashaText(content) : "";
        if (reply) return NextResponse.json({ reply });
      } catch {
        // Do not log prompts, credentials or upstream response bodies.
        console.warn("Manyasha provider unavailable", { model, timedOut: controller.signal.aborted });
      } finally {
        clearTimeout(timeout);
      }
    }
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать сообщение." }, { status: 400 });
  }
}
