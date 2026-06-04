"use client";

/**
 * TelegramConnectCard — привязка аккаунта к @BFLHUNTER_bot прямо из профиля.
 *
 * Бот — единая экосистема платформы: начисление и докупка попыток,
 * статус прогресса, уведомления. Привязка одноразовым deeplink'ом
 * (`/training-map/telegram/link` → t.me/<bot>?start=link_<token>).
 *
 * Визуальный язык — наш «vibe» (var(--*) токены, стекло, воздух) с
 * аккуратным телеграм-синим акцентом. Вдохновение: malvah/abstract —
 * премиум через минимализм.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Check, Loader2, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

const TG_BLUE = "42,158,217"; // #2A9ED9 — telegram brand, в формате r,g,b

interface LinkResponse {
  deeplink: string;
  telegram_linked: boolean;
}

export function TelegramConnectCard() {
  const user = useAuthStore((s) => s.user);
  const refresh = useAuthStore((s) => s.fetchUser);
  const invalidate = useAuthStore((s) => s.invalidate);
  const linked = !!user?.telegram_linked;

  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);

  const handleConnect = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = (await api.post("/training-map/telegram/link", {})) as LinkResponse;
      if (res?.deeplink) {
        window.open(res.deeplink, "_blank", "noopener,noreferrer");
        setOpened(true);
      }
      // Привязка происходит на стороне бота — сбрасываем кэш и подтягиваем
      // свежий статус через пару секунд (fetchUser иначе вернёт кэш).
      setTimeout(() => { invalidate?.(); void refresh?.(); }, 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        // Solid surface (token-based) — раньше плашка была полупрозрачной
        // (rgba TG-blue 0.08→0.02) и «протекала» сквозь фон страницы в тёмной
        // теме. Телеграм-синий оставляем только на иконке и кнопке как акцент.
        background: "var(--surface-card)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-4 p-5">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `rgba(${TG_BLUE},0.14)`, border: `1px solid rgba(${TG_BLUE},0.28)` }}
        >
          {linked ? (
            <Check size={20} style={{ color: `rgb(${TG_BLUE})` }} />
          ) : (
            <Send size={18} style={{ color: `rgb(${TG_BLUE})` }} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: `rgb(${TG_BLUE})` }}>
            Telegram
          </div>
          <div className="mt-0.5 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {linked ? "Аккаунт привязан" : "Подключить @BFLHUNTER_bot"}
          </div>
          <div className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {linked
              ? "Попытки, статус прогресса и уведомления — в боте."
              : "Докупка попыток, статус и уведомления в одном месте."}
          </div>
        </div>

        {linked ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold"
            style={{ background: `rgba(${TG_BLUE},0.12)`, color: `rgb(${TG_BLUE})` }}
          >
            <Check size={12} /> Активно
          </span>
        ) : (
          <motion.button
            onClick={handleConnect}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold transition disabled:opacity-60"
            style={{ background: `rgb(${TG_BLUE})`, color: "#fff" }}
            whileHover={loading ? undefined : { scale: 1.03 }}
            whileTap={loading ? undefined : { scale: 0.97 }}
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : opened ? (
              <>
                <ArrowUpRight size={14} /> Открыть бота
              </>
            ) : (
              <>
                <Send size={14} /> Привязать
              </>
            )}
          </motion.button>
        )}
      </div>

      {opened && !linked && (
        <div
          className="px-5 py-2 text-center text-[11px]"
          style={{ color: "var(--text-muted)", borderTop: `1px solid rgba(${TG_BLUE},0.18)` }}
        >
          Открыли Telegram — нажмите «Запустить» в боте, статус обновится автоматически.
        </div>
      )}
    </div>
  );
}
