"use client";

/**
 * PhoneCallMode — full-screen "live call" UI for training sessions.
 *
 * Phase 2.10 (2026-04-19). User feedback: the default chat layout didn't
 * feel like a live phone call. This component presents a FaceTime/iPhone-
 * style full-screen experience on `/training/[id]/call`:
 *
 *   - Scene backdrop driven by CharacterBuilder's `bg_noise` choice
 *     (office / street / home-ish / neutral), so the "фон" decision from
 *     the builder actually reaches the user's eyes.
 *   - Large central avatar (TalkingHeadAvatar or Jarvis fallback) that
 *     lip-syncs to the TTS `audioLevel` from `useTTS`.
 *   - Elapsed call duration timer.
 *   - Three iPhone-style controls: mute, speaker toggle, hangup.
 *   - The CrystalMic for user voice input remains — V1 keeps the explicit
 *     tap-to-speak UX rather than implementing full-duplex VAD streaming
 *     (documented as a Phase 3 follow-up in the plan).
 *
 * The component is deliberately thin: it reads store state, renders, and
 * calls back to props for navigation / hangup. No WS wiring lives here;
 * the route `/training/[id]/call/page.tsx` reuses the existing session
 * page's connection by mounting this view on top of the same store.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Volume2, Volume1, PhoneOff } from "lucide-react";
import type { EmotionState } from "@/types";
import { EMOTION_MAP } from "@/types";
import type { ClientCardData } from "@/components/training/ClientCard";
import ScriptPanel from "@/components/training/ScriptPanel";

/**
 * 2026-04-22: Procedural ambient noise via Web Audio API.
 *
 * The constructor lets the user pick a `bg_noise` (office / street / home).
 * Until now this only changed the visual gradient — there was no actual
 * audio. We now synthesise a low-volume background loop using filtered
 * white/brown noise tuned per scene. No external mp3 files needed; sounds
 * realistic enough to make the call feel "in a real place".
 *
 * Returns a cleanup function. Caller is responsible for calling it on
 * unmount.
 */
function startAmbientNoise(sceneKey: string, masterGain = 0.06): () => void {
  if (typeof window === "undefined") return () => {};
  const AC = (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext) as typeof AudioContext | undefined;
  if (!AC) return () => {};
  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return () => {};
  }

  // Generate ~2s of white noise as a buffer source we loop forever.
  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  // Brown noise (∫ white noise) sounds warmer than raw white noise — closer
  // to room hum / distant traffic. We scale to keep amplitude tame.
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const w = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * w) / 1.02;
    data[i] = lastOut * 3.5;
  }

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  // Per-scene EQ. Each scene has a low-pass + optional secondary tone to
  // sell the location. Numbers tuned by ear, not science — feel free to tweak.
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  gain.gain.value = masterGain;

  switch (sceneKey) {
    case "office":
      // Soft hum + paper/HVAC: low-pass at 800Hz, slight midrange.
      filter.type = "lowpass";
      filter.frequency.value = 800;
      gain.gain.value = masterGain * 1.0;
      break;
    case "street":
      // Wider band — distant traffic. More body.
      filter.type = "lowpass";
      filter.frequency.value = 1200;
      gain.gain.value = masterGain * 1.4;
      break;
    case "children":
      // Home with kids/TV — slightly brighter, gentle modulation later.
      filter.type = "bandpass";
      filter.frequency.value = 600;
      filter.Q.value = 0.3;
      gain.gain.value = masterGain * 0.9;
      break;
    case "tv":
      // TV in background — tighter midrange, like muffled speech room.
      filter.type = "bandpass";
      filter.frequency.value = 900;
      filter.Q.value = 0.5;
      gain.gain.value = masterGain * 1.0;
      break;
    default:
      // "none" or unknown — almost silent room tone.
      filter.type = "lowpass";
      filter.frequency.value = 400;
      gain.gain.value = masterGain * 0.4;
  }

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  try {
    source.start();
  } catch {
    /* ignore: source already started in some weird race */
  }

  // Browsers suspend AudioContext until a user gesture. Try resume; if
  // blocked, attach a one-shot click listener.
  if (ctx.state === "suspended") {
    const tryResume = () => {
      ctx.resume().catch(() => {});
      window.removeEventListener("click", tryResume);
      window.removeEventListener("touchstart", tryResume);
    };
    window.addEventListener("click", tryResume, { once: true });
    window.addEventListener("touchstart", tryResume, { once: true });
  }

  return () => {
    try {
      source.stop();
    } catch {
      /* ignore */
    }
    try {
      ctx.close();
    } catch {
      /* ignore */
    }
  };
}

