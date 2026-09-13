"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";
import { Mic, Square, PhoneOff, Loader2 } from "lucide-react";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useCallConnection } from "@/hooks/useCallConnection";
import { useTTS } from "@/hooks/useTTS";
import { useSessionStore } from "@/stores/useSessionStore";
import { STAGE_GUIDANCE } from "@/lib/script_guidance";
import ScriptPanel from "@/components/training/ScriptPanel";
import { api } from "@/lib/api";
import type { WSMessage } from "@/types";

type Line = { role: "user" | "assistant"; content: string };
function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать запись"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(blob);
  });
}

export default function CallPage() {
  return (
    <AuthLayout>
      <CallScreen />
    </AuthLayout>
  );
}

function CallScreen() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [ending, setEnding] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [clientName, setClientName] = useState("Клиент");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(1);
  const [clientHungUp, setClientHungUp] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const tts = useTTS({ phoneBandFilter: true });
  const ttsRef = useRef(tts);
  ttsRef.current = tts;
  const recordingRef = useRef(false);
  const operationRef = useRef(false);
  const endingRef = useRef(false);
  const turn = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const transcript = useRef<Line[]>([]);
  const hintsAbort = useRef<AbortController | null>(null);
  const send = useRef<(message: unknown) => boolean>(() => false);
  const stopAndSendRef = useRef<() => Promise<void>>(async () => {});
  const mic = useMicrophone({
    onSilenceTimeout: () => {
      void stopAndSendRef.current();
    },
  });
  const micRef = useRef(mic);
  micRef.current = mic;
  const hints = useSessionStore((s) => s.scriptHints);

  const addLine = useCallback((line: Line) => {
    transcript.current = [...transcript.current, line];
    setLines(transcript.current);
  }, []);
  const fetchHints = useCallback(() => {
    hintsAbort.current?.abort();
    const controller = new AbortController();
    hintsAbort.current = controller;
    api
      .post<{ hints: { text: string; label?: string }[] }>(
        `/training/sessions/${id}/script-hints`,
        { history: transcript.current.slice(-6) },
        { signal: controller.signal },
      )
      .then((result) => {
        if (!controller.signal.aborted)
          useSessionStore
            .getState()
            .setScriptHints(result.hints?.slice(0, 3) || []);
      })
      .catch(() => {});
  }, [id]);
  const goToResults = useCallback(() => {
    clearTimeout(timeout.current);
    endingRef.current = true;
    ttsRef.current.stop();
    router.replace(`/results/${id}`);
  }, [id, router]);
  const endCall = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    setThinking(false);
    ttsRef.current.stop();
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
      await micRef.current.stopRecording();
    }
    if (!send.current({ type: "end_call" })) {
      endingRef.current = false;
      setEnding(false);
      setError(
        "Соединение потеряно. Дождитесь восстановления связи и завершите звонок ещё раз.",
      );
      return;
    }
    timeout.current = setTimeout(goToResults, 30_000);
  }, [goToResults]);
  const onMessage = useCallback(
    (raw: WSMessage) => {
      const { type, data } = raw as {
        type: string;
        data?: Record<string, unknown>;
      };
      const d = data || {};
      if (typeof d.turn_id === "number" && d.turn_id !== turn.current) return;
      if (endingRef.current && type !== "score" && type !== "error") return;
      switch (type) {
        case "ready": {
          ttsRef.current.stop();
          setThinking(false);
          setClientName(String(d.client_name || "Клиент"));
          transcript.current = Array.isArray(d.history)
            ? (d.history as Line[])
            : [];
          setLines(transcript.current);
          fetchHints();
          break;
        }
        case "transcript":
          addLine({ role: "user", content: String(d.text || "") });
          break;
        case "sentence": {
          const index = Number(d.index || 0);
          if (index === 0) ttsRef.current.stop();
          addLine({ role: "assistant", content: String(d.text || "") });
          // Keep empty chunks too: the player advances their sequence numbers.
          ttsRef.current.queueAudioChunk({
            audio: String(d.audio_b64 || ""),
            index,
            isLast: false,
          });
          break;
        }
        case "turn_end":
          setThinking(false);
          fetchHints();
          break;
        case "client_hangup":
          setThinking(false);
          // Finalize through the server even when the character hangs up.
          setClientHungUp(true);
          break;
        case "score":
          goToResults();
          break;
        case "error":
          setError(
            String(
              d.message || "Не удалось обработать реплику. Попробуйте ещё раз.",
            ),
          );
          break;
      }
    },
    [addLine, fetchHints, goToResults],
  );
  useEffect(() => {
    if (!clientHungUp) return;
    if (!tts.speaking && !tts.needsAudioUnlock) {
      void endCall();
      return;
    }
    const timer = setTimeout(() => void endCall(), 30000);
    return () => clearTimeout(timer);
  }, [clientHungUp, tts.speaking, tts.needsAudioUnlock, endCall]);
  const { connected, sendMessage } = useCallConnection(
    accepted ? id : null,
    onMessage,
  );
  send.current = sendMessage;
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  const stopAndSend = useCallback(async () => {
    if (!recordingRef.current || operationRef.current || endingRef.current)
      return;
    operationRef.current = true;
    setMicBusy(true);
    recordingRef.current = false;
    setRecording(false);
    try {
      const blob = await micRef.current.stopRecording();
      if (!blob || blob.size < 300) {
        setError(
          "Запись слишком короткая. Нажмите «Говорить» и произнесите реплику.",
        );
        return;
      }
      if (endingRef.current) return;
      const audio = await base64(blob);
      setThinking(true);
      if (
        !send.current({
          type: "audio",
          data: { audio_b64: audio, mime: blob.type, turn_id: turn.current },
        })
      ) {
        setThinking(false);
        setError(
          "Соединение потеряно. После восстановления повторите последнюю реплику.",
        );
      }
    } catch (err) {
      setThinking(false);
      setError(
        err instanceof Error ? err.message : "Не удалось отправить запись.",
      );
    } finally {
      operationRef.current = false;
      setMicBusy(false);
    }
  }, []);
  stopAndSendRef.current = stopAndSend;
  const toggleRecording = async () => {
    if (recordingRef.current) {
      await stopAndSend();
      return;
    }
    if (!connected || endingRef.current || operationRef.current) return;
    operationRef.current = true;
    setMicBusy(true);
    setError("");
    // Invalidate old audio before requesting permission or awaiting the device.
    turn.current += 1;
    ttsRef.current.stop();
    send.current({ type: "interrupt" });
    setThinking(false);
    try {
      const ok = await micRef.current.startRecording();
      if (endingRef.current || !connectedRef.current) {
        await micRef.current.stopRecording();
        return;
      }
      if (!ok) {
        setError(
          "Не удалось включить микрофон. Проверьте разрешение в браузере и выбранное устройство.",
        );
        return;
      }
      recordingRef.current = true;
      setRecording(true);
    } finally {
      operationRef.current = false;
      setMicBusy(false);
    }
  };
  useEffect(() => {
    if (!connected) {
      ttsRef.current.stop();
      setThinking(false);
      if (recordingRef.current) {
        recordingRef.current = false;
        setRecording(false);
        void micRef.current.stopRecording();
      }
    }
  }, [connected]);
  useEffect(
    () => () => {
      clearTimeout(timeout.current);
      hintsAbort.current?.abort();
      ttsRef.current.stop();
    },
    [],
  );
  useEffect(() => {
    const guide = STAGE_GUIDANCE[stage - 1];
    useSessionStore
      .getState()
      .setStageUpdate({
        stage_number: stage,
        stage_name: guide.key,
        stage_label: guide.label_ru,
        total_stages: STAGE_GUIDANCE.length,
        stages_completed: [],
        stage_scores: {},
        confidence: 0,
      });
  }, [stage]);

  if (!accepted)
    return (
      <main
        className="min-h-dvh flex flex-col items-center justify-center gap-8 px-6"
        style={{ background: "var(--bg-primary)" }}
      >
        <h1 className="font-display text-4xl tracking-tight">Звонок клиенту</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          «Говорить» — записать реплику, «Стоп» — отправить.
        </p>
        <button
          className="call-primary"
          onClick={async () => {
            tts.unlock();
            setAccepted(true);
          }}
        >
          Ответить
        </button>
      </main>
    );
  const status = ending
    ? "Завершаю звонок…"
    : !connected
      ? "Восстанавливаю соединение…"
      : recording
        ? "Записываю вашу реплику"
        : tts.speaking
          ? `Говорит ${clientName}`
          : thinking
            ? "Готовлю ответ…"
            : "Можно говорить";
  return (
    <main className="call-page">
      <header className="mb-10">
        <h1 className="font-display text-4xl sm:text-6xl tracking-tight">
          Звонок клиенту
        </h1>
        <p className="mt-4" style={{ color: "var(--text-secondary)" }}>
          Практика разговора с учебным клиентом
        </p>
      </header>
      <div className="call-layout">
        <section className="call-dialogue">
          <div className="call-person" aria-hidden="true">
            {clientName
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")}
          </div>
          <h2 className="font-display text-3xl text-center">{clientName}</h2>
          <p
            role="status"
            className="my-6 text-center"
            style={{ color: "var(--primary)" }}
          >
            {status}
          </p>
          {recording && (
            <meter
              className="w-full h-2"
              min={0}
              max={100}
              value={mic.audioLevel}
              aria-label="Уровень микрофона"
            />
          )}
          <div className="flex justify-center flex-wrap gap-3 my-6">
            <button
              onClick={toggleRecording}
              disabled={ending || clientHungUp || !connected || micBusy}
              aria-pressed={recording}
              className="call-primary"
            >
              {micBusy ? (
                <Loader2 size={20} className="animate-spin" />
              ) : recording ? (
                <Square size={20} />
              ) : (
                <Mic size={20} />
              )}
              {recording ? "Стоп" : "Говорить"}
            </button>
            <button
              onClick={() => void endCall()}
              disabled={ending}
              className="call-secondary"
            >
              <PhoneOff size={20} />
              {ending ? "Завершаю…" : "Завершить"}
            </button>
          </div>
          {error && (
            <div role="alert" className="call-notice">
              {error}
              <button onClick={() => setError("")} className="ml-3 underline">
                Закрыть
              </button>
            </div>
          )}
          {tts.needsAudioUnlock && (
            <button
              className="call-secondary"
              onClick={() => void tts.unlock()}
            >
              Включить звук
            </button>
          )}
          <p
            className="text-sm text-center"
            style={{ color: "var(--text-secondary)" }}
          >
            Чтобы остановить ответ клиента и задать новый вопрос, нажмите
            «Говорить».
          </p>
          <div
            className="mt-8 pt-6 border-t"
            style={{ borderColor: "var(--border-color)" }}
          >
            <h3 className="font-display text-xl mb-5">Текст разговора</h3>
            {lines.length === 0 ? (
              <p style={{ color: "var(--text-secondary)" }}>
                Здесь появятся распознанные реплики и ответы клиента.
              </p>
            ) : (
              lines.map((line, i) => (
                <div key={i} className="mb-5">
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {line.role === "user" ? "Вы" : clientName}
                  </span>
                  <p className="mt-1 leading-relaxed">{line.content}</p>
                </div>
              ))
            )}
          </div>
        </section>
        <aside className="call-guide">
          <h2 className="font-display text-2xl mb-3">План разговора</h2>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Выберите этап для подсказок. Результат оценивается после звонка.
          </p>
          <label className="block text-sm mb-5">
            Текущий этап
            <select
              className="w-full mt-2 p-3 rounded-lg"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
              }}
              value={stage}
              onChange={(e) => setStage(Number(e.target.value))}
            >
              {STAGE_GUIDANCE.map((g, i) => (
                <option key={g.key} value={i + 1}>
                  {g.label_ru}
                </option>
              ))}
            </select>
          </label>
          <ScriptPanel compactHeader />
          {hints.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Что сказать дальше</h3>
              {hints.map((h, i) => (
                <p key={i} className="call-notice mb-2 text-sm">
                  {h.text}
                </p>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
