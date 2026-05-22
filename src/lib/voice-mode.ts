export const maxTranscriptionAudioBytes = 8 * 1024 * 1024;
export const maxSpeechTextChars = 1_800;

export type BrowserSpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: { transcript?: string };
  }>;
};

export type BrowserSpeechRecognitionErrorEvent = {
  error?: string;
};

export type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type SpeechRecognitionScope = {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

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

export const audioFileExtensionForMimeType = (mimeType: string) => {
  const normalized = mimeType.toLowerCase();

  if (normalized.startsWith("audio/webm")) return "webm";
  if (normalized.startsWith("audio/ogg")) return "ogg";
  if (normalized.startsWith("audio/mp4") || normalized.startsWith("audio/m4a")) return "m4a";
  if (normalized.startsWith("audio/mpeg")) return "mp3";
  if (normalized.startsWith("audio/wav") || normalized.startsWith("audio/x-wav")) return "wav";

  return "webm";
};

export const audioFileNameForMimeType = (mimeType: string) =>
  `speech.${audioFileExtensionForMimeType(mimeType)}`;

export const isVoiceRecordingSupported = (
  mediaDevices?: Pick<MediaDevices, "getUserMedia">,
  mediaRecorder?: typeof MediaRecorder,
) => Boolean(mediaDevices?.getUserMedia && mediaRecorder);

export const getBrowserSpeechRecognition = (scope?: SpeechRecognitionScope) => {
  const speechScope = scope ?? (typeof window === "undefined" ? undefined : window as SpeechRecognitionScope);

  return speechScope?.SpeechRecognition ?? speechScope?.webkitSpeechRecognition;
};

export const isBrowserSpeechRecognitionSupported = (scope?: SpeechRecognitionScope) =>
  Boolean(getBrowserSpeechRecognition(scope));

export const extractSpeechRecognitionTranscript = (event: BrowserSpeechRecognitionResultEvent) => {
  const finalParts: string[] = [];
  let latestTranscript = "";

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    const text = result[0]?.transcript?.trim();

    if (!text) continue;
    latestTranscript = text;
    if (result.isFinal) finalParts.push(text);
  }

  return {
    latestTranscript,
    finalTranscript: finalParts.join(" ").trim(),
  };
};
