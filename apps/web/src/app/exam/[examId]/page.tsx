"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Award,
  Timer,
  RotateCcw,
  Loader2,
  Clock3,
  Check,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Opt = { id: string; text: string };

interface ExamItem {
  id: string;
  type: string;
  prompt: string;
  points: number;
  article_reference: string | null;
  payload: {
    fact_pattern?: string;
    options?: Opt[];
    steps?: Opt[];
    left?: Opt[];
    right?: Opt[];
    unit?: string;
    input_hint?: string;
  };
}

interface StartResponse {
  attempt_id: string;
  exam_id: string;
  mechanic: string;
  items: ExamItem[];
  time_limit_minutes: number;
  pass_threshold: number;
}

interface ItemResult {
  item_id: string;
  type: string;
  prompt: string;
  points: number;
  score: number;
  max_score: number;
  passed: boolean;
  graded_by: string;
  article_reference: string | null;
  explanation: string;
  covered: string[];
  missed: string[];
  feedback: string;
  answer_key: Record<string, unknown> | null;
}

interface SubmitResponse {
  attempt_id: string;
  score_percent: number;
  weighted_score: number;
  max_weighted_score: number;
  passed: boolean;
  grading_status: string;
  certificate_code: string | null;
  time_valid: boolean;
  pass_threshold: number;
  results: ItemResult[];
}

// Per-exam accent — aligned with the exam list (Abstract/Malvah identity).
const EXAM_COLORS: Record<string, string> = {
  "exam-1": "#6366F1",
  "exam-2": "#F59E0B",
  "exam-3": "#EC4899",
  "exam-4": "#8B5CF6",
  "exam-5": "#10B981",
};

const RULE_TYPES = new Set(["mcq", "multi_select", "numeric", "sequencing", "matching"]);

