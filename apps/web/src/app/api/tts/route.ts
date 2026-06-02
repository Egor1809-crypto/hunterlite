/**
 * Серверный нейро-TTS для Маняши.
 *
 * Виджет шлёт POST { text: string, voice?: string } и получает в ответ
 * audio/mpeg (MP3). Озвучка идёт через OpenAI-совместимый /audio/speech
 * провайдера Navy — тот же ключ и базовый URL, что и у чата.
 *
 * Ключ — только из переменных окружения, НИКОГДА не хардкодить и не коммитить.
 *
 *   .env.local:
 *     LLM_API_KEY=sk-...
 *     LLM_BASE_URL=https://api.navy/v1
 *     TTS_MODEL=tts-1            # опционально
 *     TTS_VOICE=shimmer         # опционально, тёплый женский голос для Маняши
 */

import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.LLM_API_KEY;
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.navy/v1";
const MODEL = process.env.TTS_MODEL ?? "tts-1";
const DEFAULT_VOICE = process.env.TTS_VOICE ?? "shimmer";

// Допустимые голоса OpenAI-совместимого TTS — отсекаем мусор из клиента.
const ALLOWED_VOICES = new Set([
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
]);

const MAX_INPUT = 2000;

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const requestedVoice =
      typeof body?.voice === "string" ? body.voice : DEFAULT_VOICE;
    const voice = ALLOWED_VOICES.has(requestedVoice) ? requestedVoice : DEFAULT_VOICE;

    if (!text) {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }

    const response = await fetch(`${BASE_URL}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: text.slice(0, MAX_INPUT),
        voice,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      console.error("TTS API error:", response.status);
      return NextResponse.json({ error: "TTS service error" }, { status: 502 });
    }

    const audio = await response.arrayBuffer();

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