// Scene tags — each key comes from CharacterBuilder's NOISES array.
// We map audio-noise tags to a quiet, neutral editorial backdrop. The
// scene only changes the ambient *sound* (see startAmbientNoise) and the
// eyebrow *label* — the visual surface stays calm so the avatar + script
// remain the focus (no coloured gradient scenery, per editorial spec).
const SCENE_KEYS = ["office", "street", "children", "tv", "none"] as const;

const SCENE_LABEL: Record<string, string> = {
  office: "Офис",
  street: "Улица",
  children: "Дом",
  tv: "Дом",
  none: "Звонок",
};

interface Props {
  characterName: string;
  emotion: EmotionState;
  /** Call-connection state drives the status line ("Соединение…" / "В сети"). */
  sessionState: "connecting" | "briefing" | "ready" | "completed";
  /** 0-1 current audio amplitude — for ring pulse, from useTTS hook. */
  audioLevel?: number;
  /** Call duration in seconds. */
  elapsed: number;
  /** Mic muted (user-side). */
  muted: boolean;
  /** Speaker on speaker-mode (louder). */
  speakerOn: boolean;
  /** Scene background id, usually from session.custom_bg_noise. */
  sceneId?: string | null;
  /** Optional client card; used for avatar/name fallback. */
  clientCard?: ClientCardData | null;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onHangup: () => void;
  /** Optional render slot for the mic button (the existing CrystalMic). */
  micSlot?: React.ReactNode;
  /** Current output volume (0..1). If undefined, slider is not rendered. */
  volume?: number;
  /** Called when the user drags the volume slider. */
  onVolumeChange?: (v: number) => void;

  // --- Coaching overlays (NEW 2026-04-21): feature-parity with chat ---
  /** 7-step BFL script — current stage number, label, completion list. */
  stage?: {
    current: number;          // 1..total
    label?: string;           // "Приветствие" / "Контакт" / ...
    completed: number[];      // completed stage numbers
    total: number;            // usually 7
  };
  /**
   * Most-recent coach whisper. Persists until a newer one arrives (no
   * auto-dismiss on voice: user can't re-glance when they're speaking).
   * Tap → expands full details panel.
   */
  coachingHint?: {
    message: string;
    priority?: "low" | "medium" | "high";
    icon?: string;
    type?: string;
  } | null;

  /** 2026-04-23: when true, hangup button shows spinner + "Завершаем…"
   *  label and becomes non-clickable. Prevents double-click races during
   *  the ~15s window where backend is scoring the session. */
  endInFlight?: boolean;

