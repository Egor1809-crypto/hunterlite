import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiClientError } from "@/lib/api-client";
import { frontendApi } from "@/lib/frontend-api";
import { createLocalTrainingReply, defaultCallScripts } from "@/lib/default-training-content";
import { calculateTrainingResult } from "@/lib/training-logic";
import {
  audioFileNameForMimeType,
  getBrowserSpeechRecognition,
  isVoiceRecordingSupported,
  selectRecordingMimeType,
  type BrowserSpeechRecognition,
} from "@/lib/voice-mode";
import { Mic, Send, X, Sparkles, Bot, User, Clock, Target, ChevronUp, Loader2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { AiTrainingReplyRequestDto, CallScriptDto } from "@/lib/api-contracts";

type Props = { mode: "talk" | "exam" | "chat-test" };
type Msg = { from: "ai" | "user"; text: string; isSystem?: boolean };
const DEFAULT_SCRIPT_TOPIC = "Имущество должника";
const MIN_CONVERSATION_STEPS = 5;
const maxRecordingMs = 12_000;
const unsupportedMicMessage = "Этот браузер не даёт доступ к микрофону. Откройте платформу в Chrome или Safari по адресу 127.0.0.1:8080.";

type SessionInfoPanelProps = {
  mode: Props["mode"];
  topic: string;
  step: number;
  total: number;
  score: number;
  secs: number;
  fmt: (seconds: number) => string;
};

const blobToBase64 = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
};

