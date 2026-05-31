"use client";

/**
 * QuizAnswerCard — Arcade-Stage answer chip (Phase 1).
 *
 * Заменяет inline answer-chip render в quiz/[sessionId]/page.tsx.
 * Стиль: glass-tile rounded-xl + circular letter-badge цветной + текст
 * (sans 14px) + keyboard-shortcut hint (font-mono kbd-style).
 *
 * States:
 *   default     — glass background, soft border (badge color × 25%)
 *   hover       — y: -2 lift + boxShadow tier-color glow
 *   picked      — accent bg + accent border + checkmark badge + scale 0.99
 *   locked-out  — opacity 0.35 + blur(0.5px), pointer-events: none
 */

import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface QuizAnswerCardProps {
  index: number;          // 0..4
  text: string;
  picked: boolean;
  locked: boolean;        // any choice is picked → disable others
  disabled?: boolean;     // store.status !== "active"
  onPick: (idx: number) => void;
}

export function QuizAnswerCard({
  index,
  text,
  picked,
  locked,
  disabled,
  onPick,
}: QuizAnswerCardProps) {
  const letter = String.fromCharCode(65 + index);
  const dim = locked && !picked;
  const interactive = !locked && !disabled;

  return (
    <motion.button
      type="button"
      onClick={() => interactive && onPick(index)}
      disabled={!interactive}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: dim ? 0.35 : 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.22 }}
      whileHover={interactive ? { y: -1 } : undefined}
      whileTap={interactive ? { y: 0 } : undefined}
      className="group relative w-full flex items-center gap-4 text-left rounded-2xl overflow-hidden"
      style={{
        padding: "20px 22px",
        background: picked
          ? "var(--primary-muted)"
          : "var(--surface-card)",
        border: picked
          ? "2px solid var(--primary)"
          : "2px solid var(--border-color)",
        boxShadow: picked ? "var(--shadow-md)" : "var(--shadow-sm)",
        cursor: interactive ? "pointer" : "default",
        transition: "background 200ms, border-color 200ms, box-shadow 240ms, transform 160ms",
      }}
      aria-pressed={picked}
      aria-label={`Вариант ${letter}: ${text}`}
    >
      {/* hover-glow stripe (left edge) */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 transition-all"
        style={{
          width: picked ? 4 : 0,
          background: "var(--primary)",
          opacity: picked ? 1 : 0,
        }}
      />

      {/* letter badge */}
      <span
        className="font-semibold shrink-0 flex items-center justify-center select-none relative"
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: picked ? "var(--primary)" : "var(--bg-secondary)",
          color: picked ? "#fff" : "var(--text-secondary)",
          fontSize: 16,
          border: picked ? "1px solid var(--primary)" : "1px solid var(--border-color)",
          transition: "background 220ms, color 220ms, border-color 220ms",
        }}
      >
        {letter}
      </span>

      {/* answer text */}
      <span
        className="flex-1 leading-snug"
        style={{
          color: "var(--text-primary)",
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.5,
        }}
      >
        {text}
      </span>

      {/* keyboard hint (md+) — kbd-style */}
      {interactive && (
        <kbd
          className="hidden md:inline-flex items-center justify-center font-mono shrink-0 select-none"
          style={{
            minWidth: 32,
            height: 32,
            padding: "0 8px",
            borderRadius: 8,
            background: "var(--input-bg)",
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          {letter}
        </kbd>
      )}

      {/* picked checkmark */}
      {picked && (
        <motion.span
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 18 }}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "var(--primary)",
            color: "#fff",
          }}
          aria-hidden
        >
          <Check size={18} strokeWidth={3} />
        </motion.span>
      )}
    </motion.button>
  );
}
