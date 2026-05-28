"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Award,
  GraduationCap,
  Timer,
  RotateCcw,
  Loader2,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;
const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface ServerQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
}

interface QuestionResult {
  question_id: string;
  question_text: string;
  options: { id: string; text: string }[];
  chosen_option_id: string | null;
  correct_option_id: string;
  was_correct: boolean;
  explanation: string;
  article_reference: string | null;
}

interface SubmitResponse {
  score_percent: number;
  correct_count: number;
  total_count: number;
  passed: boolean;
  certificate_code: string | null;
  results: QuestionResult[];
}

const EXAM_COLORS: Record<string, string> = {
  "exam-1": "#3B82F6",
  "exam-2": "#F59E0B",
  "exam-3": "#EC4899",
  "exam-4": "#6366F1",
  "exam-5": "#F59E0B",
};

export default function ExamPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;
  const color = EXAM_COLORS[examId] ?? "#8B5CF6";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ServerQuestion[]>([]);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [startedAt] = useState(Date.now());

  useEffect(() => {
    api.post<{ attempt_id: string; questions: ServerQuestion[]; time_limit_minutes: number }>(
      `/exams/${examId}/start`,
      {},
    )
      .then(data => {
        setAttemptId(data.attempt_id);
        setQuestions(data.questions);
        setTimeLimitMinutes(data.time_limit_minutes);
        setRemainingSeconds(data.time_limit_minutes * 60);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || "Не удалось начать экзамен");
        setLoading(false);
      });
  }, [examId]);

  useEffect(() => {
    if (loading || result) return;
    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, result]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  const handleSelectOption = useCallback((optionId: string) => {
    setSelectedOption(optionId);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedOption || !currentQuestion) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: selectedOption }));
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex(prev => prev + 1);
    }
    setSelectedOption(null);
  }, [selectedOption, currentQuestion, currentIndex, totalQuestions]);

  const handleSubmit = useCallback(async (timeExpired = false) => {
    if (!attemptId || submitting) return;
    setSubmitting(true);

    const finalAnswers = { ...answers };
    if (selectedOption && currentQuestion) {
      finalAnswers[currentQuestion.id] = selectedOption;
    }

    const timeSpent = Math.round((Date.now() - startedAt) / 1000);

    try {
      const data = await api.post<SubmitResponse>(`/exams/${examId}/submit`, {
        attempt_id: attemptId,
        answers: finalAnswers,
        time_spent_seconds: timeSpent,
      });
      setResult(data);

      try {
        const stored = localStorage.getItem("hunterlite_exam_progress");
        const progress = stored ? JSON.parse(stored) : {};
        const existing = progress[examId];
        if (!existing || data.score_percent > (existing.bestScore ?? 0)) {
          progress[examId] = {
            bestScore: data.score_percent,
            passed: data.passed,
            attempts: (existing?.attempts ?? 0) + 1,
          };
        } else {
          progress[examId] = { ...existing, attempts: (existing.attempts ?? 0) + 1 };
        }
        localStorage.setItem("hunterlite_exam_progress", JSON.stringify(progress));
      } catch { /* localStorage fallback */ }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка отправки";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, submitting, answers, selectedOption, currentQuestion, examId, startedAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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
            <button
              onClick={() => router.push("/exam")}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: color, color: "#fff" }}
            >
              К списку экзаменов
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // ── Results screen ──────────────────────────────────────────
  if (result) {
    const grade = result.passed
      ? { label: "Сдан", clr: "#22C55E", Icon: Award }
      : { label: "Не сдан", clr: "#EF4444", Icon: XCircle };

    return (
      <AuthLayout>
        <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <div className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]" style={{ background: `radial-gradient(circle, ${grade.clr} 0%, transparent 70%)` }} />
          </div>
          <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

          <div className="relative z-10 max-w-[650px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${grade.clr}15`, boxShadow: `0 0 40px ${grade.clr}20` }}>
                  <grade.Icon size={36} style={{ color: grade.clr }} />
                </div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {grade.label}
                </h1>
              </div>

              <div className="rounded-2xl p-6 mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="grid grid-cols-3 gap-4 text-center mb-6">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: grade.clr }}>{result.score_percent}%</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Результат</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{result.correct_count}/{result.total_count}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Верных</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>88%</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Порог</div>
                  </div>
                </div>

                <div className="w-full h-3 rounded-full relative mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="absolute top-0 h-full w-[1px]" style={{ left: "88%", background: "rgba(255,255,255,0.3)" }} />
                  <motion.div className="h-full rounded-full" style={{ background: grade.clr }} initial={{ width: 0 }} animate={{ width: `${result.score_percent}%` }} transition={{ duration: 1, delay: 0.3 }} />
                </div>
              </div>

              {result.passed && result.certificate_code && (
                <div
                  className="rounded-xl p-4 mb-6 flex items-center gap-3 cursor-pointer"
                  style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
                  onClick={() => router.push(`/exam/certificate/${examId}`)}
                >
                  <Award size={20} style={{ color: "#F59E0B" }} />
                  <div className="flex-1">
                    <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Сертификат выдан!</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Код: {result.certificate_code}</div>
                  </div>
                  <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>Открыть</span>
                </div>
              )}

              {/* Per-question breakdown */}
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Разбор ответов</h3>
                {result.results.map((r, i) => (
                  <div
                    key={r.question_id}
                    className="rounded-xl p-4"
                    style={{
                      background: r.was_correct ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)",
                      border: `1px solid ${r.was_correct ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {r.was_correct
                        ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "#22C55E" }} />
                        : <XCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
                      }
                      <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                        {i + 1}. {r.question_text}
                      </span>
                    </div>
                    {!r.was_correct && (
                      <div className="ml-5 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                        Правильный ответ: {r.options.find(o => o.id === r.correct_option_id)?.text}
                      </div>
                    )}
                    <p className="ml-5 text-xs" style={{ color: "var(--text-secondary)" }}>{r.explanation}</p>
                    {r.article_reference && (
                      <span className="ml-5 inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${color}15`, color }}>
                        {r.article_reference}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => router.push("/exam")} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)" }}>
                  <ArrowLeft size={14} /> Экзамены
                </button>
                {!result.passed && (
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                    style={{ background: color, color: "#fff" }}
                  >
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

  // ── Question screen ──────────────────────────────────────────
  if (!currentQuestion) return null;

  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentIndex + 1 >= totalQuestions;

  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]" style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }} />
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

        <div className="relative z-10 max-w-[650px] mx-auto px-5 sm:px-8 py-6 sm:py-10">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => router.push("/exam")} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              <ArrowLeft size={14} /> Выйти
            </button>
            <div className="flex items-center gap-3">
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: remainingSeconds < 300 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${remainingSeconds < 300 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
                  color: remainingSeconds < 300 ? "#EF4444" : "var(--text-primary)",
                }}
              >
                <Timer size={12} /> {formatTime(remainingSeconds)}
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                Вопрос {currentIndex + 1} из {totalQuestions}
              </span>
              <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                Отвечено: {answeredCount}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: PREMIUM_EASE }}
            >
              <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, transparent 80%)` }} />
                <div className="p-6">
                  <h2 className="text-base font-bold leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {currentQuestion.text}
                  </h2>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2.5 mb-6">
                {currentQuestion.options.map((opt, i) => {
                  const isSelected = selectedOption === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      onClick={() => handleSelectOption(opt.id)}
                      className="w-full text-left rounded-xl p-4 flex items-start gap-3 transition-all"
                      style={{
                        background: isSelected ? `${color}10` : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${isSelected ? `${color}60` : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{
                          background: isSelected ? `${color}20` : "rgba(255,255,255,0.06)",
                          color: isSelected ? color : "var(--text-muted)",
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{opt.text}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {!isLastQuestion ? (
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedOption}
                    className="flex-1 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: selectedOption ? color : "rgba(255,255,255,0.06)",
                      color: selectedOption ? "#fff" : "var(--text-muted)",
                      opacity: selectedOption ? 1 : 0.5,
                    }}
                  >
                    Далее <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="flex-1 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                    style={{ background: color, color: "#fff" }}
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                    {submitting ? "Отправка..." : "Завершить экзамен"}
                  </button>
                )}
              </div>

              {/* Early submit option */}
              {!isLastQuestion && answeredCount > 0 && (
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="w-full mt-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }}
                >
                  {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
                  Завершить досрочно ({answeredCount}/{totalQuestions})
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AuthLayout>
  );
}
