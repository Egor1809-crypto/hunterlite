"use client";

/**
 * `/training/[id]/call` — clean push-to-talk call page (CALL_REBUILD_TZ §8).
 *
 * Stream cascade transport only:
 *   - capture: useMicrophone (one webm Blob per turn — no VAD)
 *   - transport: useWebSocket (/ws/call — auth/reconnect/heartbeat handled)
 *   - playback: useTTS (ordered MP3 queue, phone-band timbre)
 *
 * Turn-taking is explicit toggle ("Говорить" → "Стоп"). No VAD, no
 * one-turn-lock, no watchdog, no ringback, no emotion FSM, no coaching UI.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, Square, PhoneOff, Loader2 } from "lucide-react";

import { useMicrophone } from "@/hooks/useMicrophone";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTTS } from "@/hooks/useTTS";
import type { WSMessage } from "@/types";
import ScriptPanel from "@/components/training/ScriptPanel";
import ScriptDrawer from "@/components/training/ScriptDrawer";
import { useSessionStore } from "@/stores/useSessionStore";
import { STAGE_GUIDANCE } from "@/lib/script_guidance";

type Status = "idle" | "recording" | "thinking" | "speaking";

const MIN_BLOB_BYTES = 1500;
const END_CALL_FALLBACK_MS = 25_000;

/** Encode a Blob to bare base64 (no data: prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result).split(",")[1] || "");
    r.readAsDataURL(blob);
  });
}

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const mic = useMicrophone({});
  const tts = useTTS({ phoneBandFilter: true });

  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [clientName, setClientName] = useState("");
  const [recording, setRecording] = useState(false);
  const [caption, setCaption] = useState("");
  const [ending, setEnding] = useState(false);

  // ---------------------------------------------------------------------------
  // Script guide (right-side panel): walk the learner through the 7 stages.
  // The rebuilt /ws/call backend doesn't emit stage events, so we advance the
  // guide locally — reset to stage 1 on accept, +1 per sent user turn. The
  // panel content (task / examples / mistakes) is read from script_guidance.
  // ---------------------------------------------------------------------------
  const setStageUpdate = useSessionStore((s) => s.setStageUpdate);
  const goToStage = useCallback(
    (n: number) => {
      const total = STAGE_GUIDANCE.length; // 7
      const clamped = Math.max(1, Math.min(n, total));
      const g = STAGE_GUIDANCE[clamped - 1];
      setStageUpdate({
        stage_number: clamped,
        stage_name: g.key,
        stage_label: g.label_ru,
        total_stages: total,
        stages_completed: Array.from({ length: clamped - 1 }, (_, i) => i + 1),
        stage_scores: {},
        confidence: 1,
      });
    },
    [setStageUpdate],
  );

  // Single idempotent redirect to results — every terminal path funnels here.
  const redirectedRef = useRef(false);
  const goToResults = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    tts.stop();
    router.replace(`/results/${id}`);
  }, [id, router, tts]);

  // ---------------------------------------------------------------------------
  // WS message handler — mirrors the server contract (CALL_REBUILD_TZ §4.1).
  // ---------------------------------------------------------------------------
  const onMessage = useCallback(
    (raw: WSMessage) => {
      const { type, data } = raw as { type: string; data?: Record<string, unknown> };
      const d = data ?? {};
      switch (type) {
        case "ready":
          setClientName((d.client_name as string) || "Клиент");
          setStatus("idle");
          break;
        case "filler":
          if (d.audio_b64) tts.playAudioMessage({ audio: d.audio_b64 as string });
          break;
        case "transcript":
          if (d.role === "user") setCaption((d.text as string) || "");
          break;
        case "sentence": {
          setStatus("speaking");
          const sentenceIdx = Number(d.index ?? 0);
          // Filler→reply coordination: the filler plays via playAudioMessage on
          // a SEPARATE path from this sentence chunk queue, so a longer filler
          // would keep sounding UNDER the first reply sentence (two voices at
          // once). Stop it on the first sentence so the real voice takes over
          // cleanly. Nothing is queued at index 0 yet, so stop() drops nothing.
          if (sentenceIdx === 0) tts.stop();
          tts.queueAudioChunk({
            audio: (d.audio_b64 as string) || "",
            index: sentenceIdx,
            isLast: false,
          });
          break;
        }
        case "turn_end":
          setStatus("idle");
          break;
        case "client_hangup":
          goToResults();
          break;
        case "score":
          goToResults();
          break;
        case "error":
          toast.error((d.message as string) || "Ошибка звонка");
          break;
        default:
          break;
      }
    },
    [tts, goToResults],
  );

  const { sendMessage } = useWebSocket({
    path: "/ws/call",
    sessionId: id,
    autoConnect: true,
    onMessage,
  });

  // ---------------------------------------------------------------------------
  // Accept the call: the single autoplay-unlock gesture, then start session.
  // ---------------------------------------------------------------------------
  const handleAccept = useCallback(async () => {
    try {
      await tts.unlock();
    } catch {
      /* unlock is best-effort */
    }
    setAccepted(true);
    goToStage(1); // start the script guide at stage 1
    sendMessage({ type: "start", data: { session_id: id } });
  }, [tts, sendMessage, id, goToStage]);

  // ---------------------------------------------------------------------------
  // Push-to-talk toggle: click starts capture, click again sends the turn.
  // ---------------------------------------------------------------------------
  const handleTalkToggle = useCallback(async () => {
    if (ending) return;
    if (!recording) {
      const ok = await mic.startRecording();
      if (!ok) {
        toast.error("Нет доступа к микрофону");
        return;
      }
      setRecording(true);
      setStatus("recording");
      return;
    }

    // Stop and ship the turn.
    setRecording(false);
    const blob = await mic.stopRecording();
    if (!blob || blob.size <= MIN_BLOB_BYTES) {
      setStatus("idle");
      return;
    }
    setStatus("thinking");
    const audio_b64 = await blobToBase64(blob);
    sendMessage({ type: "audio", data: { audio_b64, mime: "audio/webm" } });
    // Advance the script guide one stage per completed user turn.
    goToStage(useSessionStore.getState().currentStage + 1);
  }, [recording, ending, mic, sendMessage, goToStage]);

  // ---------------------------------------------------------------------------
  // End the call → wait for score/hangup → redirect (fallback after 25s).
  // ---------------------------------------------------------------------------
  const handleEndCall = useCallback(() => {
    if (ending) return;
    setEnding(true);
    tts.stop();
    sendMessage({ type: "end_call" });
    setTimeout(goToResults, END_CALL_FALLBACK_MS);
  }, [ending, tts, sendMessage, goToResults]);

  // Keep status in sync when TTS finishes a turn while idle.
  useEffect(() => {
    if (!tts.speaking && status === "speaking") setStatus("idle");
  }, [tts.speaking, status]);

  const statusLabel = ending
    ? "Завершаю…"
    : status === "recording"
      ? "Говорю…"
      : status === "thinking"
        ? "Обрабатываю…"
        : status === "speaking"
          ? `Говорит ${clientName || "клиент"}`
          : "Говорите";

  // ---------------------------------------------------------------------------
  // Splash: "Звонок клиенту… [Ответить]" until accepted.
  // ---------------------------------------------------------------------------
  if (!accepted) {
    return (
      <main
        className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6"
        style={{
          background: "var(--surface-base, var(--background))",
          color: "var(--text-primary)",
          paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}
          >
            <Mic className="h-8 w-8" style={{ color: "var(--primary)" }} />
          </span>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Звонок клиенту…
          </p>
        </div>
        <button
          type="button"
          onClick={handleAccept}
          className="rounded-full px-10 py-3 text-base font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
        >
          Ответить
        </button>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Active call screen.
  // ---------------------------------------------------------------------------
  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-between px-6 py-12"
      style={{
        background: "var(--surface-base, var(--background))",
        color: "var(--text-primary)",
        paddingTop: "max(env(safe-area-inset-top), 3rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 3rem)",
      }}
    >
      {/* Right-side script guide — leads the learner strictly through the 7
          stages (task · example phrases · common mistakes). Desktop only;
          mobile gets the ScriptDrawer bottom-sheet below. */}
      <aside
        className="hidden lg:block absolute right-4 top-20 z-30 pointer-events-auto w-[min(440px,34vw)] max-h-[calc(100dvh-180px)] overflow-y-auto rounded-2xl p-5"
        style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-md)" }}
      >
        <ScriptPanel compactHeader />
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
            Как пользоваться
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <li><span style={{ color: "var(--text-primary)" }}>«Говорить»</span> — скажите реплику текущего этапа, затем «Стоп», чтобы отправить.</li>
            <li><span style={{ color: "var(--text-primary)" }}>Скрипт</span> — задача, примеры фраз и типичные ошибки этапа. Идите по этапам сверху вниз.</li>
            <li><span style={{ color: "var(--text-primary)" }}>«Завершить»</span> — закончить звонок и получить разбор.</li>
          </ul>
        </div>
      </aside>

      {/* Mobile: same script as a bottom-sheet (floating chip → sheet). */}
      <div className="lg:hidden">
        <ScriptDrawer />
      </div>

      {/* Header: who you're talking to + live status */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">{clientName || "Клиент"}</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {statusLabel}
        </p>
      </div>

      {/* Big circular push-to-talk button */}
      <div className="flex flex-col items-center gap-6">
        <button
          type="button"
          onClick={handleTalkToggle}
          disabled={ending || status === "thinking" || status === "speaking"}
          aria-pressed={recording}
          className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full transition-transform active:scale-95 disabled:opacity-40"
          style={{
            background: recording ? "var(--primary)" : "var(--surface-card)",
            color: recording ? "var(--primary-foreground, #fff)" : "var(--text-primary)",
            border: "1px solid var(--border-color)",
          }}
        >
          {status === "thinking" ? (
            <Loader2 className="h-10 w-10 animate-spin" />
          ) : recording ? (
            <Square className="h-10 w-10" />
          ) : (
            <Mic className="h-10 w-10" style={{ color: "var(--primary)" }} />
          )}
          <span className="text-sm font-medium">
            {recording ? "Стоп" : status === "thinking" ? "Обрабатываю…" : "Говорить"}
          </span>
        </button>

        {caption ? (
          <p
            className="max-w-md text-center text-sm"
            style={{ color: "var(--text-tertiary, var(--text-secondary))" }}
          >
            «{caption}»
          </p>
        ) : null}
      </div>

      {/* End call */}
      <button
        type="button"
        onClick={handleEndCall}
        disabled={ending}
        className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--surface-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
      >
        {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
        {ending ? "Завершаю…" : "Завершить"}
      </button>
    </main>
  );
}
