"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Timer } from "lucide-react";
import { categoryLabel } from "@/lib/categories";

interface QuizHUDProps {
  mode: string | null;
  category: string | null;
  currentQuestion: number;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  bestStreak: number;
  timeLeft: number | null;
  onExit: () => void;
}

const MODE_LABEL: Record<string, string> = {
  blitz: "Тест",
  rapid_blitz: "Тест",
  themed: "Тест",
  free_dialog: "Практика",
  pvp: "PVP",
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function TimerPill({ seconds }: { seconds: number }) {
  const tone =
    seconds <= 5 ? "var(--danger)"
    : seconds <= 15 ? "var(--warning)"
    : "var(--text-primary)";

  return (
    <motion.div
      className="flex items-center gap-2 rounded-2xl px-4 py-2 tabular-nums"
      animate={seconds <= 5 ? { scale: [1, 1.04, 1] } : {}}
      transition={{ duration: 0.6, repeat: seconds <= 5 ? Infinity : 0 }}
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
        color: tone,
      }}
    >
      <Timer size={16} />
      <span className="text-lg font-bold">{formatTime(seconds)}</span>
    </motion.div>
  );
}

export function QuizHUD({
  mode,
  category,
  currentQuestion,
  totalQuestions,
  correct,
  incorrect,
  timeLeft,
  onExit,
}: QuizHUDProps) {
  const modeKey = mode ?? "free_dialog";
  const modeLabel = MODE_LABEL[modeKey] ?? "Тест";
  const progress = totalQuestions > 0 ? Math.max(0, Math.min(100, (currentQuestion / totalQuestions) * 100)) : 0;

  return (
    <div
      className="shrink-0 sticky top-0 z-20"
      style={{
        background: "color-mix(in srgb, var(--bg-primary) 94%, white)",
        borderBottom: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onExit}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: "var(--text-secondary)" }}
            title="Завершить и выйти"
            aria-label="Завершить и выйти"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="truncate text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {modeLabel}
            </div>
            {category && (
              <div className="mt-0.5 truncate text-sm" style={{ color: "var(--text-muted)" }}>
                {categoryLabel(category)}
              </div>
            )}
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 md:block">
          {totalQuestions > 0 && (
            <>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Вопрос {currentQuestion} из {totalQuestions}
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  Отвечено: {correct + incorrect}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-tertiary)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--primary)" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {(correct > 0 || incorrect > 0) && (
            <div
              className="flex items-center gap-2 rounded-2xl px-3.5 py-2 text-base font-semibold tabular-nums"
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span style={{ color: "var(--success)" }}>✓{correct}</span>
              <span style={{ color: "var(--text-muted)" }}>·</span>
              <span style={{ color: "var(--danger)" }}>✗{incorrect}</span>
            </div>
          )}
          {timeLeft !== null && <TimerPill seconds={timeLeft} />}
        </div>
      </div>
    </div>
  );
}
