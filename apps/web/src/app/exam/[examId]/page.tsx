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
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;
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

const EXAM_COLORS: Record<string, string> = {
  "exam-1": "#3B82F6",
  "exam-2": "#F59E0B",
  "exam-3": "#EC4899",
  "exam-4": "#6366F1",
  "exam-5": "#22C55E",
};

const RULE_TYPES = new Set(["mcq", "multi_select", "numeric", "sequencing", "matching"]);

export default function ExamPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;
  const color = EXAM_COLORS[examId] ?? "#8B5CF6";

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
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <Loader2 size={32} className="animate-spin" style={{ color }} />
        </div>
      </AuthLayout>
    );
  }

  if (error && !result) {
    return (
      <AuthLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <div className="text-center max-w-sm px-4">
            <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: "var(--danger)" }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Ошибка</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{error}</p>
            <button onClick={() => router.push("/exam")} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: color, color: "#fff" }}>
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
      ? { label: "Оценивается", clr: "#F59E0B", Icon: Clock3 }
      : result.passed
        ? { label: "Сдан", clr: "#22C55E", Icon: Award }
        : { label: "Не сдан", clr: "#EF4444", Icon: XCircle };

    return (
      <AuthLayout>
        <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <div className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]" style={{ background: `radial-gradient(circle, ${grade.clr} 0%, transparent 70%)` }} />
          </div>
          <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

          <div className="relative z-10 max-w-[680px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${grade.clr}15` }}>
                  <grade.Icon size={36} style={{ color: grade.clr }} className={pending ? "animate-pulse" : ""} />
                </div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>{grade.label}</h1>
                {!result.time_valid && (
                  <p className="text-xs mt-1" style={{ color: "#EF4444" }}>Превышено время — сертификат не выдан.</p>
                )}
              </div>

              <div className="rounded-2xl p-6 mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="grid grid-cols-3 gap-4 text-center mb-6">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: grade.clr }}>{result.score_percent}%</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Результат</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{result.weighted_score}/{result.max_weighted_score}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Баллы</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{result.pass_threshold}%</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Порог</div>
                  </div>
                </div>
                <div className="w-full h-3 rounded-full relative mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="absolute top-0 h-full w-[1px]" style={{ left: `${result.pass_threshold}%`, background: "rgba(255,255,255,0.3)" }} />
                  <motion.div className="h-full rounded-full" style={{ background: grade.clr }} initial={{ width: 0 }} animate={{ width: `${result.score_percent}%` }} transition={{ duration: 1, delay: 0.3 }} />
                </div>
              </div>

              {pending && (
                <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <Clock3 size={20} style={{ color: "#F59E0B" }} />
                  <div className="flex-1">
                    <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Оценка ИИ не завершена</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Сервис был недоступен. Запустите пере-оценку.</div>
                  </div>
                  <button onClick={handleRegrade} disabled={regrading} className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5" style={{ background: "#F59E0B", color: "#000" }}>
                    {regrading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Пере-оценить
                  </button>
                </div>
              )}

              {result.passed && result.certificate_code && (
                <div className="rounded-xl p-4 mb-6 flex items-center gap-3 cursor-pointer" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }} onClick={() => router.push(`/exam/certificate/${examId}`)}>
                  <Award size={20} style={{ color: "#F59E0B" }} />
                  <div className="flex-1">
                    <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Сертификат выдан!</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Код: {result.certificate_code}</div>
                  </div>
                  <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>Открыть</span>
                </div>
              )}

              {/* Per-item breakdown */}
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Разбор заданий</h3>
                {result.results.map((r, i) => {
                  const ok = r.passed;
                  const isAI = !RULE_TYPES.has(r.type);
                  return (
                    <div key={r.item_id} className="rounded-xl p-4" style={{ background: ok ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)", border: `1px solid ${ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}` }}>
                      <div className="flex items-start gap-2 mb-2">
                        {ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "#22C55E" }} /> : <XCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#EF4444" }} />}
                        <span className="text-xs font-bold flex-1" style={{ color: "var(--text-primary)" }}>{i + 1}. {r.prompt}</span>
                        <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--text-muted)" }}>{r.score}/{r.max_score}</span>
                      </div>

                      {isAI && r.covered.length > 0 && (
                        <div className="ml-5 mb-1">
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: "#22C55E" }}>Раскрыто</span>
                          <ul className="text-xs mt-0.5 space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                            {r.covered.map((c, k) => <li key={k}>✓ {c}</li>)}
                          </ul>
                        </div>
                      )}
                      {isAI && r.missed.length > 0 && (
                        <div className="ml-5 mb-1">
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: "#EF4444" }}>Упущено</span>
                          <ul className="text-xs mt-0.5 space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                            {r.missed.map((c, k) => <li key={k}>— {c}</li>)}
                          </ul>
                        </div>
                      )}
                      {isAI && r.feedback && (
                        <p className="ml-5 text-xs mt-1 italic" style={{ color: "var(--text-muted)" }}>{r.feedback}</p>
                      )}
                      {!isAI && r.explanation && (
                        <p className="ml-5 text-xs" style={{ color: "var(--text-secondary)" }}>{r.explanation}</p>
                      )}
                      {r.article_reference && (
                        <span className="ml-5 inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${color}15`, color }}>{r.article_reference}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={() => router.push("/exam")} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)" }}>
                  <ArrowLeft size={14} /> Экзамены
                </button>
                {!result.passed && !pending && (
                  <button onClick={() => window.location.reload()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold" style={{ background: color, color: "#fff" }}>
                    <RotateCcw size={14} /> Пересдать
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

  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]" style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }} />
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

        <div className="relative z-10 max-w-[680px] mx-auto px-5 sm:px-8 py-6 sm:py-10">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => router.push("/exam")} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              <ArrowLeft size={14} /> Выйти
            </button>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: remainingSeconds < 300 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.06)", border: `1px solid ${remainingSeconds < 300 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, color: remainingSeconds < 300 ? "#EF4444" : "var(--text-primary)" }}>
              <Timer size={12} /> {formatTime(remainingSeconds)}
            </span>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Задание {currentIndex + 1} из {total}</span>
              <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>Отвечено: {answeredCount} · Порог {passThreshold}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${((currentIndex + 1) / total) * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={current.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: PREMIUM_EASE }}>
              <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, transparent 80%)` }} />
                <div className="p-6">
                  {current.payload.fact_pattern && (
                    <div className="mb-3 p-3 rounded-lg text-xs leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)" }}>
                      {current.payload.fact_pattern}
                    </div>
                  )}
                  <h2 className="text-base font-bold leading-relaxed" style={{ color: "var(--text-primary)" }}>{current.prompt}</h2>
                  <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${color}15`, color }}>{current.points} балл(ов)</span>
                </div>
              </div>

              <ItemInput item={current} value={answers[current.id]} onChange={(v) => setAnswer(current.id, v)} color={color} />

              <div className="flex gap-3 mt-6">
                {!isLast ? (
                  <button onClick={() => setCurrentIndex((p) => p + 1)} className="flex-1 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: color, color: "#fff" }}>
                    Далее <ArrowRight size={16} />
                  </button>
                ) : (
                  <button onClick={() => {
                    const blank = total - answeredCount;
                    if (blank > 0 && !window.confirm(`${blank} задани(й) без ответа — они будут оценены в 0 баллов. Завершить экзамен?`)) return;
                    handleSubmit();
                  }} disabled={submitting} className="flex-1 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: color, color: "#fff" }}>
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                    {submitting ? "Оценка..." : "Завершить экзамен"}
                  </button>
                )}
              </div>
              {currentIndex > 0 && (
                <button onClick={() => setCurrentIndex((p) => p - 1)} className="w-full mt-3 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }}>
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
            <button key={opt.id} onClick={() => onChange(opt.id)} className="w-full text-left rounded-xl p-4 flex items-start gap-3 transition-all" style={{ background: selected ? `${color}10` : "rgba(255,255,255,0.03)", border: `1.5px solid ${selected ? `${color}60` : "rgba(255,255,255,0.06)"}` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: selected ? `${color}20` : "rgba(255,255,255,0.06)", color: selected ? color : "var(--text-muted)" }}>{String.fromCharCode(65 + i)}</div>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>{opt.text}</span>
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
            <button key={opt.id} onClick={() => toggle(opt.id)} className="w-full text-left rounded-xl p-4 flex items-start gap-3" style={{ background: selected ? `${color}10` : "rgba(255,255,255,0.03)", border: `1.5px solid ${selected ? `${color}60` : "rgba(255,255,255,0.06)"}` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: selected ? `${color}20` : "rgba(255,255,255,0.06)", color: selected ? color : "var(--text-muted)" }}>{selected ? "✓" : String.fromCharCode(65 + i)}</div>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>{opt.text}</span>
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
          style={{ background: "rgba(255,255,255,0.03)", border: `1.5px solid ${color}40`, color: "var(--text-primary)" }}
        />
        {item.payload.unit && <span className="text-xs mt-1 inline-block" style={{ color: "var(--text-muted)" }}>Единица: {item.payload.unit}</span>}
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
            <div key={sid} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${color}20`, color }}>{idx + 1}</span>
              <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{step?.text}</span>
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
          <div key={l.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-sm font-medium flex-1" style={{ color: "var(--text-primary)" }}>{l.text}</span>
            <select
              value={pairs[l.id] ?? ""}
              onChange={(e) => onChange({ ...pairs, [l.id]: e.target.value })}
              className="rounded-lg px-2 py-1.5 text-xs outline-none max-w-[55%]"
              style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${color}40`, color: "var(--text-primary)" }}
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
      className="w-full rounded-xl p-4 text-sm leading-relaxed outline-none resize-y"
      style={{ background: "rgba(255,255,255,0.03)", border: `1.5px solid ${color}30`, color: "var(--text-primary)", minHeight: 200 }}
    />
  );
}
