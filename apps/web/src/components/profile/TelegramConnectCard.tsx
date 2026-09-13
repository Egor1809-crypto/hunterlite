"use client";
import { useEffect, useState } from "react";
import { Send, Check } from "@/components/ui/RuneIcons";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AttemptBalance } from "@/lib/trainingDay";
export function TelegramConnectCard() {
  const user = useAuthStore((s) => s.user);
  const linked = !!user?.telegram_linked;
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<AttemptBalance | null>(null);
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const b = await api.get<AttemptBalance>("/training-map/attempts");
        if (!disposed) setBalance(b);
        if (url && !linked) {
          useAuthStore.getState().invalidate();
          await useAuthStore.getState().fetchUser();
        }
      } catch {
        /* explicit link errors appear below; existing balance remains readable */
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = url && !linked ? setInterval(refresh, 4000) : undefined;
    // Polling is bounded; a return to the page always refreshes again.
    const stop = setTimeout(() => clearInterval(interval), 120000);
    return () => {
      disposed = true;
      clearInterval(interval);
      clearTimeout(stop);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [url, linked]);
  return (
    <section
      className="rounded-xl p-5"
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div className="flex items-center gap-3">
        <Send size={24} />
        {linked && (
          <span className="ml-auto flex items-center gap-2 text-sm">
            <Check size={16} />
            Подключён
          </span>
        )}
      </div>
      <p
        className="mt-3 text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {linked
          ? "Прогресс и баланс доступны в @BFLHUNTER_bot."
          : "Привяжите @BFLHUNTER_bot, чтобы видеть свой прогресс и баланс попыток."}
      </p>
      {!linked &&
        (url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="call-primary mt-4"
          >
            Открыть бота и нажать «Запустить»
          </a>
        ) : (
          <button
            className="call-primary mt-4"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await api.post<{ deeplink: string }>(
                  "/training-map/telegram/link",
                  {},
                );
                setUrl(r.deeplink);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Не удалось создать ссылку. Попробуйте ещё раз.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Подготавливаю ссылку…" : "Привязать Telegram"}
          </button>
        ))}
      {url && !linked && (
        <p role="status" className="text-sm mt-3">
          После подтверждения в Telegram статус обновится автоматически.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3">
          {error}
        </p>
      )}
      <div
        className="mt-5 pt-5 border-t"
        style={{ borderColor: "var(--border-color)" }}
      >
        <h3 className="text-lg font-semibold">10 попыток · 1 499 ₽</h3>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Общие для всех тестов. Действуют до 00:00 по Москве в день оплаты.
        </p>
        <p className="text-sm mt-2">
          Покупка пока недоступна — оплата ещё не подключена.
        </p>
        {balance && (
          <p className="text-sm mt-3">
            Дополнительных попыток сегодня:{" "}
            <strong>{balance.paid_remaining}</strong>
          </p>
        )}
      </div>
    </section>
  );
}
