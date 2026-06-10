"use client";

/**
 * LessonQuiz — мини-проверка после урока (Course Progress Этап 1).
 *
 * 3 вопроса, ответ засчитывается строго 3/3, правильные НЕ подсвечиваются,
 * 3 попытки. После 3 неудач — «пересмотрите урок» (rewatch сбрасывает попытки).
 * Грейдинг на сервере; правильные ответы на клиент не приходят.
 */
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Loader2, RotateCcw } from "lucide-react";
import { coursesApi, type LessonQuiz as Quiz, type QuizSubmitResult } from "@/lib/courses";

interface LessonQuizProps {
  slug: string;
  lessonIndex: number;
  lessonTitle: string;
  onClose: () => void;
  onPassed: () => void;
}

export default function LessonQuiz({ slug, lessonIndex, lessonTitle, onClose, onPassed }: LessonQuizProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setResult(null);
      setError("");
      try {
        const q = await coursesApi.quiz(slug, lessonIndex, { signal });
        setQuiz(q);
        setAnswers(new Array(q.questions.length).fill(-1));
      } catch {
        setError("Не удалось загрузить проверку. Попробуйте позже.");
      } finally {
        setLoading(false);
      }
    },
    [slug, lessonIndex],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const attemptsLeft = quiz ? Math.max(0, quiz.max_attempts - (result?.attempts_used ?? quiz.attempts_used)) : 0;
  const allAnswered = answers.length > 0 && answers.every((a) => a >= 0);
  const alreadyDone = (quiz?.completed ?? false) || (result?.completed ?? false);

  const onSubmit = useCallback(async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await coursesApi.submit(slug, lessonIndex, answers);
      setResult(res);
      if (res.passed) onPassed();
    } catch {
      setError("Не удалось отправить ответы. Попробуйте позже.");
    } finally {
      setSubmitting(false);
    }
  }, [allAnswered, submitting, slug, lessonIndex, answers, onPassed]);

  const onRewatch = useCallback(async () => {
    try {
      await coursesApi.rewatch(slug, lessonIndex);
    } catch {
      /* best-effort; reload resets the local view either way */
    }
    await load();
  }, [slug, lessonIndex, load]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, var(--text-primary) 45%, transparent)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[88vh] w-full max-w-[600px] overflow-y-auto rounded-2xl p-6 sm:p-8"
        style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-lg)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
        >
          <X size={15} />
        </button>

        <div className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          Мини-проверка · урок {String(lessonIndex + 1).padStart(2, "0")}
        </div>
        <h3 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {lessonTitle}
        </h3>

        {loading ? (
          <div className="flex items-center gap-2 py-10" style={{ color: "var(--text-secondary)" }}>
            <Loader2 size={16} className="animate-spin" /> Загрузка…
          </div>
        ) : error && !quiz ? (
          <p className="py-8 text-sm" style={{ color: "var(--danger, #c0392b)" }}>{error}</p>
        ) : alreadyDone ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--primary-muted, color-mix(in srgb, var(--primary) 15%, transparent))", color: "var(--primary)" }}>
              <Check size={22} />
            </span>
            <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>Урок пройден</p>
            <button type="button" onClick={onClose} className="mt-2 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}>
              Готово
            </button>
          </div>
        ) : (
          <>
            {/* questions */}
            <div className="mt-6 space-y-6">
              {quiz!.questions.map((q, qi) => (
                <div key={qi}>
                  <p className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {qi + 1}. {q.q}
                  </p>
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt, oi) => {
                      const selected = answers[qi] === oi;
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={!!result}
                          onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors disabled:opacity-70"
                          style={{
                            border: `1px solid ${selected ? "var(--primary)" : "var(--border-color)"}`,
                            background: selected ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent",
                            color: "var(--text-primary)",
                          }}
                        >
                          <span
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                            style={{ border: `1px solid ${selected ? "var(--primary)" : "var(--border-color)"}` }}
                          >
                            {selected && <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* result / actions — no per-answer highlight, only pass/fail + attempts */}
            {result && !result.passed && (
              <div
                className="mt-6 rounded-xl p-4 text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
              >
                {attemptsLeft > 0 ? (
                  <>Не все ответы верны. Осталось попыток: <b style={{ color: "var(--text-primary)" }}>{attemptsLeft}</b>. Проверьте ответы и попробуйте снова.</>
                ) : (
                  <>Попытки исчерпаны. Пересмотрите урок и пройдите проверку заново.</>
                )}
              </div>
            )}
            {error && <p className="mt-4 text-sm" style={{ color: "var(--danger, #c0392b)" }}>{error}</p>}

            <div className="mt-6 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                Нужно 3 из 3 · попытка {Math.min((result?.attempts_used ?? quiz!.attempts_used) + (result ? 0 : 1), quiz!.max_attempts)}/{quiz!.max_attempts}
              </span>

              {result && !result.passed && attemptsLeft === 0 ? (
                <button type="button" onClick={onRewatch} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}>
                  <RotateCcw size={15} /> Пройти заново
                </button>
              ) : result && !result.passed ? (
                <button type="button" onClick={() => { setResult(null); }} className="rounded-full px-5 py-2.5 text-sm font-semibold" style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}>
                  Попробовать снова
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!allAnswered || submitting}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
                  style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                  Проверить
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
