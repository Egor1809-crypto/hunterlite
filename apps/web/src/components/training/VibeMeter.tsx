"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Activity } from "lucide-react";
import { type EmotionState, EMOTION_MAP } from "@/types";

const ARCHETYPE_HINTS: Record<string, string> = {
  skeptic: "Скептик: нужны факты и цифры",
  anxious: "Тревожный: нужна эмпатия",
  aggressive: "Агрессивный: сохраняйте спокойствие",
  passive: "Пассивный: задавайте вопросы",
  analytical: "Аналитик: приводите данные",
  emotional: "Эмоциональный: покажите понимание",
  busy: "Занятой: будьте кратки",
  indecisive: "Нерешительный: помогите с выбором",
};

/** The 5 warmth zones, left (hostile) → right (deal). Monochrome ticks;
 *  the active zone is highlighted. Single-word labels so they never read
 *  as truncated stubs. */
const ZONE_LABELS = ["Враждебен", "Насторожен", "Любопытен", "Торг", "Сделка"] as const;

interface VibeMeterProps {
  emotion: EmotionState;
  archetype?: string | null;
  trigger?: string | null;
}

export default function VibeMeter({ emotion, archetype, trigger }: VibeMeterProps) {
  const config = EMOTION_MAP[emotion] || EMOTION_MAP.cold;
  const value = Math.max(0, Math.min(100, config.value));
  // Which of the 5 zones the value falls into (for highlighting the tick).
  const activeZone = Math.min(ZONE_LABELS.length - 1, Math.round((value / 100) * (ZONE_LABELS.length - 1)));

  return (
    <div className="flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Настроение
        </h3>
        <Activity size={16} style={{ color: "var(--text-muted)" }} />
      </div>

      {/* ── Readout: state label (left) + warmth % (right) ── */}
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
          <AnimatePresence mode="wait">
            <motion.span
              key={emotion}
              className="text-lg font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {config.labelRu}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: "var(--accent)" }}>
            {value}
          </span>
          <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>%</span>
        </div>
      </div>

      {/* ── Warmth track: neutral rail + accent fill + thumb ── */}
      <div className="relative h-2.5 rounded-full" style={{ background: "var(--input-bg)" }}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: "var(--accent)" }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
        <motion.div
          className="absolute top-1/2 h-4 w-4 rounded-full"
          style={{
            background: "var(--accent)",
            border: "2px solid var(--surface-card)",
            boxShadow: "var(--shadow-sm)",
            marginTop: -8,
            marginLeft: -8,
          }}
          animate={{ left: `${value}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>

      {/* ── Zone ticks — monochrome, active one highlighted ── */}
      <div className="flex justify-between mt-2.5">
        {ZONE_LABELS.map((label, i) => (
          <span
            key={label}
            className="text-[10px] leading-none"
            style={{
              color: i === activeZone ? "var(--accent)" : "var(--text-muted)",
              fontWeight: i === activeZone ? 600 : 400,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* ── Archetype hint ── */}
      {archetype && (
        <div
          className="mt-4 pt-3 text-xs leading-relaxed"
          style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border-color)" }}
        >
          {trigger || ARCHETYPE_HINTS[archetype] || archetype}
        </div>
      )}
    </div>
  );
}
