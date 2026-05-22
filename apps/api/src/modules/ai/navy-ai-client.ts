import type {
  AiSpeechDto,
  AiSpeechRequestDto,
  AiTrainingReplyDto,
  AiTrainingReplyRequestDto,
  AiTranscriptionDto,
  AiTranscriptionRequestDto,
} from "@/lib/api-contracts";
import { sanitizeSpeechText, validateTranscriptionAudioPayload } from "@/lib/voice-mode";
import type { ApiEnv } from "../../config/env";

type FetchLike = typeof fetch;

export type NavyAiClient = {
  generateTrainingReply: (payload: AiTrainingReplyRequestDto) => Promise<AiTrainingReplyDto | null>;
  synthesizeSpeech: (payload: AiSpeechRequestDto) => Promise<AiSpeechDto | null>;
  transcribeSpeech: (payload: AiTranscriptionRequestDto) => Promise<AiTranscriptionDto | null>;
};

type NavyChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type NavyTranscriptionResponse = {
  text?: string;
};

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const parseJsonObject = (content: string): Partial<AiTrainingReplyDto> | null => {
  try {
    return JSON.parse(content) as Partial<AiTrainingReplyDto>;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]) as Partial<AiTrainingReplyDto>;
    } catch {
      return null;
    }
  }
};

const normalizeReply = (content: string, totalSteps: number, step: number): AiTrainingReplyDto | null => {
  const parsed = parseJsonObject(content);
  const reply = typeof parsed?.reply === "string" ? parsed.reply.trim() : "";

  if (!reply) return null;

  return {
    reply,
    scoreDelta: typeof parsed?.scoreDelta === "number" ? Math.max(0, Math.min(35, Math.round(parsed.scoreDelta))) : 0,
    mistakes: Array.isArray(parsed?.mistakes) ? parsed.mistakes.filter((item): item is string => typeof item === "string") : [],
    recommendations: Array.isArray(parsed?.recommendations)
      ? parsed.recommendations.filter((item): item is string => typeof item === "string")
      : [],
    sessionEnded: typeof parsed?.sessionEnded === "boolean" ? parsed.sessionEnded : step + 1 >= totalSteps,
  };
};

const decodeBase64 = (value: string) => Buffer.from(value, "base64");

export const createNavyAiClient = (
  env: Pick<ApiEnv, "NAVI_API_KEY" | "NAVI_BASE_URL" | "NAVI_CHAT_MODEL" | "NAVI_TTS_MODEL" | "NAVI_TTS_VOICE" | "NAVI_STT_MODEL">,
  fetchImpl: FetchLike = fetch,
): NavyAiClient => {
  const baseUrl = stripTrailingSlash(env.NAVI_BASE_URL);

  const headers = () => {
    if (!env.NAVI_API_KEY) return null;

    return {
      Authorization: `Bearer ${env.NAVI_API_KEY}`,
    };
  };

  return {
    generateTrainingReply: async (payload) => {
      const authHeaders = headers();
      if (!authHeaders) return null;

      const response = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.NAVI_CHAT_MODEL,
          temperature: 0.35,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: [
                "Ты клиент в тренажере юридических консультаций по банкротству физических лиц.",
                "Отвечай только валидным JSON без markdown.",
                "Схема: {\"reply\":\"реплика клиента\",\"scoreDelta\":0,\"mistakes\":[],\"recommendations\":[],\"sessionEnded\":false}.",
                "reply должен быть естественной короткой репликой клиента на русском.",
                "scoreDelta — штраф 0-35 за неточность, рискованное обещание, отсутствие эмпатии или неполный ответ.",
                "Не давай юридическую консультацию за сотрудника, задавай следующий вопрос как клиент.",
              ].join(" "),
            },
            {
              role: "user",
              content: JSON.stringify({
                topic: payload.topic,
                mode: payload.mode,
                step: payload.step,
                totalSteps: payload.totalSteps,
                userMessage: payload.userMessage,
                conversation: payload.messages.slice(-12),
                scriptContext: payload.scriptContext,
              }),
            },
          ],
        }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as NavyChatResponse;
      const content = data.choices?.[0]?.message?.content;
      return content ? normalizeReply(content, payload.totalSteps, payload.step) : null;
    },

    synthesizeSpeech: async ({ text }) => {
      const authHeaders = headers();
      const input = sanitizeSpeechText(text);
      if (!authHeaders || !input) return null;

      const response = await fetchImpl(`${baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.NAVI_TTS_MODEL,
          voice: env.NAVI_TTS_VOICE,
          input,
        }),
      });

      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();

      return {
        audioBase64: Buffer.from(arrayBuffer).toString("base64"),
        contentType: response.headers.get("content-type") || "audio/mpeg",
      };
    },

    transcribeSpeech: async ({ audioBase64, mimeType, fileName }) => {
      const authHeaders = headers();
      const validation = validateTranscriptionAudioPayload({ audioBase64, mimeType });
      if (!authHeaders || !validation.ok) return null;

      const formData = new FormData();
      formData.set("model", env.NAVI_STT_MODEL);
      formData.set("language", "ru");
      formData.set("response_format", "json");
      formData.set("file", new Blob([decodeBase64(audioBase64)], { type: mimeType }), fileName || "speech.webm");

      const response = await fetchImpl(`${baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });

      if (!response.ok) return null;

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? ((await response.json()) as NavyTranscriptionResponse | string)
        : await response.text();
      const text = (typeof data === "string" ? data : data.text)?.trim();

      return text ? { text } : null;
    },
  };
};
