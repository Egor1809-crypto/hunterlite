"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";

interface OnboardingHintProps {
  /** Стабильный id — ключ запоминания «уже показано» (localStorage). */
  id: string;
  /** Mono-надпись над заголовком (eyebrow). */
  eyebrow?: string;
  /** Заголовок подсказки. */
  title?: string;
  /** Короткое вступление над шагами (что это / как устроено). */
  intro?: string;
  /** Шаги «как пользоваться» — заголовок + описание каждого. */
  steps?: { title: string; body: string }[];
  /** Произвольное содержимое после шагов. */
  children?: ReactNode;
  /** Текст свёрнутой пилюли рядом с «i». */
  collapsedLabel?: string;
  className?: string;
}

const KEY_PREFIX = "hh:onboarding:";

/**
 * Онбординг-подсказка «как это работает» для типовой страницы — editorial-вид.
 *
 * Поведение:
 *  - Первый визит (нет отметки в localStorage) — показывается развёрнутый блок.
 *  - «Понятно» / крестик сворачивает в mono-пилюлю с «i» и ЗАПОМИНАЕТ это —
 *    при следующих заходах блок сам не разворачивается.
 *  - Клик по «i» снова разворачивает (на случай «забыл»); повторное сворачивание
 *    не меняет запомненный статус.
 *
 * SSR-safe: до гидрации показывается свёрнутый вид (без мигания баннера у тех,
 * кто его уже закрыл). localStorage читается только на клиенте.
 */
export function OnboardingHint({
  id,
  eyebrow = "Как это работает",
  title,
  intro,
  steps = [],
  children,
  collapsedLabel = "Как это работает",
  className = "",
}: OnboardingHintProps) {
  const storageKey = KEY_PREFIX + id;
  const [mounted, setMounted] = useState(false);
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
      /* приватный режим — просто свернём на этот сеанс */
    }
    setOpen(false);
  };

  if (!mounted) return null;

  // ── Свёрнутый вид: сдержанная mono-пилюля с «i» ──
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-opacity hover:opacity-60 focus:outline-none ${className}`}
        style={{ color: "var(--text-muted)" }}
        aria-label={`${eyebrow} — открыть`}
      >
        <Info size={13} />
        {collapsedLabel}
      </button>
    );
  }

  // ── Развёрнутый вид: editorial-панель ──
  return (
    <section
      className={`relative mb-10 overflow-hidden rounded-2xl ${className}`}
      style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}
      aria-label={title || eyebrow}
    >
      {/* тонкий акцент-рельс слева — фирменная сдержанность */}
      <span aria-hidden className="absolute left-0 top-0 h-full w-[3px]" style={{ background: "var(--accent)" }} />

      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
            {eyebrow}
          </p>
          <button
            type="button"
            onClick={remember}
            className="-mr-1 -mt-1 inline-flex items-center justify-center rounded-full p-1.5 transition-opacity hover:opacity-60 focus:outline-none"
            style={{ color: "var(--text-muted)" }}
            aria-label="Свернуть подсказку"
          >
            <X size={16} />
          </button>
        </div>

        {title && (
          <h3 className="mt-3 font-display text-xl sm:text-2xl font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
        )}

        {intro && (
          <p className="mt-3 max-w-2xl text-sm sm:text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {intro}
          </p>
        )}

        {steps.length > 0 && (
          <ol className="mt-7" style={{ borderTop: "1px solid var(--border-color)" }}>
            {steps.map((s, i) => (
              <li
                key={i}
                className="flex gap-4 py-4 sm:gap-5"
                style={{ borderBottom: "1px solid var(--border-color)" }}
              >
                <span
                  className="w-6 shrink-0 whitespace-nowrap pt-0.5 font-mono text-sm tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                    {s.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {children}

        <div className="mt-6">
          <button
            type="button"
            onClick={remember}
            className="inline-flex items-center rounded-full px-4 py-2 text-xs font-medium transition-opacity hover:opacity-90 focus:outline-none"
            style={{ background: "var(--accent)", color: "var(--accent-contrast, #fff)" }}
          >
            Понятно, скрыть
          </button>
        </div>
      </div>
    </section>
  );
}
