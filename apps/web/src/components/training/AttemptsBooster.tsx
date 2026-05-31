"use client";

/**
 * AttemptsBooster — индикатор попыток + счётчик до обновления + докупка (Task #6).
 *
 * Поведение:
 *   • Показывает потраченные / оставшиеся попытки на уровень в виде «пунктов».
 *   • Когда попытки закончились — живой счётчик до обновления (следующая
 *     полночь по UTC: именно тогда normalizeProgress сбрасывает attempts).
 *   • Виджет докупки ещё 5 попыток. Оплата ещё не подключена — пилотный
 *     доступ выдаёт буст мгновенно (как `pilot mode` в subscription).
 *
 * Визуальный язык — сдержанный «vibe» платформы (молочные поверхности,
 * сиреневый акцент, много воздуха, моноширинный счётчик). Вдохновение:
 * malvah.co / abstract.com — премиум через минимализм и точную типографику.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Sparkles, Check, Loader2, Zap } from "lucide-react";

interface AttemptsBoosterProps {
  /** Сколько попыток уже потрачено сегодня на этот уровень. */
  used: number;
  /** Базовый лимит попыток (обычно 5). */
  baseMax: number;
  /** Докупленные сегодня попытки (буст). */
  bonus: number;
  /** Цвет острова — для акцентов, в формате "r,g,b". */
  colorRgb: string;
  /** Вызывается при подтверждении докупки. Должен зарезолвиться, когда буст применён. */
  onPurchase: () => Promise<void> | void;
  /** Размер пакета докупки. */
  packSize?: number;
  /** Цена пакета (для отображения). */
  priceLabel?: string;
}

/** Миллисекунды до следующей полуночи по UTC — момент сброса attempts. */
function msUntilNextUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(0, next - now.getTime());
}

function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function AttemptsBooster({
  used,
  baseMax,
  bonus,
  colorRgb,
  onPurchase,
  packSize = 5,
  priceLabel = "149 ₽",
}: AttemptsBoosterProps) {
  const effectiveMax = baseMax + bonus;
  const remaining = Math.max(0, effectiveMax - used);
  const exhausted = remaining <= 0;

  const [countdown, setCountdown] = useState<number>(() => msUntilNextUtcMidnight());
  const [buying, setBuying] = useState(false);
  const [justBought, setJustBought] = useState(false);

  // Живой счётчик — тикает только когда попытки кончились (нет смысла иначе).
  useEffect(() => {
    if (!exhausted) return;
    setCountdown(msUntilNextUtcMidnight());
    const t = setInterval(() => setCountdown(msUntilNextUtcMidnight()), 1000);
    return () => clearInterval(t);
  }, [exhausted]);

  // Сбрасываем «только что куплено» при изменении лимита.
  useEffect(() => {
    if (!exhausted) setJustBought(false);
  }, [exhausted]);

  const pips = useMemo(
    () => Array.from({ length: effectiveMax }, (_, i) => i < remaining),
    [effectiveMax, remaining],
  );

  const handleBuy = async () => {
    if (buying) return;
    setBuying(true);
    try {
      await onPurchase();
      setJustBought(true);
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Индикатор попыток — пункты */}
      <div
        className="rounded-xl p-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
            Попытки сегодня
          </span>
          <span
            className="font-mono text-sm font-bold tabular-nums"
            style={{ color: exhausted ? "var(--warning)" : "var(--text-primary)" }}
          >
            {remaining}/{effectiveMax}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {pips.map((filled, i) => (
            <motion.span
              key={i}
              initial={false}
              animate={{ opacity: filled ? 1 : 0.25, scale: filled ? 1 : 0.85 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="h-1.5 flex-1 rounded-full"
              style={{
                background: filled
                  ? `rgb(${colorRgb})`
                  : "var(--border-color)",
                // докупленные пункты слегка выделяем
                boxShadow: filled && i >= baseMax ? `0 0 8px rgba(${colorRgb},0.6)` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Счётчик до обновления — только когда попытки кончились */}
      <AnimatePresence>
        {exhausted && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-xl p-3.5"
            style={{
              background: "rgba(217,119,6,0.07)",
              border: "1px solid rgba(217,119,6,0.22)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <Clock size={15} style={{ color: "var(--warning)" }} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Свободные попытки вернутся через
                </div>
              </div>
              <div
                className="font-mono text-lg font-bold tabular-nums"
                style={{ color: "var(--warning)" }}
              >
                {formatCountdown(countdown)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Виджет докупки */}
      <AnimatePresence mode="wait">
        {exhausted && justBought ? (
          <motion.div
            key="bought"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
            style={{
              background: `rgba(${colorRgb},0.1)`,
              border: `1px solid rgba(${colorRgb},0.3)`,
              color: `rgb(${colorRgb})`,
            }}
          >
            <Check size={16} /> Готово — +{packSize} попыток
          </motion.div>
        ) : exhausted ? (
          <motion.div
            key="offer"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden rounded-xl"
            style={{
              background: `linear-gradient(135deg, rgba(${colorRgb},0.10), rgba(${colorRgb},0.03))`,
              border: `1px solid rgba(${colorRgb},0.25)`,
            }}
          >
            <div className="flex items-center gap-3 p-3.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `rgba(${colorRgb},0.14)` }}
              >
                <Sparkles size={18} style={{ color: `rgb(${colorRgb})` }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  +{packSize} попыток сейчас
                </div>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Не теряй темп — продолжай без паузы
                </div>
              </div>
            </div>
            <button
              onClick={handleBuy}
              disabled={buying}
              className="flex w-full items-center justify-center gap-2 py-3 text-sm font-bold transition-all hover:brightness-105 disabled:opacity-60"
              style={{
                background: `rgb(${colorRgb})`,
                color: "#fff",
              }}
            >
              {buying ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <>
                  <Zap size={15} />
                  Разблокировать · {priceLabel}
                </>
              )}
            </button>
            <div
              className="px-3.5 py-1.5 text-center text-[10px]"
              style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-color)" }}
            >
              Пилотный доступ — оплата скоро, сейчас бесплатно
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