export default function ExamPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;
  const color = EXAM_COLORS[examId] ?? "var(--primary)";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [items, setItems] = useState<ExamItem[]>([]);
  const [passThreshold, setPassThreshold] = useState(80);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [startedAt] = useState(Date.now());

  useEffect(() => {
    api
      .post<StartResponse>(`/exams/${examId}/start`, {})
      .then((data) => {
        setAttemptId(data.attempt_id);
        setItems(data.items);
        setPassThreshold(data.pass_threshold);
        setRemainingSeconds(data.time_limit_minutes * 60);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Не удалось начать экзамен");
        setLoading(false);
      });
  }, [examId]);

  useEffect(() => {
    if (loading || result) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, result]);

  const current = items[currentIndex];
  const total = items.length;

  const setAnswer = useCallback((itemId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    const timeSpent = Math.round((Date.now() - startedAt) / 1000);
    try {
      const data = await api.post<SubmitResponse>(`/exams/${examId}/submit`, {
        attempt_id: attemptId,
        answers,
        time_spent_seconds: timeSpent,
      });
      setResult(data);
      try {
        const uid = useAuthStore.getState().user?.id ?? null;
        const examKey = uid ? `hunterlite_exam_progress:${uid}` : "hunterlite_exam_progress";
        const stored = localStorage.getItem(examKey);
        const progress = stored ? JSON.parse(stored) : {};
        const existing = progress[examId];
        progress[examId] = {
          bestScore: Math.max(data.score_percent, existing?.bestScore ?? 0),
          passed: data.passed || existing?.passed || false,
          attempts: (existing?.attempts ?? 0) + 1,
        };
        localStorage.setItem(examKey, JSON.stringify(progress));
      } catch {
        /* localStorage best-effort */
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, submitting, answers, examId, startedAt]);

  const handleRegrade = useCallback(async () => {
    if (!attemptId || regrading) return;
    setRegrading(true);
    try {
      const data = await api.post<SubmitResponse>(`/exams/attempts/${attemptId}/regrade`, {});
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось пере-оценить");
    } finally {
      setRegrading(false);
    }
  }, [attemptId, regrading]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── loading / error ──────────────────────────────────────────
  if (loading) {
    return (
      <AuthLayout>
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <Loader2 size={32} className="animate-spin" style={{ color }} />
        </div>
      </AuthLayout>
    );
  }

  if (error && !result) {
    return (
      <AuthLayout>
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <div className="max-w-sm px-4 text-center">
            <AlertTriangle size={44} className="mx-auto mb-4" style={{ color: "var(--danger)" }} />
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Ошибка</h2>
            <p className="mb-5 text-sm" style={{ color: "var(--text-secondary)" }}>{error}</p>
            <button
              onClick={() => router.push("/exam")}
              className="rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{ background: color, color: "#fff" }}
            >
              К списку экзаменов
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // ── results ───────────────────────────────────────────────────
  if (result) {
    const pending = result.grading_status === "pending";
    const grade = pending
      ? { label: "Оценивается", clr: "var(--warning)", Icon: Clock3 }
      : result.passed
        ? { label: "Экзамен сдан", clr: "var(--success)", Icon: Award }
        : { label: "Не сдан", clr: "var(--danger)", Icon: XCircle };

    return (
      <AuthLayout>
        <div className="relative min-h-screen overflow-hidden bg-page-glow" style={{ background: "var(--bg-primary)" }}>
          <AbstractBackdrop />
          <div className="relative z-10 mx-auto max-w-[680px] px-5 py-8 sm:px-8 sm:py-12">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: PREMIUM_EASE }}>
              {/* Verdict */}
              <div className="mb-8 text-center">
                <div
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl"
                  style={{ background: `color-mix(in srgb, ${grade.clr} 14%, var(--surface-card))`, border: `1px solid color-mix(in srgb, ${grade.clr} 30%, transparent)` }}
                >
                  <grade.Icon size={36} style={{ color: grade.clr }} className={pending ? "animate-pulse" : ""} />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>{grade.label}</h1>
                {!result.time_valid && (
                  <p className="mt-1.5 text-[13px]" style={{ color: "var(--danger)" }}>Превышено время — сертификат не выдан.</p>
                )}
              </div>

              {/* Score panel */}
              <div className="mb-6 overflow-hidden rounded-2xl" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <div className="h-1 w-full" style={{ background: grade.clr }} />
                <div className="p-6">
                  <div className="mb-6 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="font-mono text-[28px] font-semibold tabular-nums" style={{ color: grade.clr }}>{result.score_percent}%</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>Результат</div>
                    </div>
                    <div>
                      <div className="font-mono text-[28px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{result.weighted_score}/{result.max_weighted_score}</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>Баллы</div>
                    </div>
                    <div>
                      <div className="font-mono text-[28px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{result.pass_threshold}%</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>Порог</div>
                    </div>
                  </div>
                  <div className="relative mb-1 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-tertiary)" }}>
                    <div className="absolute top-0 z-10 h-full w-[2px]" style={{ left: `${result.pass_threshold}%`, background: "var(--text-muted)" }} />
                    <motion.div className="h-full rounded-full" style={{ background: grade.clr }} initial={{ width: 0 }} animate={{ width: `${result.score_percent}%` }} transition={{ duration: 1, delay: 0.3 }} />
                  </div>
                </div>
              </div>

              {pending && (
                <div className="mb-6 flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--warning-muted)", border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)" }}>
                  <Clock3 size={20} style={{ color: "var(--warning)" }} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Оценка ИИ не завершена</div>
                    <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Сервис был недоступен. Запустите пере-оценку.</div>
                  </div>
                  <button onClick={handleRegrade} disabled={regrading} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold" style={{ background: "var(--warning)", color: "#fff" }}>
                    {regrading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Пере-оценить
                  </button>
                </div>
              )}

              {result.passed && result.certificate_code && (
                <button onClick={() => router.push(`/exam/certificate/${examId}`)} className="mb-6 flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-transform hover:scale-[1.01]" style={{ background: "var(--primary-muted)", border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)" }}>
                  <Award size={20} style={{ color: "var(--primary)" }} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Сертификат выдан</div>
                    <div className="font-mono text-[12px]" style={{ color: "var(--text-secondary)" }}>Код: {result.certificate_code}</div>
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: "var(--primary)" }}>Открыть</span>
                </button>
              )}

              {/* Per-item breakdown */}
              <div className="mb-6 space-y-3">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Разбор заданий</h3>
                {result.results.map((r, i) => {
                  const ok = r.passed;
                  const isAI = !RULE_TYPES.has(r.type);
                  const tint = ok ? "var(--success)" : "var(--danger)";
                  return (
                    <div key={r.item_id} className="rounded-2xl p-4" style={{ background: "var(--surface-card)", border: `1px solid color-mix(in srgb, ${tint} 22%, var(--border-color))` }}>
                      <div className="mb-2 flex items-start gap-2.5">
                        {ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} /> : <XCircle size={15} className="mt-0.5 shrink-0" style={{ color: "var(--danger)" }} />}
                        <span className="flex-1 text-[13px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{i + 1}. {r.prompt}</span>
                        <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums" style={{ color: tint }}>{r.score}/{r.max_score}</span>
                      </div>

                      {isAI && r.covered.length > 0 && (
                        <div className="mb-1.5 ml-6">
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--success)" }}>Раскрыто</span>
                          <ul className="mt-1 space-y-0.5 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                            {r.covered.map((c, k) => <li key={k} className="flex gap-1.5"><Check size={13} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {isAI && r.missed.length > 0 && (
                        <div className="mb-1.5 ml-6">
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--danger)" }}>Упущено</span>
                          <ul className="mt-1 space-y-0.5 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                            {r.missed.map((c, k) => <li key={k} className="flex gap-1.5"><span style={{ color: "var(--danger)" }}>—</span>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {isAI && r.feedback && (
                        <p className="ml-6 mt-1 text-[12.5px] italic leading-relaxed" style={{ color: "var(--text-muted)" }}>{r.feedback}</p>
                      )}
                      {!isAI && r.explanation && (
                        <p className="ml-6 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r.explanation}</p>
                      )}
                      {r.article_reference && (
                        <span className="ml-6 mt-1.5 inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{r.article_reference}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={() => router.push("/exam")} className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  <ArrowLeft size={15} /> Экзамены
                </button>
                {!result.passed && !pending && (
                  <button onClick={() => window.location.reload()} className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold" style={{ background: color, color: "#fff" }}>
                    <RotateCcw size={15} /> Пересдать
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // ── question screen ───────────────────────────────────────────
  if (!current) return null;
  const isLast = currentIndex + 1 >= total;
  const answeredCount = Object.keys(answers).filter((k) => {
    const v = answers[k];
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }).length;
  const lowTime = remainingSeconds < 300;

  return (
    <AuthLayout>
      <div className="relative min-h-screen overflow-hidden bg-page-glow" style={{ background: "var(--bg-primary)" }}>
        <AbstractBackdrop />
        <div className="relative z-10 mx-auto max-w-[680px] px-5 py-6 sm:px-8 sm:py-10">
          <div className="mb-6 flex items-center justify-between">
            <button onClick={() => router.push("/exam")} className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft size={15} /> Выйти
            </button>
            <span
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[12px] font-semibold tabular-nums"
              style={{
                background: lowTime ? "var(--danger-muted)" : "var(--surface-card)",
                border: `1px solid ${lowTime ? "color-mix(in srgb, var(--danger) 40%, transparent)" : "var(--border-color)"}`,
                color: lowTime ? "var(--danger)" : "var(--text-primary)",
              }}
            >
              <Timer size={13} /> {formatTime(remainingSeconds)}
            </span>
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>Задание {currentIndex + 1} / {total}</span>
              <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>Отвечено {answeredCount} · порог {passThreshold}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-tertiary)" }}>
              <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${((currentIndex + 1) / total) * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={current.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: PREMIUM_EASE }}>
              <div className="mb-5 overflow-hidden rounded-2xl" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 14%, transparent) 70%, transparent)` }} />
                <div className="p-6">
                  {current.payload.fact_pattern && (
                    <div className="mb-4 rounded-xl p-3.5 text-[13px] leading-relaxed" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                      {current.payload.fact_pattern}
                    </div>
                  )}
                  <h2 className="text-[17px] font-semibold leading-relaxed" style={{ color: "var(--text-primary)" }}>{current.prompt}</h2>
                  <span className="mt-2.5 inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{current.points} балл(ов)</span>
                </div>
              </div>

              <ItemInput item={current} value={answers[current.id]} onChange={(v) => setAnswer(current.id, v)} color={color} />

              <div className="mt-6 flex gap-3">
                {!isLast ? (
                  <button onClick={() => setCurrentIndex((p) => p + 1)} className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold" style={{ background: color, color: "#fff" }}>
                    Далее <ArrowRight size={16} />
                  </button>
                ) : (
                  <button onClick={() => {
                    const blank = total - answeredCount;
                    if (blank > 0 && !window.confirm(`${blank} задани(й) без ответа — они будут оценены в 0 баллов. Завершить экзамен?`)) return;
                    handleSubmit();
                  }} disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold disabled:opacity-60" style={{ background: color, color: "#fff" }}>
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                    {submitting ? "Оценка…" : "Завершить экзамен"}
                  </button>
                )}
              </div>
              {currentIndex > 0 && (
                <button onClick={() => setCurrentIndex((p) => p - 1)} className="mt-3 w-full rounded-full py-2.5 text-[13px] font-medium" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                  Назад
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AuthLayout>
  );
}

// ── per-type input renderer ─────────────────────────────────────
function ItemInput({ item, value, onChange, color }: { item: ExamItem; value: unknown; onChange: (v: unknown) => void; color: string }) {
  if (item.type === "mcq") {
    return (
      <div className="space-y-2.5">
        {(item.payload.options ?? []).map((opt, i) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className="flex w-full items-start gap-3 rounded-xl p-4 text-left transition-colors"
              style={{ background: selected ? `color-mix(in srgb, ${color} 12%, var(--surface-card))` : "var(--surface-card)", border: `1.5px solid ${selected ? color : "var(--border-color)"}` }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ background: selected ? `color-mix(in srgb, ${color} 22%, transparent)` : "var(--bg-secondary)", color: selected ? color : "var(--text-muted)" }}>{String.fromCharCode(65 + i)}</div>
              <span className="text-sm leading-snug" style={{ color: "var(--text-primary)" }}>{opt.text}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (item.type === "multi_select") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (id: string) => onChange(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
    return (
      <div className="space-y-2.5">
        {(item.payload.options ?? []).map((opt, i) => {
          const selected = arr.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className="flex w-full items-start gap-3 rounded-xl p-4 text-left transition-colors"
              style={{ background: selected ? `color-mix(in srgb, ${color} 12%, var(--surface-card))` : "var(--surface-card)", border: `1.5px solid ${selected ? color : "var(--border-color)"}` }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ background: selected ? `color-mix(in srgb, ${color} 22%, transparent)` : "var(--bg-secondary)", color: selected ? color : "var(--text-muted)" }}>{selected ? <Check size={14} strokeWidth={3} /> : String.fromCharCode(65 + i)}</div>
              <span className="text-sm leading-snug" style={{ color: "var(--text-primary)" }}>{opt.text}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (item.type === "numeric") {
    return (
      <div>
        <input
          type="number"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={item.payload.input_hint ?? "Введите число"}
          className="w-full rounded-xl p-4 text-sm outline-none"
          style={{ background: "var(--input-bg)", border: `1.5px solid color-mix(in srgb, ${color} 35%, var(--border-color))`, color: "var(--text-primary)" }}
        />
        {item.payload.unit && <span className="mt-1.5 inline-block text-[12px]" style={{ color: "var(--text-muted)" }}>Единица: {item.payload.unit}</span>}
      </div>
    );
  }

  if (item.type === "sequencing") {
    const steps = item.payload.steps ?? [];
    const order: string[] = Array.isArray(value) && (value as string[]).length ? (value as string[]) : steps.map((s) => s.id);
    const move = (idx: number, dir: -1 | 1) => {
      const next = [...order];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return;
      [next[idx], next[j]] = [next[j], next[idx]];
      onChange(next);
    };
    return (
      <div className="space-y-2">
        {order.map((sid, idx) => {
          const step = steps.find((s) => s.id === sid);
          return (
            <div key={sid} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>{idx + 1}</span>
              <span className="flex-1 text-sm" style={{ color: "var(--text-primary)" }}>{step?.text}</span>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ color: "var(--text-muted)", opacity: idx === 0 ? 0.3 : 1 }}><ChevronUp size={16} /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === order.length - 1} style={{ color: "var(--text-muted)", opacity: idx === order.length - 1 ? 0.3 : 1 }}><ChevronDown size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (item.type === "matching") {
    const left = item.payload.left ?? [];
    const right = item.payload.right ?? [];
    const pairs = (value as Record<string, string>) ?? {};
    return (
      <div className="space-y-2.5">
        {left.map((l) => (
          <div key={l.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}>
            <span className="flex-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{l.text}</span>
            <select
              value={pairs[l.id] ?? ""}
              onChange={(e) => onChange({ ...pairs, [l.id]: e.target.value })}
              className="max-w-[55%] rounded-lg px-2.5 py-2 text-[12.5px] outline-none"
              style={{ background: "var(--input-bg)", border: `1px solid color-mix(in srgb, ${color} 35%, var(--border-color))`, color: "var(--text-primary)" }}
            >
              <option value="">— выбрать —</option>
              {right.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
            </select>
          </div>
        ))}
      </div>
    );
  }

  // free-text: case_analysis | document_drafting | multi_step
  return (
    <textarea
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={item.type === "document_drafting" || item.type === "multi_step" ? 14 : 10}
      placeholder="Напишите развёрнутый юридический ответ со ссылками на нормы ФЗ-127…"
      className="w-full resize-y rounded-xl p-4 text-sm leading-relaxed outline-none"
      style={{ background: "var(--input-bg)", border: `1.5px solid color-mix(in srgb, ${color} 30%, var(--border-color))`, color: "var(--text-primary)", minHeight: 200 }}
    />
  );
}
