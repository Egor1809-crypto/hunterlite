import { describe, expect, it, vi } from "vitest";
import { createTelegramBotClient } from "../../apps/api/src";

describe("telegram bot client", () => {
  it("sends login codes through Telegram Bot API without exposing token in payload", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const telegram = createTelegramBotClient({
      TELEGRAM_BOT_TOKEN: "bot-token",
      TELEGRAM_DEFAULT_CHAT_ID: "123456",
    }, fetchMock as typeof fetch);

    await expect(telegram.sendLoginCode({ code: "123456" })).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Код входа"),
      }),
    );
    expect(fetchMock.mock.calls[0][1]?.body).not.toContain("bot-token");
  });

  it("does nothing when token or chat id is missing", async () => {
    const fetchMock = vi.fn();
    const telegram = createTelegramBotClient({}, fetchMock as typeof fetch);

    await expect(telegram.sendTrainingReminder({ mode: "exam", topic: "Имущество" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
