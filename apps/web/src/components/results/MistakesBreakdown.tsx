"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { DetectedItem } from "@/types";

interface MistakesBreakdownProps {
  items: DetectedItem[];
}

interface CategoryMeta {
  label: string;
  positive?: boolean;
}

// 2026-06-06 (редизайн malvah): без эмодзи — чистые текстовые подписи.
const CATEGORY_LABELS: Record<string, CategoryMeta> = {
  monologue: { label: "Монолог" },
  mistake_monologue: { label: "Монолог" },
  no_open_question: { label: "Нет открытых вопросов" },
  mistake_no_open_question: { label: "Нет открытых вопросов" },
  talk_ratio_high: { label: "Доминирует в речи" },
  mistake_talk_ratio_high: { label: "Доминирует в речи" },
  repeated_argument: { label: "Повтор аргумента" },
  mistake_repeated_argument: { label: "Повтор аргумента" },
  early_pricing: { label: "Раннее ценообразование" },
  mistake_early_pricing: { label: "Раннее ценообразование" },
  false_promises: { label: "Ложные обещания" },
  intimidation: { label: "Запугивание" },
  incorrect_info: { label: "Неверная информация" },
  disrespect_to_client: { label: "Грубость с клиентом" },
  zero_open_questions: { label: "Ни одного открытого вопроса" },
  mode_switch_to_on_task: { label: "Переход к делу замечен", positive: true },
};

function getCategoryMeta(category: string): CategoryMeta {
  return CATEGORY_LABELS[category] ?? { label: category };
}

// 2026-06-06 (редизайн malvah): монохром — число «−5 / +5» само несёт знак,
// без цветной заливки. Спокойный нейтральный чип.
function formatPenalty(p: number | undefined): { text: string; color: string; bg: string; border: string } {
  const value = typeof p === "number" ? p : 0;
  const text =
    value < 0
      ? `−${Math.abs(value).toFixed(2).replace(/\.00$/, "")}`
      : value > 0
        ? `+${value.toFixed(2).replace(/\.00$/, "")}`
        : "0";
  return {
    text,
    color: "var(--text-secondary)",
    bg: "var(--bg-secondary)",
    border: "var(--border-color)",
  };
}

export default function MistakesBreakdown({ items }: MistakesBreakdownProps) {
  const list = Array.isArray(items) ? items : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="glass-panel rounded-2xl p-6 md:p-7 relative overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent, var(--border-color), transparent)",
        }}
      />

      <h2
        className="font-display text-lg tracking-widest flex items-center gap-2 border-b pb-3 mb-5"
        style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}
      >
        <AlertTriangle
          size={18}
          style={{ color: "var(--text-muted)" }}
        />{" "}
        ОШИБКИ И НАРУШЕНИЯ
      </h2>

      {list.length === 0 ? (
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{
            background: "var(--accent-muted)",
            border: "1px solid var(--border-color)",
          }}
        >
          <CheckCircle size={20} style={{ color: "var(--accent)" }} />
          <span style={{ color: "var(--text-secondary)" }} className="font-medium">
            Нарушений и ошибок не обнаружено
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((item, i) => {
            const meta = getCategoryMeta(item.category);
            const penalty = formatPenalty(item.penalty);
            const labelColor = meta.positive ? "var(--accent)" : "var(--text-primary)";

            return (
              <div
                key={`${item.category}-${i}`}
                className="flex items-start justify-between gap-4 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm md:text-base" style={{ color: labelColor }}>
                    {meta.label}
                  </div>
                  {item.note && (
                    <div
                      className="mt-1 text-xs md:text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.note}
                    </div>
                  )}
                </div>
                <span
                  className="shrink-0 inline-flex items-center rounded-full px-3 py-1 font-mono text-xs"
                  style={{
                    background: penalty.bg,
                    border: `1px solid ${penalty.border}`,
                    color: penalty.color,
                  }}
                >
                  {penalty.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