const audioFromBase64 = (audioBase64: string, contentType: string) => {
  const binary = window.atob(audioBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
};

export default function SessionChat({ mode }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionIdParam = params.get("sessionId");
  const scriptId = params.get("scriptId");
  const topic = params.get("topic") ?? (mode === "chat-test" ? "Условия банкротства" : "Имущество должника");
  const { data: fetchedScripts = [], isLoading } = useQuery({
    queryKey: ["employee", "callScripts"],
    queryFn: () => frontendApi.getTrainingCallScripts(),
  });
  const usableScripts = fetchedScripts.filter((script) => (script.nodes?.length ?? 0) >= 2);
  const scripts = usableScripts.length ? usableScripts : defaultCallScripts;
  const selectedScriptId = scriptId ?? (
    sessionIdParam && scripts.some((script) => script.id === sessionIdParam) ? sessionIdParam : undefined
  );
  const sessionId = selectedScriptId === sessionIdParam ? undefined : sessionIdParam;
  const activeScript = (
    selectedScriptId ? scripts.find((script) => script.id === selectedScriptId) : scripts[0]
  ) as CallScriptDto | undefined;
  const nodes = useMemo(() => activeScript?.nodes ?? [], [activeScript?.nodes]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const [aiTyping, setAiTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [voiceMode, setVoiceMode] = useState(true);
  const [autoListen, setAutoListen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("Голос обрабатывается через внешний API.");
  const [secs, setSecs] = useState(mode === "exam" ? 30 * 60 : 0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [score, setScore] = useState(100);
  const [sessionMistakes, setSessionMistakes] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState(sessionId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const browserSpeechTimeoutRef = useRef<number | null>(null);
  const speakRef = useRef<(text: string) => void>(() => undefined);

  const total = Math.max(nodes.length, MIN_CONVERSATION_STEPS);

  const markMicUnsupported = () => {
    setMicSupported(false);
    setVoiceError(unsupportedMicMessage);
    setVoiceStatus("Микрофон недоступен в текущем браузере.");
  };

  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionId(sessionId);
    }
  }, [activeSessionId, sessionId]);

  useEffect(() => {
    if (isLoading || scripts.length === 0 || messages.length > 0 || aiTyping || step !== 0) return;

    const startKey = `${activeScript?.id ?? "fallback"}:${sessionId ?? "new"}`;
    if (startRef.current === startKey) return;
    startRef.current = startKey;

    let cancelled = false;

    const startScript = async () => {
      setAiTyping(true);

      let backendSessionId = sessionId && sessionId !== "demo-session" ? sessionId : undefined;

      if (!backendSessionId && selectedScriptId && activeScript) {
        const createSession = (sessionTopic: string) => frontendApi.createTrainingSession({
          topic: sessionTopic,
          mode: mode === "exam" ? "exam" : mode === "chat-test" ? "chat_test" : "talk",
          difficulty: "medium",
          format: "text",
          character: "anxious",
        });

        try {
          const created = await createSession(topic);
          backendSessionId = created.id;
        } catch {
          try {
            const created = await createSession(DEFAULT_SCRIPT_TOPIC);
            backendSessionId = created.id;
          } catch {
            backendSessionId = undefined;
          }
        }
      }

      if (cancelled) return;

      const initialMessage = nodes[0]?.clientReplica || "Здравствуйте!";
      setActiveSessionId(backendSessionId);
      setMessages([{ from: "ai", text: initialMessage }]);
      setAiTyping(false);
      speakRef.current(initialMessage);

      if (backendSessionId) {
        void frontendApi.addTrainingMessage(backendSessionId, { from: "ai", text: initialMessage }).catch(() => undefined);
      }
    };

    void startScript();

    return () => {
      cancelled = true;
    };
  }, [
    activeScript,
    aiTyping,
    isLoading,
    messages.length,
    mode,
    nodes,
    scripts.length,
    selectedScriptId,
    sessionId,
    step,
    topic,
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, aiTyping]);

  useEffect(() => {
    if (mode !== "exam") return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [mode]);

  useEffect(() => {
    const supported = isVoiceRecordingSupported(window.navigator?.mediaDevices, window.MediaRecorder);
    setMicSupported(supported);
    if (!supported) {
      markMicUnsupported();
    }
  }, []);

  useEffect(() => {
    return () => {
      speechRecognitionRef.current?.abort();
      recorderRef.current?.stop();
      if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current);
      if (browserSpeechTimeoutRef.current) window.clearTimeout(browserSpeechTimeoutRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const startBrowserSpeechRecognition = () => {
    const SpeechRecognition = getBrowserSpeechRecognition(window);
    if (!SpeechRecognition) return false;

    let transcript = "";
    let finished = false;
    const recognition = new SpeechRecognition();

    const clearSpeechTimeout = () => {
      if (browserSpeechTimeoutRef.current) {
        window.clearTimeout(browserSpeechTimeoutRef.current);
        browserSpeechTimeoutRef.current = null;
      }
    };

    const finishRecognition = (text?: string) => {
      if (finished) return;
      finished = true;
      clearSpeechTimeout();
      speechRecognitionRef.current = null;

      const recognizedText = text?.trim() || transcript.trim();
      if (recognizedText) {
        setInput(recognizedText);
        setVoiceStatus("Речь распознана. Проверьте текст и нажмите отправить.");
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      } else {
        setVoiceStatus("Браузер не дал текст, распознаём запись через внешний API.");
      }
    };

    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let finalText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        transcript = text;
        setInput(text);
        setVoiceStatus("Слышу речь, продолжаю распознавать.");
        if (result.isFinal) finalText += `${text} `;
      }

      if (finalText.trim()) finishRecognition(finalText);
    };
    recognition.onerror = (event) => {
      finished = true;
      clearSpeechTimeout();
      const error = event.error ?? "";
      speechRecognitionRef.current = null;
      setVoiceError(
        error === "not-allowed"
          ? "Доступ к распознаванию речи запрещён. Разрешите микрофон и распознавание в браузере."
          : "Браузер не дал текст, используем распознавание записи через внешний API.",
      );
      setVoiceStatus("Распознаём запись через внешний API.");
    };
    recognition.onend = () => {
      finishRecognition();
    };

    speechRecognitionRef.current = recognition;
    setVoiceError("");
    setVoiceStatus("Слушаю через браузер. Скажите ответ, текст появится в строке.");
    try {
      recognition.start();
    } catch {
      speechRecognitionRef.current = null;
      setVoiceStatus("Браузерное распознавание не запустилось, записываем через внешний API.");
      return false;
    }
    browserSpeechTimeoutRef.current = window.setTimeout(() => {
      speechRecognitionRef.current?.stop();
    }, maxRecordingMs);

    return true;
  };

  const speak = async (text: string) => {
    if (!voiceMode || typeof window === "undefined") return;

    const finishSpeech = () => {
      setSpeaking(false);
      setVoiceStatus(autoListen ? "Можно отвечать голосом." : "Озвучка завершена.");
      if (autoListen && !sessionEnded) {
        window.setTimeout(() => {
          void startRecording();
        }, 350);
      }
    };

    const speakWithBrowserVoice = () => {
      if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") return false;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      utterance.lang = "ru-RU";
      utterance.rate = 0.96;
      utterance.pitch = 1;
      utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith("ru")) ?? null;
      utterance.onstart = () => {
        setSpeaking(true);
        setVoiceStatus("Клиент говорит.");
      };
      utterance.onend = finishSpeech;
      utterance.onerror = () => {
        setSpeaking(false);
        setVoiceError("Озвучка клиента недоступна в браузере. Текстовый режим работает.");
        setVoiceStatus("Озвучка недоступна.");
      };
      window.speechSynthesis.speak(utterance);
      return true;
    };

    try {
      audioRef.current?.pause();
      const speech = await frontendApi.synthesizeSpeech({ text });
      const blob = audioFromBase64(speech.audioBase64, speech.contentType);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => {
        setSpeaking(true);
        setVoiceStatus("Клиент говорит.");
      };
      audio.onended = () => {
        URL.revokeObjectURL(url);
        finishSpeech();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (!speakWithBrowserVoice()) {
          setSpeaking(false);
          setVoiceError("Внешний API не смог озвучить ответ. Текстовый режим работает.");
          setVoiceStatus("Озвучка недоступна.");
        }
      };
      await audio.play();
    } catch {
      if (audioRef.current) {
        const failedAudio = audioRef.current;
        audioRef.current = null;
        window.setTimeout(() => URL.revokeObjectURL(failedAudio.src), 0);
      }
      if (!speakWithBrowserVoice()) {
        setSpeaking(false);
        setVoiceError("Голосовой API временно недоступен. Текстовый режим работает.");
        setVoiceStatus("Озвучка недоступна.");
      }
    }
  };

  speakRef.current = (text: string) => {
    void speak(text);
  };

  const toggleVoiceMode = () => {
    setVoiceMode((enabled) => {
      const next = !enabled;
      if (!next) {
        audioRef.current?.pause();
        setSpeaking(false);
        setAutoListen(false);
        recorderRef.current?.stop();
      }
      setVoiceStatus(next ? "Озвучка включена." : "Озвучка отключена.");
      return next;
    });
  };

  const startRecording = async () => {
    if (recording || processingVoice || speaking || aiTyping || sessionEnded || isLoading) return;
    if (!isVoiceRecordingSupported(window.navigator?.mediaDevices, window.MediaRecorder)) {
      if (startBrowserSpeechRecognition()) {
        setRecording(true);
        return;
      }

      markMicUnsupported();
      return;
    }

    try {
      setVoiceError("");
      setVoiceStatus("Запрашиваем микрофон.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = selectRecordingMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setVoiceError("Не удалось записать речь. Проверьте доступ к микрофону или введите ответ текстом.");
        setVoiceStatus("Запись остановлена.");
        setRecording(false);
      };
      recorder.onstop = () => {
        setRecording(false);
        speechRecognitionRef.current?.stop();
        if (recordingTimeoutRef.current) {
          window.clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());

        void (async () => {
          const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          if (audioBlob.size === 0) {
            setVoiceError("Запись пустая. Попробуйте ещё раз или введите ответ текстом.");
            setVoiceStatus("Голос не распознан.");
            return;
          }
          setProcessingVoice(true);
          setVoiceStatus(`Распознаём голос (${Math.round(audioBlob.size / 1024)} КБ).`);
          const transcription = await frontendApi.transcribeSpeech({
            audioBase64: await blobToBase64(audioBlob),
            mimeType: audioBlob.type || "audio/webm",
            fileName: audioFileNameForMimeType(audioBlob.type || "audio/webm"),
          });

          if (transcription.text) {
            setInput(transcription.text);
            setVoiceStatus("Речь распознана через внешний API. Проверьте текст и нажмите отправить.");
          } else {
            setVoiceError("Внешний API вернул пустую расшифровку. Попробуйте сказать ответ ближе к микрофону.");
            setVoiceStatus("Голос не распознан.");
          }
        })().catch((error) => {
          setVoiceError(
            error instanceof ApiClientError
              ? `STT: ${error.message}`
              : "Внешний API не смог распознать речь. Попробуйте ещё раз или введите ответ текстом.",
          );
          setVoiceStatus("Голос не распознан.");
        }).finally(() => {
          setProcessingVoice(false);
        });
      };
      recorderRef.current = recorder;
      recorder.start(250);
      recordingTimeoutRef.current = window.setTimeout(() => {
        recorderRef.current?.stop();
      }, maxRecordingMs);
      setRecording(true);
      const browserRecognitionStarted = startBrowserSpeechRecognition();
      setVoiceStatus(
        browserRecognitionStarted
          ? "Идёт запись. Говорите сейчас: текст появится в строке, отправку нажмёте сами."
          : "Идёт запись. Говорите сейчас, затем текст появится после распознавания внешним API.",
      );
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      setVoiceError(
        errorName === "NotAllowedError"
          ? "Доступ к микрофону запрещён. Разрешите микрофон в настройках браузера и нажмите кнопку ещё раз."
          : unsupportedMicMessage,
      );
      setVoiceStatus("Микрофон недоступен.");
      setRecording(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      speechRecognitionRef.current?.stop();
      recorderRef.current?.stop();
      setRecording(false);
      setVoiceStatus("Запись остановлена.");
      return;
    }

    await startRecording();
  };

  const send = async (overrideText?: string) => {
    if (sessionEnded) return;
    const text = overrideText || input.trim();
    if (!text) return;

    const sessionForPersistence = activeSessionId && activeSessionId !== "demo-session" ? activeSessionId : undefined;
    const userMessage: Msg = { from: "user", text };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setAiTyping(true);
    if (sessionForPersistence) {
      void frontendApi.addTrainingMessage(sessionForPersistence, { from: "user", text }).catch(() => undefined);
    }

    try {
      const nextStep = step + 1;
      const nextNode = nodes[nextStep];
      const trainingPayload: AiTrainingReplyRequestDto = {
        sessionId: sessionForPersistence,
        topic,
        mode: mode === "chat-test" ? "chat_test" : mode,
        step,
        totalSteps: total,
        userMessage: text,
        messages: [...messages, userMessage].map((message) => ({ from: message.from, text: message.text })),
        scriptContext: {
          title,
          nextClientReplica: nextNode?.clientReplica,
          keywordRules: nextNode?.keywordRules,
        },
      };
      const ai = await frontendApi.generateTrainingReply(trainingPayload).catch(() => createLocalTrainingReply(trainingPayload));
      const aiMessage = ai.reply;

      if (ai.scoreDelta > 0) {
        setScore((currentScore) => Math.max(0, currentScore - ai.scoreDelta));
      }
      if (ai.mistakes.length > 0) {
        setSessionMistakes((currentMistakes) => [...currentMistakes, ...ai.mistakes]);
      }

      const shouldContinue = !ai.sessionEnded && nextStep < total;

      if (shouldContinue) {
        setMessages((m) => [...m, { from: "ai", text: aiMessage }]);
        setStep(nextStep);
      } else {
        setMessages((m) => [...m, { from: "ai", text: aiMessage, isSystem: true }]);
        setSessionEnded(true);
      }
      if (sessionForPersistence) {
        void frontendApi.addTrainingMessage(sessionForPersistence, { from: "ai", text: aiMessage }).catch(() => undefined);
      }
      void speak(aiMessage);
    } catch {
      const nextStep = step + 1;
      const nextNode = nodes[nextStep];
      const fallback = createLocalTrainingReply({
        sessionId: sessionForPersistence,
        topic,
        mode: mode === "chat-test" ? "chat_test" : mode,
        step,
        totalSteps: total,
        userMessage: text,
        messages: [...messages, userMessage].map((message) => ({ from: message.from, text: message.text })),
        scriptContext: {
          title,
          nextClientReplica: nextNode?.clientReplica,
          keywordRules: nextNode?.keywordRules,
        },
      });
      const shouldContinue = !fallback.sessionEnded && nextStep < total;

      setMessages((m) => [...m, { from: "ai", text: fallback.reply, isSystem: !shouldContinue }]);
      if (shouldContinue) {
        setStep(nextStep);
      } else {
        setSessionEnded(true);
      }
      setVoiceError("Внешний API временно недоступен, включён локальный сценарий тренировки.");
      void speak(fallback.reply);
    } finally {
      setAiTyping(false);
    }
  };

  const finish = async () => {
    const resultSessionId = activeSessionId && activeSessionId !== "demo-session" ? activeSessionId : undefined;
    const result = calculateTrainingResult({
      score,
      mistakes: sessionMistakes,
      answeredSteps: step + 1,
      totalSteps: total,
    });

    if (resultSessionId) {
      await frontendApi.completeTrainingSession(resultSessionId, {
        score: result.score,
        criteria: result.criteria,
        mistakes: result.mistakes,
        recommendations: result.recommendations,
      }).catch(() => undefined);
    }

    const resultParams = new URLSearchParams({ score: String(result.score) });
    if (mode === "exam") resultParams.set("mode", "exam");
    if (resultSessionId) resultParams.set("sessionId", resultSessionId);

    navigate(`/session/result?${resultParams.toString()}`, {
      state: {
        mistakes: result.mistakes,
        recommendations: result.recommendations,
      }
    });
  };

  const title = activeScript?.title || "Симуляция звонка";

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border bg-background">
        {/* Top bar */}
        <div className="px-4 md:px-6 py-3 border-b border-border bg-card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {mode === "exam" ? "Экзамен" : mode === "chat-test" ? "Чат-тест" : "Тренировка"}
            </div>
            <div className="font-display font-bold text-primary truncate">{title}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mode === "exam" && (
              <StatusBadge variant={secs < 300 ? "destructive" : "info"} className="font-mono">
                <Clock className="h-3 w-3" /> {fmt(secs)}
              </StatusBadge>
            )}
            <button
              className="lg:hidden p-2 rounded-lg border border-border"
              onClick={() => setPanelOpen(true)}
              aria-label="Информация о сессии"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <Button variant="ghost" size="sm" onClick={() => void finish()} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4 mr-1" /> Завершить
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Загрузка сценария...
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <Bubble key={i} m={m} />
              ))}
          {aiTyping && (
            <div className="flex gap-3 max-w-3xl">
              <Avatar from="ai" />
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-card">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse-soft" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse-soft [animation-delay:0.2s]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse-soft [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
          {sessionEnded && (
            <div className="max-w-3xl mx-auto flex justify-center">
              <Button onClick={() => void finish()} className="bg-primary text-primary-foreground shadow-lg">
                Посмотреть результаты симуляции
              </Button>
            </div>
          )}
          </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border bg-card p-3 md:p-4">
          <div className="flex items-end gap-2 max-w-3xl">
            <button
              onClick={() => void toggleRecording()}
              className={cn(
                "h-11 w-11 rounded-xl border flex items-center justify-center transition-colors shrink-0",
                recording
                  ? "bg-destructive text-destructive-foreground border-destructive animate-pulse-soft"
                  : "border-border hover:bg-muted"
              )}
              aria-label="Микрофон"
              title={recording ? "Остановить запись" : "Записать ответ"}
              disabled={!micSupported || processingVoice || speaking || aiTyping || sessionEnded || isLoading}
            >
              {processingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleVoiceMode}
              className={cn(
                "h-11 w-11 rounded-xl border flex items-center justify-center transition-colors shrink-0",
                voiceMode
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border hover:bg-muted text-muted-foreground"
              )}
              aria-label={voiceMode ? "Отключить озвучку клиента" : "Включить озвучку клиента"}
              title={voiceMode ? "Отключить озвучку клиента" : "Включить озвучку клиента"}
            >
              {voiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setAutoListen((enabled) => !enabled)}
              className={cn(
                "h-11 px-3 rounded-xl border text-xs font-semibold transition-colors shrink-0",
                autoListen
                  ? "border-success bg-success-soft text-success-soft-foreground"
                  : "border-border hover:bg-muted text-muted-foreground"
              )}
              aria-label={autoListen ? "Отключить автоответ голосом" : "Включить автоответ голосом"}
              title={autoListen ? "Автоответ включён" : "Автоответ выключен"}
              disabled={!voiceMode}
            >
              AUTO
            </button>
            <Input
              placeholder={recording ? "Говорите…" : "Ответьте клиенту…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              className="h-11 bg-black/50"
              disabled={aiTyping || sessionEnded || isLoading || recording}
            />
            <Button onClick={() => void send()} className="h-11 bg-primary hover:bg-primary/90 px-4" disabled={aiTyping || sessionEnded || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2 max-w-3xl">
            {recording && (
              <span className="flex items-center gap-1.5 text-destructive font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" /> Идёт запись
              </span>
            )}
            {speaking && (
              <span className="flex items-center gap-1.5 text-accent font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> Клиент говорит
              </span>
            )}
            {processingVoice && (
              <span className="flex items-center gap-1.5 text-accent font-medium">
                <Loader2 className="h-3 w-3 animate-spin" /> Распознавание
              </span>
            )}
            <span>{voiceError || voiceStatus}</span>
          </div>
        </div>
      </div>

      {/* Right panel desktop */}
      <aside className="hidden lg:flex w-[340px] shrink-0 flex-col bg-card overflow-y-auto">
        <SessionInfoPanel mode={mode} topic={topic} step={step} total={total} score={score} secs={secs} fmt={fmt} />
      </aside>

      {/* Mobile drawer */}
      {panelOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur" onClick={() => setPanelOpen(false)}>
          <div className="absolute bottom-0 inset-x-0 max-h-[80vh] overflow-y-auto bg-card rounded-t-2xl border-t border-border shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 flex justify-center"><div className="h-1 w-10 rounded-full bg-muted" /></div>
            <SessionInfoPanel mode={mode} topic={topic} step={step} total={total} score={score} secs={secs} fmt={fmt} />
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const isAi = m.from === "ai";
  return (
    <div className={cn("flex gap-3 max-w-3xl", !isAi && "ml-auto flex-row-reverse")}>
      <Avatar from={m.from} />
      <div
        className={cn(
          "rounded-2xl px-4 py-3 shadow-card",
          m.isSystem 
            ? "bg-transparent border border-dashed border-white/20 text-center mx-auto" 
            : isAi
              ? "bg-card border border-border rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
        )}
      >
        {!m.isSystem && (
          <div className={cn("text-[11px] font-semibold uppercase tracking-wider mb-1", isAi ? "text-muted-foreground" : "text-primary-foreground/60")}>
            {isAi ? "Клиент" : "Вы"}
          </div>
        )}
        <div className="text-sm leading-relaxed">{m.text}</div>
      </div>
    </div>
  );
}

function Avatar({ from }: { from: "ai" | "user" }) {
  return (
    <div
      className={cn(
        "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
        from === "ai" ? "bg-ai-soft text-ai-soft-foreground" : "bg-primary text-primary-foreground"
      )}
    >
      {from === "ai" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
    </div>
  );
}

function SessionInfoPanel({ mode, topic, step, total, score, secs, fmt }: SessionInfoPanelProps) {
  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Тема</div>
        <div className="font-semibold text-primary mt-1">{topic}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Уровень: средний</div>
      </div>

      {mode === "exam" && (
        <Card className="p-4 bg-primary text-primary-foreground border-0">
          <div className="text-xs uppercase tracking-wider opacity-70 font-semibold">Таймер экзамена</div>
          <div className="text-pixel-number text-3xl mt-1 tabular-nums">{fmt(secs)}</div>
          <div className="text-xs opacity-70 mt-1">Проходной балл — <span className="text-pixel-inline">88<span className="text-pixel-inline-muted">%</span></span></div>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Прогресс</span>
          <span className="text-xs font-semibold">{Math.min(step, total)} из {total}</span>
        </div>
        <Progress value={(Math.min(step, total) / total) * 100} className="h-1.5" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Текущий балл</span>
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-pixel-number text-3xl">{score}</span>
          <span className="text-pixel-inline-muted text-sm">/100</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            { l: "Правильность", v: 88 },
            { l: "Полнота", v: 72 },
            { l: "Понятность", v: 84 },
            { l: "Тон", v: 90 },
            { l: "Безопасность", v: 70 },
          ].map((s) => (
            <div key={s.l}>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{s.l}</span><span>{s.v}</span>
              </div>
              <Progress value={s.v} className="h-1" />
            </div>
          ))}
        </div>
      </Card>

      <div>
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Статус ИИ-клиента</div>
        <StatusBadge variant="warning" dot>Тревожный · сомневается</StatusBadge>
      </div>

      <Card className="p-3 bg-ai-soft border-ai/20">
        <div className="flex gap-2">
          <Sparkles className="h-4 w-4 text-ai-soft-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-ai-soft-foreground">
            <span className="font-semibold">ИИ:</span> оценивает ответ через внешний API.
          </div>
        </div>
      </Card>
    </div>
  );
}
