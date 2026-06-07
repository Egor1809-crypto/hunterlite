"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type {
  JudgeFlagItem,
  JudgeStrengthItem,
  JudgeVerdictData,
} from "@/types";

interface JudgeVerdictCardProps {
  judge: JudgeVerdictData;
  // P4 (2026-05-04): clicking a flag/strength chip scrolls the
  // transcript to message_index. Wired by /results/[id]/page so a
  // missing handler is graceful (chips become non-interactive).
  onJumpToMessage?: (messageIndex: number) => void;
}

// Normalises legacy `string` flags into the anchored object shape.
function normalizeFlag(x: JudgeFlagItem | string): JudgeFlagItem {
  if (typeof x === "string") {
    return { label: x, message_index: -1, excerpt: "", fix_example: "" };
  }
  return {
    label: x.label ?? "",
    message_index: typeof x.message_index === "number" ? x.message_index : -1,
    excerpt: x.excerpt ?? "",
    fix_example: x.fix_example ?? "",
  };
}

function normalizeStrength(x: JudgeStrengthItem | string): JudgeStrengthItem {
  if (typeof x === "string") {
    return { label: x, message_index: -1, excerpt: "" };
  }
  return {
    label: x.label ?? "",
    message_index: typeof x.message_index === "number" ? x.message_index : -1,
    excerpt: x.excerpt ?? "",
  };
}

interface VerdictMeta {
  emoji: string;
  label: string;
  color: string;
  bg: string;
  border: string;
}

// 2026-06-06 (редизайн): убран «светофор» из эмодзи (🟢🟡🔴) и цветных плашек.
// Один спокойный акцент на бейдж вердикта — смысл несёт подпись, не цвет.
function getVerdictMeta(verdict: JudgeVerdictData["verdict"]): VerdictMeta {
  const labels: Record<string, string> = {
    excellent: "Отличный звонок",
    good: "Хороший звонок",
    mixed: "Смешанный результат",
    poor: "Слабый звонок",
    red_flag: "Критические ошибки",
  };
  return {
    emoji: "",
    label: labels[verdict as string] ?? "Смешанный итог",
    color: "var(--accent)",
    bg: "var(--accent-muted)",
    border: "var(--border-color)",
  };
}

function formatAdjust(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

export default function JudgeVerdictCard({ judge, onJumpToMessage }: JudgeVerdictCardProps) {
  const meta = getVerdictMeta(judge.verdict);
  const adjust = Number(judge.score_adjust ?? 0);
  const adjustColor = "var(--text-primary)";

  const strengths = (Array.isArray(judge.strengths) ? judge.strengths : [])
    .map(normalizeStrength)
    .filter((x) => x.label.length > 0);
  const redFlags = (Array.isArray(judge.red_flags) ? judge.red_flags : [])
    .map(normalizeFlag)
    .filter((x) => x.label.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="glass-panel rounded-2xl p-6 md:p-7 relative overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }}
      />

      <div className="border-b pb-4 mb-5" style={{ borderColor: "var(--border-color)" }}>
        <SectionHeader code="AI-разбор" title="Вердикт" />
      </div>

      {/* Top row: verdict badge + score adjust */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 font-display text-base md:text-lg tracking-wide"
          style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
        >
          <span>«{meta.label}»</span>
        </div>
        <div className="flex flex-col items-end">
          <span
            className="font-mono text-[11px] uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Корректировка
          </span>
          <span
            className="font-display text-3xl font-bold"
            style={{ color: adjustColor }}
          >
            {formatAdjust(adjust)}
          </span>
        </div>
      </div>

      {/* Rationale */}
      {judge.rationale_ru && (
        <p
          className="italic text-base md:text-lg leading-relaxed mb-6"
          style={{ color: "var(--text-secondary)" }}
        >
          {judge.rationale_ru}
        </p>
      )}

      {/* Two columns: strengths / red flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div
            className="font-mono text-xs uppercase tracking-widest mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Сильные стороны
          </div>
          {strengths.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {strengths.map((s, i) => {
                const clickable = s.message_index >= 0 && Boolean(onJumpToMessage);
                const tooltip = s.excerpt ? `Цитата: «${s.excerpt}»` : undefined;
                return (
                  <button
                    key={`strength-${i}`}
                    type="button"
                    title={tooltip}
                    onClick={clickable ? () => onJumpToMessage?.(s.message_index) : undefined}
                    disabled={!clickable}
                    className={
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-mono transition-colors " +
                      (clickable ? "cursor-pointer hover:bg-white/[0.04]" : "cursor-default")
                    }
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Судья ничего не выделил.
            </span>
          )}
        </div>

        <div>
          <div
            className="font-mono text-xs uppercase tracking-widest mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Что улучшить
          </div>
          {redFlags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {redFlags.map((f, i) => {
                const clickable = f.message_index >= 0 && Boolean(onJumpToMessage);
                const tooltipParts: string[] = [];
                if (f.excerpt) tooltipParts.push(`Цитата: «${f.excerpt}»`);
                if (f.fix_example) tooltipParts.push(`Лучше так: ${f.fix_example}`);
                const tooltip = tooltipParts.join("\n\n") || undefined;
                return (
                  <button
                    key={`flag-${i}`}
                    type="button"
                    title={tooltip}
                    onClick={clickable ? () => onJumpToMessage?.(f.message_index) : undefined}
                    disabled={!clickable}
                    className={
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-mono transition-colors " +
                      (clickable ? "cursor-pointer hover:bg-white/[0.04]" : "cursor-default")
                    }
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Судья ничего не выделил.
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      {(judge.model_used || typeof judge.latency_ms === "number") && (
        <div
          className="mt-5 pt-3 border-t font-mono text-[11px] uppercase tracking-widest text-right"
          style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
        >
          Оценка от {judge.model_used ?? "AI"}
          {typeof judge.latency_ms === "number" ? ` · ${judge.latency_ms} мс` : ""}
        </div>
      )}
    </motion.div>
  );
}
