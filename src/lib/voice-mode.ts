export const maxTranscriptionAudioBytes = 8 * 1024 * 1024;
export const maxSpeechTextChars = 1_800;

export const recordingMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

export const allowedTranscriptionMimeTypes = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
] as const;

export const sanitizeSpeechText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxSpeechTextChars);

const base64ByteLength = (value: string) => {
  const normalized = value.replace(/\s/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;

  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
};

export const isAllowedTranscriptionMimeType = (mimeType: string) =>
  allowedTranscriptionMimeTypes.some((allowed) => mimeType.toLowerCase().startsWith(allowed));

export const validateTranscriptionAudioPayload = ({
  audioBase64,
  mimeType,
}: {
  audioBase64?: string;
  mimeType?: string;
}) => {
  if (!audioBase64?.trim() || !mimeType?.trim()) {
    return { ok: false, reason: "Audio payload is required" } as const;
  }

  if (!isAllowedTranscriptionMimeType(mimeType)) {
    return { ok: false, reason: "Unsupported audio format" } as const;
  }

  if (base64ByteLength(audioBase64) > maxTranscriptionAudioBytes) {
    return { ok: false, reason: "Audio file is too large" } as const;
  }

  return { ok: true } as const;
};

export const selectRecordingMimeType = (isTypeSupported?: (mimeType: string) => boolean) => {
  if (!isTypeSupported) return "";

  return recordingMimeTypes.find((mimeType) => isTypeSupported(mimeType)) ?? "";
};
