"use client";

/**
 * /reviews — public testimonial wall (read) + submit form (auth).
 *
 * Reads approved reviews from GET /api/reviews; submitting (POST) requires auth
 * and goes to moderation. Leaving a review is one of the championship entry
 * conditions (docs/contest/CHAMPIONSHIP_PLAN.md §6).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";

import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

interface Review {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
  created_at: string;
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={onChange ? () => onChange(n) : undefined}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          aria-label={`${n} из 5`}
          disabled={!onChange}
        >
          <Star
            size={onChange ? 22 : 15}
            style={{ color: n <= value ? "var(--primary)" : "var(--text-muted)" }}
            fill={n <= value ? "var(--primary)" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(isAuthenticated());
    const ctrl = new AbortController();
    api
      .get<Review[]>("/reviews", { signal: ctrl.signal })
      .then((r) => setReviews(r || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 10) {
      setError("Отзыв слишком короткий — минимум 10 символов.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/reviews", { text: text.trim(), role: role.trim(), rating });
      setDone(true);
      setText("");
      setRole("");
    } catch (err) {
      const msg = (err as Error)?.message || "";
      setError(/409/.test(msg) ? "Вы уже оставили отзыв." : "Не удалось отправить. Попробуйте позже.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <header className="mx-auto flex max-w-[900px] items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="text-xl font-extrabold tracking-tight no-underline" style={{ color: "var(--text-primary)" }}>
          Legal<span style={{ color: "var(--brand-logo-hunter, var(--primary))" }}>Hunter</span>
        </Link>
        <Link href="/championship" className="text-sm font-medium no-underline" style={{ color: "var(--text-secondary)" }}>
          Чемпионат
        </Link>
      </header>

      <main className="mx-auto max-w-[900px] px-6 py-8 sm:px-10">
        <div className="font-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>
          Отзывы
        </div>
        <h1 className="mt-3 font-semibold tracking-tight" style={{ fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
          Что говорят наши эксперты
        </h1>
        <p className="mt-4 max-w-xl text-lg" style={{ color: "var(--text-secondary)" }}>
          Реальные отзывы участников платформы. Оставить отзыв — одно из условий участия в чемпионате.
        </p>

        {/* ── Submit form ── */}
        <div className="mt-10 rounded-2xl p-6 sm:p-8" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}>
          {done ? (
            <div className="text-center">
              <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Спасибо за отзыв!</div>
              <div className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                Он появится на странице после модерации.
              </div>
            </div>
          ) : authed ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Оставить отзыв</div>
              <div>
                <label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>Оценка</label>
                <Stars value={rating} onChange={setRating} />
              </div>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Кто вы (напр. «Арбитражный управляющий»)"
                maxLength={200}
                className="w-full rounded-xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ваш отзыв о платформе…"
                rows={4}
                maxLength={2000}
                className="w-full resize-y rounded-xl px-4 py-3 text-[15px] outline-none"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
              {error && <div className="text-sm" style={{ color: "var(--danger, #e5484d)" }}>{error}</div>}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60"
                style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
              >
                {submitting ? "Отправляем…" : "Отправить отзыв"}
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Чтобы оставить отзыв, войдите в аккаунт.
              </div>
              <Link
                href="/login"
                className="rounded-full px-5 py-2.5 text-sm font-semibold no-underline"
                style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
              >
                Войти
              </Link>
            </div>
          )}
        </div>

        {/* ── Reviews list ── */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {loading ? (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Загрузка…</div>
          ) : reviews.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Пока нет одобренных отзывов — станьте первым.</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="rounded-2xl p-6" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}>
                <Stars value={r.rating} />
                <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--text-primary)" }}>{r.text}</p>
                <div className="mt-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.name}</div>
                {r.role && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{r.role}</div>}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
