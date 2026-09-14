"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EnergyStatus } from "@/components/layout/EnergyStatus";
import AuthLayout from "@/components/layout/AuthLayout";
import { CallWorkspace } from "@/components/training/CallWorkspace";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useCallConnection } from "@/hooks/useCallConnection";
import { useTTS } from "@/hooks/useTTS";

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
    <AuthLayout focusMode>
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
  const [clientAge, setClientAge] = useState<number | null>(null);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const previewSequence = useRef(0);
  const receivedSequence = useRef(0);
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
  const send = useRef<(message: unknown) => boolean>(() => false);
  const stopAndSendRef = useRef<() => Promise<void>>(async () => {});
  const mic = useMicrophone({
    onPreview: (blob) => {
      if (!recordingRef.current || endingRef.current) return;
      const currentTurn = turn.current;
      const sequence = ++previewSequence.current;
      void base64(blob)
        .then((audio) => {
          if (
            recordingRef.current &&
            !endingRef.current &&
            currentTurn === turn.current
          )
            send.current({
              type: "audio_preview",
              data: { audio_b64: audio, turn_id: currentTurn, sequence },
            });
        })
        .catch(() => setPreviewUnavailable(true));
    },
    onPreviewUnavailable: () => setPreviewUnavailable(true),
    onSilenceTimeout: () => {
      void stopAndSendRef.current();
    },
  });
  const micRef = useRef(mic);
  micRef.current = mic;

  const addLine = useCallback((line: Line) => {
    transcript.current = [...transcript.current, line];
    setLines(transcript.current);
  }, []);
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
          const card = d.client_card as
            | { age?: number; portrait_url?: string }
            | undefined;
          setClientAge(card?.age || null);
          setPortrait(card?.portrait_url || null);
          transcript.current = Array.isArray(d.history)
            ? (d.history as Line[])
            : [];
          setLines(transcript.current);
          break;
        }
        case "transcript_partial":
          if (
            recordingRef.current &&
            Number(d.sequence) > receivedSequence.current
          ) {
            receivedSequence.current = Number(d.sequence);
            if (d.text) setDraft(String(d.text));
            setPreviewUnavailable(false);
          }
          break;
        case "transcript_partial_unavailable":
          if (
            recordingRef.current &&
            Number(d.sequence) > receivedSequence.current
          )
            setPreviewUnavailable(true);
          break;
        case "transcript":
          setDraft("");
          addLine({ role: "user", content: String(d.text || "") });
          break;
        case "sentence": {
          const index = Number(d.index || 0);
          if (index === 0) ttsRef.current.stop();
          const previous = transcript.current.at(-1);
          if (index > 0 && previous?.role === "assistant") {
            transcript.current = [
              ...transcript.current.slice(0, -1),
              {
                role: "assistant",
                content: `${previous.content} ${String(d.text || "")}`,
              },
            ];
            setLines(transcript.current);
          } else addLine({ role: "assistant", content: String(d.text || "") });
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
    [addLine, goToResults],
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
    previewSequence.current = 0;
    receivedSequence.current = 0;
    setDraft("");
    setPreviewUnavailable(false);
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
      ttsRef.current.stop();
    },
    [],
  );


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
          Начать звонок
        </button>
        <button
          className="call-secondary"
          onClick={() => router.push("/training?tab=builder")}
        >
          К клиентам
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
    <CallWorkspace
      energyStatus={<EnergyStatus />}
      name={clientName}
      age={clientAge}
      portrait={portrait}
      lines={lines}
      draft={draft}
      previewUnavailable={previewUnavailable}
      recording={recording}
      processing={thinking && !!draft}
      status={status}
      stage={stage}
      onStage={setStage}
      onSpeak={() => void toggleRecording()}
      onEnd={() => void endCall()}
      disabled={ending || clientHungUp || !connected || micBusy}
      ending={ending}
      micBusy={micBusy}
      audioLevel={mic.audioLevel}
      notice={
        error ? (
          <div role="alert">
            {error}
            <button onClick={() => setError("")} className="ml-3 underline">
              Закрыть
            </button>
          </div>
        ) : undefined
      }
      unlockAudio={tts.needsAudioUnlock ? () => void tts.unlock() : undefined}
    />
  );
}
