"use client";
import { useEffect, useState } from "react";
import { Clock, Send } from "@/components/ui/RuneIcons";
import { untilMoscowMidnight } from "@/lib/trainingDay";
interface Props {
  used: number;
  baseMax: number;
  bonus: number;
  onPurchase: () => Promise<void> | void;
  packSize?: number;
}
export function AttemptsBooster({ used, baseMax, bonus, onPurchase }: Props) {
  const [left, setLeft] = useState(untilMoscowMidnight);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setInterval(() => setLeft(untilMoscowMidnight()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.floor(left / 1000));
  const countdown = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return (
    <div className="space-y-4 text-sm">
      <p>
        Попыток на этот уровень: <strong>{Math.max(0, baseMax - used)}</strong>{" "}
        · общих дополнительных: <strong>{bonus}</strong>
      </p>
      <p
        className="flex items-center gap-2"
        style={{ color: "var(--text-secondary)" }}
      >
        <Clock size={16} />
        Обновление в 00:00 МСК · {countdown}
      </p>
      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h4 className="text-lg font-semibold">10 попыток · 1 499 ₽</h4>
        <p
          className="mt-2 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Общий пакет для всех тестов до конца дня по Москве. Покупка станет
          доступна после подключения оплаты.
        </p>
        <button
          className="call-secondary mt-4 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onPurchase();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Не удалось открыть Telegram",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send size={17} />
          {busy ? "Подготавливаю ссылку…" : "Открыть Telegram"}
        </button>
        {error && (
          <p role="alert" className="mt-3">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
