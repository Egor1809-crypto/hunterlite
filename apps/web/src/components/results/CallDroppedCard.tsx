"use client";

/**
 * CallDroppedCard — terminal outcomes that are NOT the user's fault
 * (`technical_failed`, `timeout`, `operator_aborted`). Shown instead of the
 * scoring verdict so a system error is never framed as user failure.
 *
 * 2026-06-04: rewritten calm + on-brand. The old CRT-glitch / RGB-shift /
 * scanline version read as a scary "dumb animation", and it surfaced the raw
 * terminal-reason code (e.g. "ws_disconnect") + a "TECHNICAL FAILED" chip to
 * the user. Now: platform tokens (light + dark), one soft accent, a plain
 * human message, no raw codes.
 */

import { motion, useReducedMotion } from "framer-motion";
import { PhoneOff, RefreshCw, ArrowLeft } from "lucide-react";

export type CallDroppedReason =
  | "technical_failed"
  | "timeout"
  | "operator_aborted";

export interface CallDroppedCardProps {
  reason: CallDroppedReason;
  /** Optional human-readable detail. Raw codes are intentionally NOT shown. */
  detail?: string;
  onRetry?: () => void;
  onExit?: () => void;
  onShowTranscript?: () => void;
}

const COPY_FOR: Record<CallDroppedReason, { title: string; subtitle: string }> = {
  technical_failed: {
    title: "Связь прервалась",
    subtitle: "Это технический сбой на нашей стороне — не в твоих действиях. Просто начни заново.",
  },
  timeout: {
    title: "Звонок завершён",
    subtitle: "Была долгая пауза, и клиент положил трубку. Попробуй ещё раз — держи темп.",
  },
  operator_aborted: {
    title: "Звонок прерван",
    subtitle: "Диалог завершился, не начавшись. Можно перезапустить тренировку.",
  },
};

export default function CallDroppedCard({
  reason,
  detail,
  onRetry,
  onExit,
  onShowTranscript,
}: CallDroppedCardProps) {
  const reduce = useReducedMotion();
  const copy = COPY_FOR[reason];
  // Only show detail if it's a human sentence (has a space) — never a raw code.
  const humanDetail = detail && /\s/.test(detail) ? detail : null;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-[24px] text-center"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-lg)" }}
      role="status"
      aria-live="polite"
    >
      <div className="px-8 pb-8 pt-10">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <PhoneOff size={28} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
        </div>

        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {copy.title}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {copy.subtitle}
        </p>
        {humanDetail && (
          <p className="mx-auto mt-2 max-w-sm text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            {humanDetail}
          </p>
        )}

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              <RefreshCw size={16} /> Начать заново
            </button>
          )}
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-transform hover:scale-[1.02]"
              style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            >
              <ArrowLeft size={16} /> К тренировкам
            </button>
          )}
        </div>

        {onShowTranscript && (
          <button
            type="button"
            onClick={onShowTranscript}
            className="mt-5 text-[12px] underline-offset-2 hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Показать, что было
          </button>
        )}
      </div>
    </motion.div>
  );
}
