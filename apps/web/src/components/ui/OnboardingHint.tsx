"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";

interface OnboardingHintProps {
  /** Стабильный id — ключ запоминания «уже показано» (localStorage). */
  id: string;
  /** Заголовок подсказки. */
  title?: string;
  /** Короткое вступление над шагами (опционально). */
  intro?: string;
  /** Пронумерованные шаги «как пользоваться». */
  steps?: string[];
  /** Произвольное содержимое вместо/после шагов. */
  children?: ReactNode;
  /** Текст свёрнутой пилюли рядом с «i». */
  collapsedLabel?: string;
  className?: string;
}

const KEY_PREFIX = "hh:onboarding:";

/**
 * Онбординг-подсказка «как пользоваться» для типовой страницы.
 *
 * Поведение:
 *  - Первый визит (нет отметки в localStorage) — показывается развёрнутый блок.
 *  - Кнопка «Понятно» сворачивает блок в иконку «i» и ЗАПОМИНАЕТ это —
 *    при следующих заходах блок сам не разворачивается.
 *  - Клик по «i» снова разворачивает блок (на случай «забыл»); повторное
 *    сворачивание не меняет запомненный статус.
 *
 * SSR-safe: до гидрации показывается свёрнутый вид (без мигания баннера у тех,
 * кто его уже закрыл). localStorage читается только на клиенте.
 *
 * Переиспользование:
 *   <OnboardingHint id="my-clients-guide" title="Как пользоваться"
 *     steps={["Шаг 1…", "Шаг 2…"]} />
 */
export function OnboardingHint({
  id,
  title = "Как пользоваться",
  intro,
  steps = [],
  children,
  collapsedLabel = "Как пользоваться",
  className = "",
}: OnboardingHintProps) {
  const storageKey = KEY_PREFIX + id;
  const [mounted, setMounted] = useState(false);
  // По умолчанию свёрнуто — чтобы баннер не мигал у тех, кто его уже закрыл
  // (до чтения localStorage на клиенте).
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === "1";
    } catch {
      seen = false;
    }
    setOpen(!seen); // первый раз — развёрнуто
  }, [storageKey]);

  const remember = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* приватный режим / недоступно — просто свернём на этот сеанс */
    }
    setOpen(false);
  };

  // До гидрации не рендерим разрешённый баннер (чтобы не было flash у dismissed).
  if (!mounted) return null;

  // ── Свёрнутый вид: пилюля с «i» ──
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mb-6 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors hover:opacity-80 focus:outline-none ${className}`}
        style={{
          color: "var(--text-muted)",
          border: "1px solid var(--border-color)",
          background: "transparent",
        }}
        aria-label={`${title} — открыть подсказку`}
      >
        <Info size={14} />
        {collapsedLabel}
      </button>
    );
  }

  // ── Развёрнутый вид: блок с инструкцией ──
  return (
    <section
      className={`mb-8 rounded-xl p-4 sm:p-5 ${className}`}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
      }}
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            <Info size={16} />
          </span>
          <h3 className="font-display text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={remember}
          className="inline-flex items-center justify-center rounded-full p-1 transition-colors hover:opacity-70 focus:outline-none"
          style={{ color: "var(--text-muted)" }}
          aria-label="Свернуть подсказку"
        >
          <X size={16} />
        </button>
      </div>

      {intro && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {intro}
        </p>
      )}

      {steps.length > 0 && (
        <ol className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              <span
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
              >
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}

      {children}

      <div className="mt-4">
        <button
          type="button"
          onClick={remember}
          className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors hover:opacity-90 focus:outline-none"
          style={{ background: "var(--accent)", color: "var(--accent-contrast, #fff)" }}
        >
          Понятно
        </button>
      </div>
    </section>
  );
}
