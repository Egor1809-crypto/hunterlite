import { describe, expect, it } from "vitest";
import {
  maxTranscriptionAudioBytes,
  sanitizeSpeechText,
  selectRecordingMimeType,
  validateTranscriptionAudioPayload,
} from "@/lib/voice-mode";

describe("voice mode helpers", () => {
  it("sanitizes text before TTS synthesis", () => {
    expect(sanitizeSpeechText("**Здравствуйте** [клиент](https://example.com)\n`код`")).toBe("Здравствуйте клиент код");
  });

  it("selects the first supported recording mime type", () => {
    const supported = selectRecordingMimeType((mimeType) => mimeType === "audio/webm");

    expect(supported).toBe("audio/webm");
  });

  it("validates transcription audio payloads", () => {
    expect(validateTranscriptionAudioPayload({
      audioBase64: "AQID",
      mimeType: "audio/webm;codecs=opus",
    })).toEqual({ ok: true });
    expect(validateTranscriptionAudioPayload({
      audioBase64: "AQID",
      mimeType: "text/plain",
    })).toEqual({ ok: false, reason: "Unsupported audio format" });
    expect(validateTranscriptionAudioPayload({
      audioBase64: "A".repeat(Math.ceil(((maxTranscriptionAudioBytes + 1) * 4) / 3)),
      mimeType: "audio/webm",
    })).toEqual({ ok: false, reason: "Audio file is too large" });
  });
});
