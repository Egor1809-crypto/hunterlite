import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTelegramBotServer } from "../../apps/api/src";

const makeFetch = (responses?: Record<string, unknown>[]) => {
  let callIndex = 0;
  return vi.fn(async () => {
    const body = responses?.[callIndex] ?? { ok: true, result: [] };
    callIndex++;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
};

const quizQuestions = [
  {
    id: "q1",
    topic: "Подсудность",
    question: "Какой суд рассматривает дела о банкротстве?",
    law: "127-ФЗ ст. 213.4",
    options: [
      { text: "Арбитражный суд", isCorrect: true },
      { text: "Мировой суд", isCorrect: false },
      { text: "Районный суд", isCorrect: false },
    ],
  },
];

describe("telegram bot server", () => {
  it("returns null when token is missing", () => {
    const bot = createTelegramBotServer({ env: {} });
    expect(bot).toBeNull();
  });

  it("creates a bot server when token is provided", () => {
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl: makeFetch(),
    });
    expect(bot).toBeDefined();
    expect(bot).toHaveProperty("start");
    expect(bot).toHaveProperty("stop");
    expect(bot).toHaveProperty("processUpdate");
  });

  it("handles /start command", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
      platformUrl: "https://test.hunterlite.ru",
    })!;

    await bot.processUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 100, first_name: "Анна" },
        text: "/start",
        from: { id: 100, first_name: "Анна" },
      },
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.chat_id).toBe(100);
    expect(body.text).toContain("Привет, Анна");
    expect(body.text).toContain("PravoSkill Bot");
    expect(body.text).toContain("https://test.hunterlite.ru");
  });

  it("handles /help command", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
    })!;

    await bot.processUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        chat: { id: 100 },
        text: "/help",
      },
    });

    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toContain("Команды PravoSkill Bot");
  });

  it("handles /quiz with questions available", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
      quizQuestions,
    })!;

    await bot.processUpdate({
      update_id: 3,
      message: {
        message_id: 3,
        chat: { id: 100 },
        text: "/quiz",
      },
    });

    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toContain("Подсудность");
    expect(body.reply_markup).toBeDefined();
    expect(body.reply_markup.inline_keyboard.length).toBe(3);
  });

  it("handles /quiz without questions", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
      quizQuestions: [],
    })!;

    await bot.processUpdate({
      update_id: 4,
      message: {
        message_id: 4,
        chat: { id: 100 },
        text: "/quiz",
      },
    });

    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toContain("не загружены");
  });

  it("handles quiz callback with correct answer", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
      quizQuestions,
    })!;

    await bot.processUpdate({
      update_id: 5,
      callback_query: {
        id: "cb1",
        from: { id: 100 },
        message: { chat: { id: 100 }, message_id: 10 },
        data: "quiz:q1:1",
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const answerBody = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(answerBody.text).toContain("Правильно");
    const editBody = JSON.parse((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(editBody.text).toContain("Правильно");
  });

  it("handles /train command and starts mini-training session", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
    })!;

    await bot.processUpdate({
      update_id: 6,
      message: {
        message_id: 6,
        chat: { id: 200 },
        text: "/train",
      },
    });

    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.chat_id).toBe(200);
    expect(body.text).toContain("Мини-тренировка");
    expect(body.text).toContain("Клиент:");
  });

  it("completes a training session after 5 replies without AI", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
    })!;

    await bot.processUpdate({
      update_id: 10,
      message: { message_id: 10, chat: { id: 300 }, text: "/train" },
    });

    for (let step = 1; step <= 5; step++) {
      await bot.processUpdate({
        update_id: 10 + step,
        message: {
          message_id: 10 + step,
          chat: { id: 300 },
          text: `Ответ юриста ${step}`,
        },
      });
    }

    const lastCall = fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1] as [string, RequestInit];
    const body = JSON.parse(lastCall[1].body as string);
    expect(body.text).toContain("Результат мини-тренировки");
    expect(body.text).toContain("/100");
  });

  it("handles /stats command", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
    })!;

    await bot.processUpdate({
      update_id: 20,
      message: { message_id: 20, chat: { id: 100 }, text: "/stats" },
    });

    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toContain("Платформа HUNTERLITE");
    expect(body.text).toContain("88%");
  });

  it("handles /stop without active session", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
    })!;

    await bot.processUpdate({
      update_id: 21,
      message: { message_id: 21, chat: { id: 100 }, text: "/stop" },
    });

    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toContain("Нет активной тренировки");
  });

  it("responds to free text without AI with fallback", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
    })!;

    await bot.processUpdate({
      update_id: 22,
      message: { message_id: 22, chat: { id: 100 }, text: "Что такое банкротство?" },
    });

    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toContain("ограниченном режиме");
  });

  it("starts and stops polling", () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
      pollingIntervalMs: 100000,
    })!;

    bot.start();
    bot.stop();
  });

  it("ignores updates without message or callback", async () => {
    const fetchImpl = makeFetch();
    const bot = createTelegramBotServer({
      env: { TELEGRAM_BOT_TOKEN: "test-token" },
      fetchImpl,
    })!;

    await bot.processUpdate({ update_id: 99 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
