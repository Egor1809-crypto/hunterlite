import { describe, expect, it, vi } from "vitest";
import { createNavyAiClient } from "../../apps/api/src";

const env = {
  NAVI_API_KEY: "test-key",
  NAVI_BASE_URL: "https://api.navy",
  NAVI_CHAT_MODEL: "gemini-3.5-flash",
  NAVI_TTS_MODEL: "eleven_flash_v2_5",
  NAVI_TTS_VOICE: "aria",
  NAVI_STT_MODEL: "scribe_v2",
};

describe("NAVI client", () => {
  it("uses NAVI chat completions with the configured Gemini model", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            reply: "А что будет с ипотекой?",
            scoreDelta: 5,
            mistakes: ["Не раскрыта ипотека"],
            recommendations: ["Добавить уточнение про залог"],
            sessionEnded: false,
          }),
        },
      }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = createNavyAiClient(env, fetchMock as typeof fetch);

    await expect(client.generateTrainingReply({
      topic: "Имущество должника",
      mode: "talk",
      step: 0,
      totalSteps: 3,
      userMessage: "Здравствуйте",
      messages: [{ from: "user", text: "Здравствуйте" }],
    })).resolves.toEqual({
      reply: "А что будет с ипотекой?",
      scoreDelta: 5,
      mistakes: ["Не раскрыта ипотека"],
      recommendations: ["Добавить уточнение про залог"],
      sessionEnded: false,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.navy/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      body: expect.stringContaining('"model":"gemini-3.5-flash"'),
    }));
  });

  it("uses NAVI speech and transcription endpoints with configured voice models", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/v1/audio/speech")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "audio/mpeg" },
        });
      }

      return new Response(JSON.stringify({ text: "Голос распознан" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = createNavyAiClient(env, fetchMock as typeof fetch);

    await expect(client.synthesizeSpeech({ text: "Здравствуйте" })).resolves.toEqual({
      audioBase64: "AQID",
      contentType: "audio/mpeg",
    });
    await expect(client.transcribeSpeech({
      audioBase64: "AQID",
      mimeType: "audio/webm",
      fileName: "speech.webm",
    })).resolves.toEqual({ text: "Голос распознан" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.navy/v1/audio/speech");
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({
      model: "eleven_flash_v2_5",
      voice: "aria",
      input: "Здравствуйте",
    }));
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.navy/v1/audio/transcriptions");
  });
});
