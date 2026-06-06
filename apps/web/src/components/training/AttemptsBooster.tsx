"use client";

/**
 * AttemptsBooster — индикатор попыток + счётчик до обновления + докупка (Task #6).
 *
 * Поведение:
 *   • Показывает потраченные / оставшиеся попытки на уровень в виде «пунктов».
 *   • Когда попытки закончились — живой счётчик до обновления (следующая
 *     полночь по UTC: именно тогда normalizeProgress сбрасывает attempts).
 *   • Виджет докупки попыток через @BFLHUNTER_bot — единая экосистема
 *     (привязка + начисление + уведомления). Кнопка открывает бота по
 *     одноразовому deeplink; начисление происходит на стороне бота. На
 *     пилоте — бесплатно, оплата подключится позже.
 *
 * Визуальный язык — сдержанный «vibe» платформы (молочные поверхности,
 * сиреневый акцент, много воздуха, моноширинный счётчик). Вдохновение:
 * malvah.co / abstract.com — премиум через минимализм и точную типографику.
 * Палитра захардкожена под молочно-светлую карточку модалки уровня (она
 * светлая в любой теме), поэтому var(--*) токены здесь не используются.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Sparkles, Loader2, Send } from "lucide-react";

// Молочно-светлая палитра модалки уровня (совпадает с LevelDetailModal).
const C = {
  textPrimary: "#18131D",
  textSecondary: "#6B5B7E",
  textMuted: "#9A8AAE",
  border: "#E7DAF2",
  warning: "#D97706",
} as const;

interface AttemptsBoosterProps {
  /** Сколько попыток уже потрачено сегодня на этот уровень. */
  used: number;
  /** Базовый лимит попыток (обычно 5). */
  baseMax: number;
  /** Докупленные сегодня попытки (буст). */
  bonus: number;
  /** Вызывается при подтверждении докупки. Должен зарезолвиться, когда буст применён. */
  onPurchase: () => Promise<void> | void;
  /** Размер пакета докупки. */
  packSize?: number;
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

/** Локальное время следующей полуночи по UTC — «вернутся в 03:00». */
function formatResetLocalTime(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return next.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AttemptsBooster({
  used,
  baseMax,
  bonus,
  onPurchase,
  packSize = 5,
}: AttemptsBoosterProps) {
  const effectiveMax = baseMax + bonus;
  const remaining = Math.max(0, effectiveMax - used);
  const exhausted = remaining <= 0;
  const lastOne = remaining === 1;

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
        style={{ background: "rgba(24,19,29,0.025)", border: `1px solid ${C.border}` }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: C.textMuted }}>
            Попытки сегодня
          </span>
          <span
            className="font-mono text-sm font-bold tabular-nums"
            style={{ color: exhausted ? C.warning : C.textPrimary }}
          >
            {remaining}/{effectiveMax}
          </span>
        </div>
        {lastOne && (
          <div className="mt-1 text-[10px]" style={{ color: C.warning }}>
            Последняя попытка — действуй наверняка
          </div>
        )}
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
                  ? `var(--primary)`
                  : C.border,
                // докупленные пункты слегка выделяем
                boxShadow: filled && i >= baseMax ? `0 0 8px color-mix(in srgb, var(--primary) 60%, transparent)` : "none",
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
              <Clock size={15} style={{ color: C.warning }} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px]" style={{ color: C.textSecondary }}>
                  Новые попытки откроются через
                </div>
                <div className="text-[10px]" style={{ color: C.textMuted }}>
                  Это произойдёт в {formatResetLocalTime()}
                </div>
              </div>
              <div
                className="font-mono text-lg font-bold tabular-nums"
                style={{ color: C.warning }}
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
            key="opened"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-[13px] font-bold"
            style={{
              background: `color-mix(in srgb, var(--primary) 10%, transparent)`,
              border: `1px solid color-mix(in srgb, var(--primary) 30%, transparent)`,
              color: `var(--primary)`,
            }}
          >
            <Send size={15} /> Открыли Telegram — заберите попытки там
          </motion.div>
        ) : exhausted ? (
          <motion.div
            key="offer"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden rounded-xl"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, transparent), color-mix(in srgb, var(--primary) 3%, transparent))`,
              border: `1px solid color-mix(in srgb, var(--primary) 25%, transparent)`,
            }}
          >
            <div className="flex items-center gap-3 p-3.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, var(--primary) 14%, transparent)` }}
              >
                <Sparkles size={18} style={{ color: `var(--primary)` }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold" style={{ color: C.textPrimary }}>
                  +{packSize} попыток через бота
                </div>
                <div className="text-[11px]" style={{ color: C.textMuted }}>
                  Не теряй темп — продолжай без паузы
                </div>
              </div>
            </div>
            <button
              onClick={handleBuy}
              disabled={buying}
              className="flex w-full items-center justify-center gap-2 py-3 text-sm font-bold transition-all hover:brightness-105 disabled:opacity-60"
              style={{
                background: `var(--primary)`,
                color: "#fff",
              }}
            >
              {buying ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <>
                  <Send size={15} />
                  Получить в Telegram
                </>
              )}
            </button>
            <div
              className="px-3.5 py-1.5 text-center text-[10px]"
              style={{ color: C.textMuted, borderTop: `1px solid ${C.border}` }}
            >
              @BFLHUNTER_bot · на пилоте бесплатно
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
