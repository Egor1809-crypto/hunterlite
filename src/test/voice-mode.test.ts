import { describe, expect, it } from "vitest";
import {
  audioFileNameForMimeType,
  extractSpeechRecognitionTranscript,
  maxTranscriptionAudioBytes,
  sanitizeSpeechText,
  isVoiceRecordingSupported,
  getBrowserSpeechRecognition,
  isBrowserSpeechRecognitionSupported,
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

  it("names recorded audio files according to their real mime type", () => {
    expect(audioFileNameForMimeType("audio/webm;codecs=opus")).toBe("speech.webm");
    expect(audioFileNameForMimeType("audio/mp4")).toBe("speech.m4a");
    expect(audioFileNameForMimeType("audio/wav")).toBe("speech.wav");
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

  it("detects whether browser recording APIs are available", () => {
    expect(isVoiceRecordingSupported(undefined, undefined)).toBe(false);
    expect(isVoiceRecordingSupported({ getUserMedia: async () => ({} as MediaStream) }, class {} as typeof MediaRecorder)).toBe(true);
  });

  it("detects browser speech recognition APIs for Chrome voice input", () => {
    class Recognition {}
    const scope = { webkitSpeechRecognition: Recognition };

    expect(getBrowserSpeechRecognition(scope as never)).toBe(Recognition);
    expect(isBrowserSpeechRecognitionSupported(scope as never)).toBe(true);
    expect(isBrowserSpeechRecognitionSupported({})).toBe(false);
  });

  it("extracts interim and final browser speech transcripts", () => {
    expect(extractSpeechRecognitionTranscript({
      resultIndex: 0,
      results: [
        { isFinal: false, 0: { transcript: "  здравствуйте " } },
        { isFinal: true, 0: { transcript: " у меня вопрос " } },
      ],
    })).toEqual({
      latestTranscript: "у меня вопрос",
      finalTranscript: "у меня вопрос",
    });
  });
});
