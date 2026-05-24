export type TelegramBotEnv = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_DEFAULT_CHAT_ID?: string;
};

export type TelegramBotClient = {
  sendMessage: (payload: { chatId?: string; text: string }) => Promise<boolean>;
  sendLoginCode: (payload: { recipient?: string; code: string }) => Promise<boolean>;
  sendTrainingReminder: (payload: { mode: "exam" | "chat_test"; topic: string }) => Promise<boolean>;
  sendExamResult: (payload: { chatId?: string; score: number; topic: string; passed: boolean }) => Promise<boolean>;
  sendDailyReminder: (payload: { chatId?: string }) => Promise<boolean>;
};

type FetchLike = typeof fetch;

const telegramApiUrl = (token: string) => `https://api.telegram.org/bot${token}/sendMessage`;

const normalizeRecipient = (recipient?: string, fallback?: string) => {
  const value = recipient?.trim() || fallback?.trim();

  return value || undefined;
};

const modeLabel = (mode: "exam" | "chat_test") =>
  mode === "exam" ? "экзамен" : "чат-тест";

export const createTelegramBotClient = (
  env: TelegramBotEnv,
  fetchImpl: FetchLike = fetch,
): TelegramBotClient => {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const defaultChatId = env.TELEGRAM_DEFAULT_CHAT_ID?.trim();

  const sendMessage: TelegramBotClient["sendMessage"] = async ({ chatId, text }) => {
    const target = normalizeRecipient(chatId, defaultChatId);

    if (!token || !target || !text.trim()) return false;

    const response = await fetchImpl(telegramApiUrl(token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: target,
        text,
        disable_web_page_preview: true,
      }),
    });

    return response.ok;
  };

  return {
    sendMessage,
    sendLoginCode: ({ recipient, code }) =>
      sendMessage({
        chatId: recipient,
        text: `Код входа в HUNTERLITE: ${code}\n\nЕсли вы не запрашивали вход, просто проигнорируйте сообщение.`,
      }),
    sendTrainingReminder: ({ mode, topic }) =>
      sendMessage({
        text: `Напоминание HUNTERLITE: перед вами ${modeLabel(mode)} по теме «${topic}». Убедитесь, что вы готовы и микрофон работает.`,
      }),
    sendExamResult: ({ chatId, score, topic, passed }) => {
      const status = passed ? "Экзамен сдан!" : "Экзамен не сдан.";
      const emoji = passed ? "🎉" : "😔";
      return sendMessage({
        chatId,
        text: `${emoji} ${status}\n\nТема: ${topic}\nРезультат: ${score}/100\nПроходной балл: 88\n\n${passed ? "Поздравляем!" : "Попробуйте ещё раз после дополнительной подготовки."}`,
      });
    },
    sendDailyReminder: ({ chatId }) =>
      sendMessage({
        chatId,
        text: "🌅 Доброе утро! Не забудьте пройти тренировку сегодня на HUNTERLITE.",
      }),
  };
};