  /** User-first §A.2 (2026-04-29): callback for "тап = вставить" on the
   *  desktop ScriptPanel example phrases. Pre-A.2 this prop was missing,
   *  ScriptPanel's handleCopy fell through to navigator.clipboard
   *  (silent — no UI feedback, no input pre-fill), so users tapped and
   *  nothing visibly happened. The call page wires this to setTextInput
   *  so a tap pre-fills the fallback text input. */
  onCopyExample?: (text: string) => void;
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PhoneCallMode({
  characterName,
  emotion,
  sessionState,
  audioLevel = 0,
  elapsed,
  muted,
  speakerOn,
  sceneId,
  clientCard,
  onToggleMute,
  onToggleSpeaker,
  onHangup,
  micSlot,
  volume,
  onVolumeChange,
  stage,
  coachingHint,
  endInFlight = false,
  onCopyExample,
}: Props) {
  const sceneKey = (SCENE_KEYS as readonly string[]).includes(sceneId || "none")
    ? (sceneId || "none")
    : "none";
  const sceneLabel = SCENE_LABEL[sceneKey];
  const ec = EMOTION_MAP[emotion] || EMOTION_MAP.cold;

  // 2026-04-22: ambient procedural noise. Starts on the first user gesture
  // (browsers block AudioContext otherwise) — usually the user has clicked
  // somewhere by the time the call view mounts. Cleanup on unmount/scene
  // change. Volume scales with `volume` slider (so it ducks with TTS).
  const ambientStopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    // Stop previous instance if scene changed mid-call.
    if (ambientStopRef.current) {
      ambientStopRef.current();
      ambientStopRef.current = null;
    }
    // Tie ambient master gain to the user's volume preference (default 0.85).
    // Multiplier 0.06 keeps it subtle — it's a backdrop, not a song.
    const master = 0.06 * (typeof volume === "number" ? Math.max(0.2, volume) : 0.85);
    ambientStopRef.current = startAmbientNoise(sceneKey, master);
    return () => {
      if (ambientStopRef.current) {
        ambientStopRef.current();
        ambientStopRef.current = null;
      }
    };
  }, [sceneKey, volume]);

  // Volume popover state: the speaker/volume button acts as a disclosure
  // trigger. First tap opens a slider popover above it; second tap hides.
  // Auto-closes on outside tap (see effect below). Only enabled when the
  // parent wired `volume` + `onVolumeChange` — otherwise speaker button
  // retains its legacy preset-toggle behavior.
  const [showVolumePopover, setShowVolumePopover] = useState(false);
  useEffect(() => {
    if (!showVolumePopover) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-volume-popover], [data-volume-button]")) return;
      setShowVolumePopover(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [showVolumePopover]);

  // Gentle ambient animation so the scene feels alive when the AI isn't
  // actively speaking. Intensity scales with audioLevel when present.
  const breathingScale = useMemo(() => 1 + Math.min(0.08, audioLevel * 0.12), [audioLevel]);

  // Status line reflects both WS lifecycle and TTS activity.
  const statusLine = sessionState === "connecting"
    ? "Соединение…"
    : sessionState === "completed"
    ? "Звонок завершён"
    : audioLevel > 0.05
    ? "Говорит…"
    : "В сети";

  // Timer turns to a calm warning token once the call runs long (>= 5 min)
  // — replaces the old animate-pulse neon. Static colour, no glow.
  const timerWarning = elapsed >= 300;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/*
        Top meta row — editorial mono-eyebrow labels + tabular timer.
        Scene + status are quiet eyebrows; the emotion is a hairline pill
        on a -muted surface (no neon, no caps screaming, one accent only).
      */}
      <div className="relative z-10 flex items-start justify-between px-6 pt-5">
        <div className="flex flex-col">
          <span
            className="font-mono uppercase"
            style={{
              color: "var(--text-muted)",
              fontSize: 11,
              letterSpacing: "0.16em",
            }}
          >
            {sceneLabel}
          </span>
          <span
            className="font-mono mt-1 tabular-nums"
            style={{
              color: timerWarning ? "var(--warning)" : "var(--text-primary)",
              fontSize: 22,
            }}
          >
            {formatElapsed(elapsed)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span
            className="font-mono uppercase"
            style={{
              color: "var(--text-muted)",
              fontSize: 11,
              letterSpacing: "0.16em",
            }}
          >
            {statusLine}
          </span>
          <span
            className="mt-1.5 rounded-full px-3 py-1 font-mono uppercase"
            style={{
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-color)",
              fontSize: 11,
              letterSpacing: "0.16em",
            }}
          >
            {ec.labelRu}
          </span>
        </div>
      </div>

      {/*
        Stage teleprompter (2026-04-21 feature-parity with chat):
        thin inline strip showing 7-dot progress + current stage label.
        Reads tiny vertical space, does not overlap avatar, keeps the
        "where am I in the sales script" context present at all times.
      */}
      {/* 2026-04-23 Sprint 3: the minimal 7-bar teleprompter is now
          mobile-only. On lg+ the full ScriptPanel is rendered as a
          fixed narrow column (see below) with task + examples — the
          thin bar would duplicate the progress dots. On mobile the
          ScriptDrawer (page-level) handles script content in a sheet. */}
      {stage && stage.total > 0 && (
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={stage.total}
          aria-valuenow={stage.current}
          aria-valuetext={`Этап ${stage.current} из ${stage.total}${stage.label ? `: ${stage.label}` : ""}`}
          className="relative z-10 mx-auto mt-3 flex w-[min(560px,calc(100vw-48px))] items-center gap-3 rounded-xl px-4 py-2 lg:hidden"
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <span
            className="font-mono tabular-nums uppercase"
            style={{ color: "var(--text-secondary)", fontSize: 11, letterSpacing: "0.16em" }}
          >
            {stage.current}/{stage.total}
          </span>
          <div className="flex flex-1 items-center gap-1">
            {Array.from({ length: stage.total }, (_, i) => i + 1).map((n) => {
              const done = stage.completed.includes(n);
              const isCur = n === stage.current;
              return (
                <span
                  key={n}
                  className="h-1.5 flex-1 rounded-full transition-colors"
                  style={{
                    background: done
                      ? "var(--success)"
                      : isCur
                      ? "var(--accent)"
                      : "var(--bg-tertiary)",
                  }}
                />
              );
            })}
          </div>
          {stage.label && (
            <span
              className="truncate"
              style={{ maxWidth: 140, color: "var(--text-secondary)" }}
            >
              {stage.label}
            </span>
          )}
        </div>
      )}

      {/* 2026-04-23 Sprint 3: desktop ScriptPanel as floating right-column
          overlay. Translucent background so the avatar remains the hero
          element, but task / examples / mistakes are always visible to
          the learner. Fixed width 300px, anchored top-right below the
          header strip, scrollable if content overflows. Mobile falls
          back to the lg:hidden bar above + ScriptDrawer at page level. */}
      {stage && stage.total > 0 && (
        <aside
          // User-first §A.2 (2026-04-29): bumped z-10 → z-30 because the
          // sibling avatar div below also has z-10 and is later in DOM
          // order, so under same-stack-level rules it painted on top of
          // the script panel and silently swallowed every click.
          // pointer-events-auto is belt-and-braces: even if a future
          // ancestor disables pointer events for the whole call surface,
          // the script panel stays interactive.
          className="hidden lg:block absolute right-4 top-20 z-30 pointer-events-auto w-[300px] max-h-[calc(100vh-180px)] overflow-y-auto rounded-2xl p-4"
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <ScriptPanel compactHeader onCopyExample={onCopyExample} />
        </aside>
      )}

      {/* Central avatar — calm token ring, no colour blob / neon glow. */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <motion.div
          className="relative flex items-center justify-center"
          animate={{ scale: breathingScale }}
          transition={{ duration: 0.35 }}
        >
          {/* Soft breathing ring — subtle accent-muted, no glow shadow. */}
          <motion.div
            aria-hidden
            className="absolute rounded-full"
            animate={{
              scale: [1, 1 + Math.max(0.03, audioLevel * 0.35), 1],
              opacity: [0.35, 0.6, 0.35],
            }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 280,
              height: 280,
              border: "1px solid var(--accent-muted)",
            }}
          />
          {/* Inner avatar disc — surface card + 1px hairline ring. */}
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 220,
              height: 220,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              fontSize: 80,
              fontWeight: 600,
              color: "var(--text-secondary)",
              letterSpacing: "-0.02em",
            }}
          >
            {(characterName || "K").charAt(0).toUpperCase()}
          </div>
        </motion.div>

        <div className="mt-8 text-center">
          <div
            className="text-2xl font-semibold tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            {characterName}
          </div>
          {clientCard?.city && (
            <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {clientCard.city}
              {clientCard.age ? `, ${clientCard.age} лет` : ""}
            </div>
          )}
        </div>
      </div>

      {/*
        Coach Pill (2026-04-21): floating rail over controls row that
        shows the latest whisper.coaching message. Stays visible until
        the next whisper replaces it (voice users can't re-glance mid-
        sentence, auto-dismiss is wrong here). Priority dot colors
        match the chat WhisperPanel conventions.
      */}
      {coachingHint && coachingHint.message && (
        <div className="relative z-10 px-6 pb-2">
          <div
            className="mx-auto flex max-w-md items-center gap-2.5 rounded-full px-4 py-2 text-left"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
            }}
            aria-live="polite"
          >
            <span
              aria-hidden
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{
                background:
                  coachingHint.priority === "high"
                    ? "var(--danger)"
                    : coachingHint.priority === "medium"
                    ? "var(--warning)"
                    : "var(--accent)",
              }}
            />
            <span
              className="flex-1 text-sm leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {coachingHint.message}
            </span>
          </div>
        </div>
      )}

      {/* Controls row. */}
      {/*
        pb-24 (2026-04-22): bumped from pb-10 so call/page.tsx's text-
        input fallback bar (fixed bottom-0) doesn't cover the speaker /
        volume buttons. Text input is ~50px tall with its padding; pb-24
        (96px) leaves visible gap between the controls row and the
        typing bar below.
      */}
      <div className="relative z-10 pb-24 pt-6">
        {/*
          Volume popover (2026-04-21): parent passes volume + onVolumeChange.
          Tapping the speaker button now TOGGLES a slider popover anchored
          above the button, instead of flipping between two hardcoded
          levels. Backwards-compatible: if parent doesn't pass volume,
          we fall back to onToggleSpeaker on click like before.
        */}
        {typeof volume === "number" && onVolumeChange && showVolumePopover && (
          <div data-volume-popover className="mx-auto mb-4 max-w-md px-8">
            <div
              className="relative flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <button
                type="button"
                onClick={() => onVolumeChange(volume > 0 ? 0 : 0.7)}
                aria-label={volume > 0 ? "Выключить звук" : "Включить звук"}
                className="flex h-8 w-8 items-center justify-center rounded-full transition"
                style={{ color: "var(--text-secondary)" }}
              >
                {volume === 0 ? <Volume1 size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                aria-label="Громкость"
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
                style={{ background: "var(--bg-tertiary)", accentColor: "var(--accent)" }}
              />
              <span
                className="min-w-[3ch] text-right font-mono text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        )}
        <div className="mx-auto flex max-w-md items-center justify-between px-10">
          {/*
            2026-04-21 layout fix — was previously two separate mic buttons:
            a mute-toggle here (which flipped a React state that nothing
            else read, i.e. dead) AND a real push-to-talk mic rendered in
            the micSlot below. That looked like duplicated UI to the user.
            Now: if the parent supplies micSlot, THAT becomes the left-most
            button — single source of truth for mic control. Parents that
            don't wire micSlot get the legacy mute-toggle as a fallback
            (backwards-compat for older callers).
          */}
          {micSlot ? (
            // The provided slot is expected to own its own flex-col button
            // layout (see call/page.tsx). Render it directly so the ring
            // stays symmetrical with the other two CallButtons.
            micSlot
          ) : (
            // 2026-04-23 UX: semantic states.
            // muted=true  → mic OFF → red outline + slash icon + label "Включить"
            // muted=false → mic ON (green pulse while speaking) + label "Выключить"
            // User immediately reads: red = off, green = live.
            <CallButton
              label={muted ? "Включить микрофон" : "Микрофон включён"}
              subtitle={muted ? "выключен" : "в эфире"}
              onClick={onToggleMute}
              state={muted ? "danger-off" : "success-on"}
            >
              {muted ? <MicOff size={26} /> : <Mic size={26} />}
            </CallButton>
          )}

          <CallHangup onClick={onHangup} loading={endInFlight} />

          <span data-volume-button>
            {/* 2026-04-23 UX: speaker mute state is visually unmistakable.
                volume > 0  → accent purple, Volume2 icon, label with % — ON
                volume === 0 → red outline, Volume1 slash icon — OFF
                When volume popover is open — muted state is overridden with
                the open-state accent fill (so user sees popover is live). */}
            <CallButton
              label={
                typeof volume === "number"
                  ? volume === 0
                    ? "Включить звук"
                    : `Громкость ${Math.round(volume * 100)}%`
                  : speakerOn
                  ? "Обычный звук"
                  : "Громкая связь"
              }
              subtitle={
                typeof volume === "number"
                  ? volume === 0
                    ? "выключен"
                    : "в эфире"
                  : undefined
              }
              onClick={() => {
                if (typeof volume === "number" && onVolumeChange) {
                  setShowVolumePopover((v) => !v);
                } else {
                  onToggleSpeaker();
                }
              }}
              state={
                typeof volume === "number"
                  ? showVolumePopover
                    ? "accent-open"
                    : volume === 0
                    ? "danger-off"
                    : "accent-on"
                  : speakerOn
                  ? "accent-on"
                  : "neutral"
              }
            >
              {(typeof volume === "number" ? volume > 0 : speakerOn) ? (
                <Volume2 size={26} />
              ) : (
                <Volume1 size={26} />
              )}
            </CallButton>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Editorial restyle: round pill controls on calm tokens, one accent only,
 * no gradients, no neon glow. Semantic states map to colour *tokens*:
 *
 *   - success-on  : success-muted fill + success ring (mic live)
 *   - danger-off  : danger-muted fill + danger ring (mic / speaker muted)
 *   - accent-on   : accent-muted fill + accent ring (enabled)
 *   - accent-open : accent fill (popover/menu currently open)
 *   - neutral     : bg-secondary + hairline (idle)
 *
 * Subtitle slot shows a quiet mono second line under the icon
 * («в эфире» / «выключен») so the state reads without icon interpretation.
 */
type CallButtonState =
  | "success-on"
  | "danger-off"
  | "accent-on"
  | "accent-open"
  | "neutral";

function CallButton({
  children,
  onClick,
  label,
  subtitle,
  state = "neutral",
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  subtitle?: string;
  state?: CallButtonState;
}) {
  const palette = STATE_PALETTE[state];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={state === "accent-on" || state === "success-on"}
      className="flex flex-col items-center gap-2"
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 active:scale-95"
        style={{
          background: palette.bg,
          color: palette.fg,
          border: `1px solid ${palette.border}`,
        }}
      >
        {children}
      </span>
      <span
        className="font-mono uppercase"
        style={{ color: palette.labelFg, fontSize: 11, letterSpacing: "0.14em" }}
      >
        {label}
      </span>
      {subtitle && (
        <span
          className="font-mono uppercase"
          style={{ color: palette.subtitleFg, fontSize: 10, letterSpacing: "0.14em" }}
        >
          {subtitle}
        </span>
      )}
    </button>
  );
}

const STATE_PALETTE: Record<
  CallButtonState,
  {
    bg: string;
    fg: string;
    border: string;
    labelFg: string;
    subtitleFg: string;
  }
> = {
  "success-on": {
    // Live / broadcasting — calm success token, no neon.
    bg: "var(--success-muted)",
    fg: "var(--success)",
    border: "var(--success)",
    labelFg: "var(--text-secondary)",
    subtitleFg: "var(--success)",
  },
  "danger-off": {
    // Muted / off — danger token surface + ring.
    bg: "var(--danger-muted)",
    fg: "var(--danger)",
    border: "var(--danger)",
    labelFg: "var(--text-secondary)",
    subtitleFg: "var(--danger)",
  },
  "accent-on": {
    // Enabled — single accent token.
    bg: "var(--accent-muted)",
    fg: "var(--accent)",
    border: "var(--accent)",
    labelFg: "var(--text-secondary)",
    subtitleFg: "var(--accent)",
  },
  "accent-open": {
    // Popover open — solid accent fill so the tie to the overlay is clear.
    bg: "var(--accent)",
    fg: "var(--accent-contrast, #fff)",
    border: "var(--accent)",
    labelFg: "var(--text-secondary)",
    subtitleFg: "var(--accent)",
  },
  neutral: {
    bg: "var(--bg-secondary)",
    fg: "var(--text-secondary)",
    border: "var(--border-color)",
    labelFg: "var(--text-muted)",
    subtitleFg: "var(--text-muted)",
  },
};

/*
 * Editorial restyle: round danger-muted pill, danger ring, no gradient /
 * no neon glow. Loading state swaps the icon for a quiet token spinner
 * (no pulsing boxShadow). Logic (disabled, aria, loading) unchanged.
 */
function CallHangup({
  onClick,
  loading = false,
}: {
  onClick: () => void;
  /** 2026-04-23: when true, button is disabled + spinner replaces icon.
   *  Used to prevent double-click-while-scoring races. */
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={loading ? undefined : onClick}
      disabled={loading}
      aria-label="Завершить звонок"
      aria-busy={loading}
      className="flex flex-col items-center gap-2 disabled:cursor-wait"
    >
      <motion.span
        whileTap={loading ? undefined : { scale: 0.9 }}
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: "var(--danger-muted)",
          color: "var(--danger)",
          border: "1px solid var(--danger)",
        }}
      >
        {loading ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            className="inline-block rounded-full"
            style={{
              width: 22,
              height: 22,
              border: "2px solid var(--danger-muted)",
              borderTopColor: "var(--danger)",
            }}
          />
        ) : (
          <PhoneOff size={28} strokeWidth={2.2} />
        )}
      </motion.span>
      <span
        className="font-mono uppercase"
        style={{ color: "var(--danger)", fontSize: 11, letterSpacing: "0.14em" }}
      >
        {loading ? "Завершаем…" : "Завершить"}
      </span>
    </button>
  );
}
