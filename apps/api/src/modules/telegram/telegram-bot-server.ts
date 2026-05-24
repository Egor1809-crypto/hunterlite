import type { PrismaClient } from "@prisma/client";
import type { TelegramBotEnv } from "./telegram-bot-client";
import type { NavyAiClient } from "../ai/navy-ai-client";
import {
  EMBEDDED_QUIZ_QUESTIONS,
  TRAINING_SCENARIOS,
  FORBIDDEN_PHRASES,
  LEGAL_TIPS,
} from "./telegram-bot-content";
import type { EmbeddedQuizQuestion, TrainingScenario } from "./telegram-bot-content";

type FetchLike = typeof fetch;

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; first_name?: string; last_name?: string; username?: string };
    text?: string;
    contact?: { phone_number: string; user_id?: number };
    from?: { id: number; first_name?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
};

type InlineKeyboardButton = { text: string; callback_data?: string; url?: string };

type ExternalQuizQuestion = {
  id: string;
  topic: string;
  question: string;
  law: string;
  options: Array<{ text: string; isCorrect: boolean }>;
};

type QuizState = {
  questions: EmbeddedQuizQuestion[];
  currentIndex: number;
  correctCount: number;
  totalQuestions: number;
};

type TrainingState = {
  scenario: TrainingScenario;
  step: number;
  totalSteps: number;
  messages: Array<{ from: "ai" | "user"; text: string }>;
  score: number;
  penalties: string[];
};

export type TelegramBotServerOptions = {
  env: TelegramBotEnv;
  ai?: NavyAiClient;
  prisma?: PrismaClient;
  quizQuestions?: ExternalQuizQuestion[];
  fetchImpl?: FetchLike;
  pollingIntervalMs?: number;
  platformUrl?: string;
};

const telegramApi = (token: string, method: string) =>
  `https://api.telegram.org/bot${token}/${method}`;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const shuffleArray = <T>(arr: T[]): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const createTelegramBotServer = (options: TelegramBotServerOptions) => {
  const token = options.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const pollingMs = options.pollingIntervalMs ?? 1000;
  const platformUrl = options.platformUrl ?? "https://hunterlite.ru";
  const externalQuizQuestions = options.quizQuestions ?? [];
  const ai = options.ai;
  const prisma = options.prisma;

  let offset = 0;
  let running = false;
  let pollTimeout: ReturnType<typeof setTimeout> | null = null;

  const quizSessions = new Map<number, QuizState>();
  const trainingSessions = new Map<number, TrainingState>();
  const linkedUsers = new Map<number, { phone?: string; username?: string }>();
  const phoneToChatId = new Map<string, number>();

  const normalizePhone = (phone: string) =>
    phone.replace(/[\s\-()]/g, "").replace(/^8/, "+7");

  const callApi = async (method: string, body: Record<string, unknown>) => {
    try {
      const response = await fetchImpl(telegramApi(token, method), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return response.ok ? await response.json() : null;
    } catch (err) {
      console.error(`[TelegramBot] API call ${method} failed:`, err);
      return null;
    }
  };

  const sendMessage = (chatId: number, text: string, extra?: Record<string, unknown>) =>
    callApi("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    });

  const answerCallbackQuery = (callbackQueryId: string, text?: string) =>
    callApi("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    });

  const editMessageText = (
    chatId: number,
    messageId: number,
    text: string,
    extra?: Record<string, unknown>,
  ) =>
    callApi("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      ...extra,
    });

  const mainMenuKeyboard = {
    inline_keyboard: [
      [
        { text: "📝 Квиз", callback_data: "cmd:quiz" },
        { text: "💬 Тренировка", callback_data: "cmd:train" },
      ],
      [
        { text: "📊 Статистика", callback_data: "cmd:stats" },
        { text: "💡 Советы", callback_data: "cmd:tip" },
      ],
      [{ text: "🔗 Открыть платформу", url: platformUrl }],
    ],
  };

  const afterActivityKeyboard = {
    inline_keyboard: [
      [
        { text: "🔄 Ещё раз", callback_data: "cmd:quiz" },
        { text: "📊 Статистика", callback_data: "cmd:stats" },
      ],
      [{ text: "🏠 Главное меню", callback_data: "menu:main" }],
    ],
  };

  const afterTrainingKeyboard = {
    inline_keyboard: [
      [
        { text: "🔄 Ещё раз", callback_data: "cmd:train" },
        { text: "📊 Статистика", callback_data: "cmd:stats" },
      ],
      [{ text: "🏠 Главное меню", callback_data: "menu:main" }],
    ],
  };

  const trainingControlKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Продолжить", callback_data: "train:continue" },
        { text: "🛑 Завершить", callback_data: "train:end" },
      ],
    ],
  };

  // ── /start ──
  const handleStart = async (chatId: number, firstName?: string, username?: string) => {
    linkedUsers.set(chatId, { username });
    const name = firstName ? `, ${escapeHtml(firstName)}` : "";
    await sendMessage(
      chatId,
      [
        `Привет${name}! Я <b>PravoSkill Bot</b> — AI-помощник платформы HUNTERLITE.`,
        "",
        "Я помогу тебе тренировать навыки юридического консультирования по банкротству физических лиц.",
        "",
        "Что я умею:",
        "📝 <b>Квиз</b> — проверь знания за 2 минуты (5 вопросов)",
        "💬 <b>Тренировка</b> — отработай диалог с клиентом",
        "📊 <b>Статистика</b> — твой прогресс",
        "💡 <b>Советы</b> — полезные советы по консультированию",
        "",
        "Чтобы входить в HUNTERLITE через Telegram, поделись номером телефона 👇",
      ].join("\n"),
      {
        reply_markup: {
          keyboard: [
            [{ text: "📱 Поделиться номером", request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
  };

  const handleContact = async (chatId: number, phone: string, firstName?: string, lastName?: string) => {
    const normalized = normalizePhone(phone);
    phoneToChatId.set(normalized, chatId);
    const existing = linkedUsers.get(chatId);
    const username = existing?.username;
    if (existing) existing.phone = normalized;

    if (prisma) {
      try {
        await prisma.telegramPhoneLink.upsert({
          where: { phone: normalized },
          update: { chatId: BigInt(chatId), username, firstName, lastName },
          create: { phone: normalized, chatId: BigInt(chatId), username, firstName, lastName },
        });
      } catch (err) {
        console.error("[TelegramBot] Failed to persist phone link:", err);
      }
    }

    await sendMessage(
      chatId,
      [
        "✅ Номер привязан! Теперь ты можешь входить в HUNTERLITE через Telegram.",
        "",
        `Твой chat ID: <code>${chatId}</code>`,
        `Телефон: <code>${normalized}</code>`,
        "",
        "Выбери действие:",
      ].join("\n"),
      { reply_markup: { ...mainMenuKeyboard, remove_keyboard: true } },
    );

    await sendMessage(
      chatId,
      [
        "📚 <b>Книга БФЛ — Краткий справочник</b>",
        "",
        "Рекомендуем начать с изучения справочника по банкротству физлиц.",
        "В нём собраны юридические основы, типовые вопросы клиентов и безопасные формулировки.",
        "",
        `🔗 <a href="${platformUrl}/bfl-book">Открыть Книгу БФЛ</a>`,
      ].join("\n"),
    );
  };

  // ── /help ──
  const handleHelp = (chatId: number) =>
    sendMessage(
      chatId,
      [
        "<b>Команды PravoSkill Bot:</b>",
        "",
        "/start — Начать работу, привязать аккаунт",
        "/quiz — Квиз из 5 вопросов по банкротству",
        "/train — Мини-тренировка: ты юрист, я клиент",
        "/tip — Случайный совет по консультированию",
        "/stats — Статистика и информация о платформе",
        "/schedule — Расписание экзаменов и задач",
        "/help — Эта справка",
        "/stop — Отвязать аккаунт и попрощаться",
        "",
        "Также ты можешь задать любой вопрос о банкротстве физлиц — я постараюсь помочь.",
        "",
        `🔗 <a href="${platformUrl}">Полная версия тренажёра</a>`,
      ].join("\n"),
      { reply_markup: mainMenuKeyboard },
    );

  // ── /stop ──
  const handleStop = (chatId: number) => {
    quizSessions.delete(chatId);
    trainingSessions.delete(chatId);
    const wasLinked = linkedUsers.has(chatId);
    linkedUsers.delete(chatId);
    if (wasLinked) {
      return sendMessage(
        chatId,
        [
          "Аккаунт отвязан. Спасибо, что пользовались PravoSkill Bot!",
          "",
          "Если захотите вернуться — просто отправьте /start",
        ].join("\n"),
      );
    }
    return sendMessage(
      chatId,
      [
        "Вы пока не привязывали аккаунт.",
        "Отправьте /start чтобы начать работу.",
      ].join("\n"),
    );
  };

  // ── /tip ──
  const handleTip = (chatId: number) => {
    const tip = pickRandom(LEGAL_TIPS);
    return sendMessage(
      chatId,
      [
        "<b>💡 Совет дня</b>",
        "",
        escapeHtml(tip),
        "",
        "Ещё совет? Нажми /tip или кнопку ниже.",
      ].join("\n"),
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "💡 Ещё совет", callback_data: "cmd:tip" },
              { text: "🏠 Главное меню", callback_data: "menu:main" },
            ],
          ],
        },
      },
    );
  };

  // ── /stats ──
  const handleStats = (chatId: number) => {
    const isLinked = linkedUsers.has(chatId);
    if (!isLinked) {
      return sendMessage(
        chatId,
        [
          "<b>📊 Статистика</b>",
          "",
          "Аккаунт не привязан. Привяжите аккаунт через /start для отслеживания прогресса.",
          "",
          "<b>Платформа HUNTERLITE</b>",
          "Тренажёр для юристов-консультантов по банкротству физлиц.",
          "",
          "Режимы тренировки:",
          "  💬 Диалог с AI-клиентом",
          "  📋 Экзамен (проходной балл 88%)",
          "  ✅ Тестирование знаний",
          "  🎯 Отработка возражений",
          "  📞 Симуляция звонков",
          "",
          `🔗 <a href="${platformUrl}">Открыть HUNTERLITE</a>`,
        ].join("\n"),
        { reply_markup: mainMenuKeyboard },
      );
    }
    return sendMessage(
      chatId,
      [
        "<b>📊 Статистика</b>",
        "",
        "Ваш аккаунт привязан к боту.",
        "",
        "<b>Платформа HUNTERLITE</b>",
        "Тренажёр для юристов-консультантов по банкротству физлиц.",
        "",
        "Режимы тренировки:",
        "  💬 Диалог с AI-клиентом",
        "  📋 Экзамен (проходной балл 88%)",
        "  ✅ Тестирование знаний",
        "  🎯 Отработка возражений",
        "  📞 Симуляция звонков",
        "",
        "Темы: условия банкротства, последствия, имущество, процедура, стоимость, возражения, безопасные формулировки.",
        "",
        `Полноценная статистика доступна на платформе:`,
        `🔗 <a href="${platformUrl}">Открыть HUNTERLITE</a>`,
      ].join("\n"),
      { reply_markup: mainMenuKeyboard },
    );
  };

  // ── /schedule ──
  const handleSchedule = (chatId: number) =>
    sendMessage(
      chatId,
      [
        "<b>📅 Расписание</b>",
        "",
        "Актуальное расписание экзаменов и задач доступно на платформе.",
        "",
        "Бот пришлёт уведомление, когда появятся новые задания или приблизится дата экзамена.",
        "",
        `🔗 <a href="${platformUrl}">Открыть расписание</a>`,
      ].join("\n"),
      { reply_markup: mainMenuKeyboard },
    );

  // ── /quiz — multi-question quiz ──
  const startQuiz = (chatId: number) => {
    const pool: EmbeddedQuizQuestion[] = [...EMBEDDED_QUIZ_QUESTIONS];

    if (externalQuizQuestions.length > 0) {
      for (const eq of externalQuizQuestions) {
        pool.push({
          id: eq.id,
          topic: eq.topic,
          question: eq.question,
          law: eq.law,
          explanation: "",
          options: eq.options,
        });
      }
    }

    if (pool.length === 0) {
      return sendMessage(chatId, "К сожалению, вопросы для квиза пока не загружены. Попробуйте позже.");
    }

    const shuffled = shuffleArray(pool);
    const selected = shuffled.slice(0, Math.min(5, shuffled.length));

    const state: QuizState = {
      questions: selected,
      currentIndex: 0,
      correctCount: 0,
      totalQuestions: selected.length,
    };
    quizSessions.set(chatId, state);

    return sendQuizQuestion(chatId, state);
  };

  const sendQuizQuestion = (chatId: number, state: QuizState) => {
    const q = state.questions[state.currentIndex];
    const shuffledOptions = shuffleArray(q.options);
    const optionLetters = ["А", "Б", "В", "Г"];

    const keyboard: InlineKeyboardButton[][] = shuffledOptions.map((opt, i) => [
      {
        text: `${optionLetters[i]}. ${opt.text.length > 55 ? opt.text.slice(0, 55) + "..." : opt.text}`,
        callback_data: `quiz:answer:${state.currentIndex}:${opt.isCorrect ? "1" : "0"}:${i}`,
      },
    ]);

    return sendMessage(
      chatId,
      [
        `<b>📝 Вопрос ${state.currentIndex + 1}/${state.totalQuestions}</b>`,
        `Тема: <i>${escapeHtml(q.topic)}</i>`,
        "",
        escapeHtml(q.question),
        "",
        `📖 ${escapeHtml(q.law)}`,
      ].join("\n"),
      { reply_markup: { inline_keyboard: keyboard } },
    );
  };

  const handleQuizAnswer = async (
    callbackQueryId: string,
    chatId: number,
    messageId: number,
    data: string,
  ) => {
    const parts = data.split(":");
    const questionIndex = parseInt(parts[2], 10);
    const isCorrect = parts[3] === "1";

    const state = quizSessions.get(chatId);
    if (!state || state.currentIndex !== questionIndex) {
      await answerCallbackQuery(callbackQueryId, "Этот вопрос уже неактуален.");
      return;
    }

    const q = state.questions[state.currentIndex];

    if (isCorrect) {
      state.correctCount += 1;
    }

    await answerCallbackQuery(callbackQueryId, isCorrect ? "✅ Правильно!" : "❌ Неверно");

    const correctAnswer = q.options.find((o) => o.isCorrect);
    const explanationText = q.explanation
      ? `\n\n💡 ${escapeHtml(q.explanation)}`
      : "";

    const resultLine = isCorrect
      ? "✅ <b>Правильно!</b>"
      : `❌ <b>Неверно.</b>\nПравильный ответ: ${correctAnswer ? escapeHtml(correctAnswer.text) : "—"}`;

    state.currentIndex += 1;
    const hasMore = state.currentIndex < state.totalQuestions;

    if (hasMore) {
      await editMessageText(chatId, messageId, [
        resultLine,
        explanationText,
      ].join("\n"));

      await sendQuizQuestion(chatId, state);
    } else {
      quizSessions.delete(chatId);
      const scoreEmoji =
        state.correctCount === state.totalQuestions
          ? "🏆"
          : state.correctCount >= 3
            ? "👍"
            : "📚";

      const scoreComment =
        state.correctCount === state.totalQuestions
          ? "Идеальный результат! Ты отлично знаешь законодательство о банкротстве!"
          : state.correctCount >= 3
            ? "Хороший результат! Но есть куда расти. Повтори слабые темы."
            : "Нужно подтянуть знания. Рекомендую изучить закон 127-ФЗ и пройти тренировку.";

      await editMessageText(chatId, messageId, [
        resultLine,
        explanationText,
      ].join("\n"));

      await sendMessage(
        chatId,
        [
          `${scoreEmoji} <b>Квиз завершён!</b>`,
          "",
          `Результат: <b>${state.correctCount}/${state.totalQuestions}</b>`,
          "",
          scoreComment,
          "",
          `🔗 <a href="${platformUrl}">Полноценная тренировка на HUNTERLITE</a>`,
        ].join("\n"),
        { reply_markup: afterActivityKeyboard },
      );
    }
  };

  // ── /train — training dialogue ──
  const startTraining = async (chatId: number) => {
    trainingSessions.delete(chatId);

    const scenario = pickRandom(TRAINING_SCENARIOS);

    const state: TrainingState = {
      scenario,
      step: 0,
      totalSteps: 3,
      messages: [{ from: "ai", text: scenario.openingLine }],
      score: 100,
      penalties: [],
    };
    trainingSessions.set(chatId, state);

    await sendMessage(
      chatId,
      [
        "<b>💬 Мини-тренировка</b>",
        `Тема: <i>${escapeHtml(scenario.topic)}</i>`,
        "",
        `Ситуация: <i>${escapeHtml(scenario.situation)}</i>`,
        "",
        "Я — клиент. Ты — юрист-консультант по банкротству.",
        `Ответь на ${state.totalSteps} вопроса(ов) клиента. В конце получишь оценку.`,
        "",
        `<b>Клиент (${escapeHtml(scenario.clientName)}):</b>`,
        escapeHtml(scenario.openingLine),
        "",
        "Отвечай текстом 👇",
      ].join("\n"),
    );
  };

  const checkForbiddenPhrases = (text: string): string[] => {
    const lower = text.toLowerCase();
    const found: string[] = [];
    for (const phrase of FORBIDDEN_PHRASES) {
      if (lower.includes(phrase.toLowerCase())) {
        found.push(phrase);
      }
    }
    return found;
  };

  const checkKeyConceptsMissed = (text: string, expected: string[]): string[] => {
    const lower = text.toLowerCase();
    const missed: string[] = [];
    for (const concept of expected) {
      if (!lower.includes(concept.toLowerCase())) {
        missed.push(concept);
      }
    }
    return missed;
  };

  const handleTrainMessage = async (chatId: number, userText: string) => {
    const state = trainingSessions.get(chatId);
    if (!state) return;

    state.messages.push({ from: "user", text: userText });
    state.step += 1;

    const forbidden = checkForbiddenPhrases(userText);
    if (forbidden.length > 0) {
      const penalty = forbidden.length * 15;
      state.score = Math.max(0, state.score - penalty);
      state.penalties.push(
        `Использованы запрещённые фразы: "${forbidden.join('", "')}" (-${penalty} баллов)`,
      );
    }

    if (ai) {
      try {
        const response = await ai.generateTrainingReply({
          topic: state.scenario.topic,
          mode: "talk",
          step: state.step,
          totalSteps: state.totalSteps,
          userMessage: userText,
          messages: state.messages.map((m) => ({ from: m.from, text: m.text })),
        });

        if (response) {
          if (response.scoreDelta > 0) {
            state.score = Math.max(0, state.score - response.scoreDelta);
          }

          const shouldEnd = response.sessionEnded || state.step >= state.totalSteps;

          if (shouldEnd) {
            state.messages.push({ from: "ai", text: response.reply });
            await finishTraining(chatId, state);
            return;
          }

          state.messages.push({ from: "ai", text: response.reply });

          let feedbackBlock = "";
          if (forbidden.length > 0) {
            feedbackBlock = `\n\n⚠️ <i>Внимание: вы использовали запрещённые фразы: "${forbidden.join('", "')}"</i>`;
          }

          await sendMessage(
            chatId,
            [
              `<b>Клиент (${escapeHtml(state.scenario.clientName)}):</b>`,
              escapeHtml(response.reply),
              feedbackBlock,
              "",
              `Реплика ${state.step}/${state.totalSteps}`,
            ].join("\n"),
            { reply_markup: trainingControlKeyboard },
          );
          return;
        }
      } catch (err) {
        console.error("[TelegramBot] AI training reply failed:", err);
      }
    }

    const shouldEnd = state.step >= state.totalSteps;
    const followUpIndex = state.step - 1;
    const fallbackReply =
      shouldEnd
        ? "Спасибо за консультацию. Мне нужно подумать."
        : followUpIndex < state.scenario.followUps.length
          ? state.scenario.followUps[followUpIndex]
          : "Понятно... А расскажите подробнее, какие документы мне нужно собрать?";

    state.messages.push({ from: "ai", text: fallbackReply });

    let feedbackBlock = "";
    if (forbidden.length > 0) {
      feedbackBlock = `\n\n⚠️ <i>Внимание: вы использовали запрещённые фразы: "${forbidden.join('", "')}"</i>`;
    }

    if (shouldEnd) {
      await finishTraining(chatId, state);
    } else {
      await sendMessage(
        chatId,
        [
          `<b>Клиент (${escapeHtml(state.scenario.clientName)}):</b>`,
          escapeHtml(fallbackReply),
          feedbackBlock,
          "",
          `Реплика ${state.step}/${state.totalSteps}`,
        ].join("\n"),
        { reply_markup: trainingControlKeyboard },
      );
    }
  };

  const finishTraining = async (chatId: number, state: TrainingState) => {
    trainingSessions.delete(chatId);

    const allUserTexts = state.messages
      .filter((m) => m.from === "user")
      .map((m) => m.text)
      .join(" ");

    const missedConcepts = checkKeyConceptsMissed(
      allUserTexts,
      state.scenario.keyConceptsExpected,
    );

    if (missedConcepts.length > 0) {
      const conceptPenalty = Math.min(missedConcepts.length * 5, 20);
      state.score = Math.max(0, state.score - conceptPenalty);
    }

    const scoreEmoji = state.score >= 88 ? "🟢" : state.score >= 60 ? "🟡" : "🔴";

    const penaltiesBlock =
      state.penalties.length > 0
        ? ["", "<b>Замечания:</b>", ...state.penalties.map((p) => `  ⚠️ ${escapeHtml(p)}`)]
        : [];

    const conceptsBlock =
      missedConcepts.length > 0
        ? [
            "",
            "<b>Не упомянуты важные понятия:</b>",
            ...missedConcepts.map((c) => `  📌 ${escapeHtml(c)}`),
          ]
        : [];

    const adviceBlock =
      state.score >= 88
        ? "Отлично! Ты уверенно консультируешь клиентов. Продолжай в том же духе!"
        : state.score >= 60
          ? "Неплохо, но есть что улучшить. Обрати внимание на точность формулировок и упомянутые замечания."
          : "Нужно подтянуть знания. Рекомендую пройти полноценную тренировку на платформе и изучить безопасные формулировки.";

    await sendMessage(
      chatId,
      [
        "<b>📊 Результат мини-тренировки</b>",
        "",
        `Тема: <i>${escapeHtml(state.scenario.topic)}</i>`,
        `Клиент: ${escapeHtml(state.scenario.clientName)}`,
        `Реплик: ${state.step}/${state.totalSteps}`,
        `${scoreEmoji} Оценка: <b>${state.score}/100</b>`,
        ...penaltiesBlock,
        ...conceptsBlock,
        "",
        adviceBlock,
        "",
        `🔗 <a href="${platformUrl}">Полная тренировка на HUNTERLITE</a>`,
      ].join("\n"),
      { reply_markup: afterTrainingKeyboard },
    );
  };

  // ── /menu:main ──
  const handleMainMenu = (chatId: number) =>
    sendMessage(
      chatId,
      [
        "<b>🏠 Главное меню</b>",
        "",
        "Выбери действие:",
      ].join("\n"),
      { reply_markup: mainMenuKeyboard },
    );

  // ── Free text / AI fallback ──
  const handleFreeText = async (chatId: number, text: string) => {
    if (trainingSessions.has(chatId)) {
      await handleTrainMessage(chatId, text);
      return;
    }

    if (!ai) {
      await sendMessage(
        chatId,
        [
          "Я пока работаю в ограниченном режиме. Попробуй команды:",
          "",
          "📝 /quiz — квиз по банкротству",
          "💬 /train — мини-тренировка",
          "💡 /tip — совет дня",
          "❓ /help — справка",
        ].join("\n"),
        { reply_markup: mainMenuKeyboard },
      );
      return;
    }

    try {
      const response = await ai.generateTrainingReply({
        topic: "Общие вопросы",
        mode: "talk",
        step: 0,
        totalSteps: 1,
        userMessage: text,
        messages: [{ from: "user", text }],
        scriptContext: {
          title: "Telegram помощник",
        },
      });

      if (response?.reply) {
        await sendMessage(chatId, escapeHtml(response.reply), {
          reply_markup: mainMenuKeyboard,
        });
        return;
      }
    } catch (err) {
      console.error("[TelegramBot] AI free text reply failed:", err);
    }

    await sendMessage(
      chatId,
      [
        "Не удалось обработать запрос. Попробуй одну из команд:",
        "",
        "📝 /quiz — квиз по банкротству",
        "💬 /train — мини-тренировка",
        "💡 /tip — совет дня",
      ].join("\n"),
      { reply_markup: mainMenuKeyboard },
    );
  };

  // ── Callback query router ──
  const processCallbackQuery = async (
    callbackQueryId: string,
    chatId: number,
    messageId: number,
    data: string,
  ) => {
    if (data.startsWith("quiz:answer:")) {
      await handleQuizAnswer(callbackQueryId, chatId, messageId, data);
      return;
    }

    await answerCallbackQuery(callbackQueryId);

    switch (data) {
      case "cmd:quiz":
        quizSessions.delete(chatId);
        trainingSessions.delete(chatId);
        await startQuiz(chatId);
        break;

      case "cmd:train":
        quizSessions.delete(chatId);
        await startTraining(chatId);
        break;

      case "cmd:stats":
        await handleStats(chatId);
        break;

      case "cmd:tip":
        await handleTip(chatId);
        break;

      case "cmd:help":
        await handleHelp(chatId);
        break;

      case "menu:main":
        quizSessions.delete(chatId);
        trainingSessions.delete(chatId);
        await handleMainMenu(chatId);
        break;

      case "train:continue":
        break;

      case "train:end": {
        const session = trainingSessions.get(chatId);
        if (session) {
          await finishTraining(chatId, session);
        } else {
          await sendMessage(chatId, "Нет активной тренировки.", {
            reply_markup: mainMenuKeyboard,
          });
        }
        break;
      }

      default:
        await sendMessage(chatId, "Неизвестная команда. Используй /help для справки.", {
          reply_markup: mainMenuKeyboard,
        });
        break;
    }
  };

  // ── Update router ──
  const processUpdate = async (update: TelegramUpdate) => {
    try {
      if (update.callback_query) {
        const cb = update.callback_query;
        const data = cb.data ?? "";
        if (cb.message) {
          await processCallbackQuery(cb.id, cb.message.chat.id, cb.message.message_id, data);
        } else {
          await answerCallbackQuery(cb.id);
        }
        return;
      }

      const msg = update.message;
      if (!msg) return;

      const chatId = msg.chat.id;

      if (msg.contact) {
        await handleContact(chatId, msg.contact.phone_number, msg.chat.first_name, msg.chat.last_name);
        return;
      }

      if (!msg.text) return;

      const text = msg.text.trim();
      const command = text.split(/\s/)[0].toLowerCase();

      switch (command) {
        case "/start":
          await handleStart(chatId, msg.from?.first_name, msg.chat.username);
          break;
        case "/help":
          await handleHelp(chatId);
          break;
        case "/quiz":
          quizSessions.delete(chatId);
          trainingSessions.delete(chatId);
          await startQuiz(chatId);
          break;
        case "/train":
          quizSessions.delete(chatId);
          await startTraining(chatId);
          break;
        case "/tip":
          await handleTip(chatId);
          break;
        case "/stats":
          await handleStats(chatId);
          break;
        case "/schedule":
          await handleSchedule(chatId);
          break;
        case "/stop":
          await handleStop(chatId);
          break;
        default:
          await handleFreeText(chatId, text);
          break;
      }
    } catch (err) {
      console.error("[TelegramBot] Error processing update:", err);
      const chatId =
        update.message?.chat.id ?? update.callback_query?.message?.chat.id;
      if (chatId) {
        await sendMessage(
          chatId,
          "Произошла ошибка при обработке запроса. Попробуйте ещё раз или используйте /help.",
        ).catch(() => {});
      }
    }
  };

  // ── Polling loop ──
  const poll = async () => {
    if (!running) return;

    try {
      const response = await fetchImpl(telegramApi(token, "getUpdates"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset,
          timeout: 30,
          allowed_updates: ["message", "callback_query"],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          ok: boolean;
          result?: TelegramUpdate[];
        };

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            try {
              await processUpdate(update);
            } catch (err) {
              console.error("[TelegramBot] Error processing update:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("[TelegramBot] Polling error:", err);
    }

    if (running) {
      pollTimeout = setTimeout(() => void poll(), pollingMs);
    }
  };

  // ── Notification methods (for use by other modules via bot client) ──
  const sendNotification = (chatId: number, text: string) =>
    sendMessage(chatId, text, { reply_markup: mainMenuKeyboard });

  const sendTrainingReminder = (chatId: number, mode: string, topic: string) => {
    const modeLabel = mode === "exam" ? "экзамен" : "чат-тест";
    return sendNotification(
      chatId,
      [
        "<b>📢 Напоминание</b>",
        "",
        `Перед вами ${modeLabel} по теме: <b>${escapeHtml(topic)}</b>`,
        "",
        "Убедитесь, что вы готовы.",
        "",
        `🔗 <a href="${platformUrl}">Перейти к заданию</a>`,
      ].join("\n"),
    );
  };

  const sendExamResult = (chatId: number, score: number, topic: string, passed: boolean) => {
    const emoji = passed ? "🎉" : "😔";
    const statusText = passed ? "Экзамен сдан!" : "Экзамен не сдан.";
    return sendNotification(
      chatId,
      [
        `${emoji} <b>${statusText}</b>`,
        "",
        `Тема: <i>${escapeHtml(topic)}</i>`,
        `Результат: <b>${score}/100</b>`,
        `Проходной балл: <b>88</b>`,
        "",
        passed
          ? "Поздравляем! Вы успешно подтвердили свои знания."
          : "Не расстраивайтесь! Пройдите тренировку и попробуйте снова.",
        "",
        `🔗 <a href="${platformUrl}">Подробнее на платформе</a>`,
      ].join("\n"),
    );
  };

  const sendDailyReminder = (chatId: number) =>
    sendNotification(
      chatId,
      [
        "<b>🌅 Доброе утро!</b>",
        "",
        "Не забудьте пройти тренировку сегодня!",
        "",
        "Варианты на сегодня:",
        "  📝 Квиз — 2 минуты",
        "  💬 Тренировка — 5 минут",
        "",
        `🔗 <a href="${platformUrl}">Открыть HUNTERLITE</a>`,
      ].join("\n"),
    );

  const getChatIdByPhone = async (phone: string): Promise<number | undefined> => {
    const normalized = normalizePhone(phone);
    const cached = phoneToChatId.get(normalized);
    if (cached !== undefined) return cached;

    if (prisma) {
      try {
        const row = await prisma.telegramPhoneLink.findUnique({
          where: { phone: normalized },
        });
        if (row) {
          const chatId = Number(row.chatId);
          phoneToChatId.set(normalized, chatId);
          return chatId;
        }
      } catch (err) {
        console.error("[TelegramBot] Failed to lookup phone link:", err);
      }
    }

    return undefined;
  };

  const getUserNameByPhone = async (phone: string): Promise<string | undefined> => {
    const normalized = normalizePhone(phone);
    if (prisma) {
      try {
        const row = await prisma.telegramPhoneLink.findUnique({
          where: { phone: normalized },
        });
        if (row?.firstName) {
          return [row.firstName, row.lastName].filter(Boolean).join(" ");
        }
      } catch (err) {
        console.error("[TelegramBot] Failed to lookup user name:", err);
      }
    }
    return undefined;
  };

  return {
    getChatIdByPhone,
    getUserNameByPhone,
    start: () => {
      if (running) return;
      running = true;
      void callApi("setMyCommands", {
        commands: [
          { command: "start", description: "Начать работу с ботом" },
          { command: "quiz", description: "Квиз из 5 вопросов по банкротству" },
          { command: "train", description: "Мини-тренировка с AI-клиентом" },
          { command: "tip", description: "Совет по консультированию" },
          { command: "stats", description: "Статистика и информация" },
          { command: "schedule", description: "Расписание экзаменов" },
          { command: "help", description: "Помощь и команды" },
          { command: "stop", description: "Отвязать аккаунт" },
        ],
      });
      console.log("[TelegramBot] PravoSkill_Bot started polling");
      void poll();
    },
    stop: () => {
      running = false;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
        pollTimeout = null;
      }
      console.log("[TelegramBot] PravoSkill_Bot stopped");
    },
    processUpdate,
    sendTrainingReminder,
    sendExamResult,
    sendDailyReminder,
    sendNotification,
  };
};
