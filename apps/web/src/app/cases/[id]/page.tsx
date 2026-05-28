"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ChevronRight,
  Eye,
  Search,
  Lightbulb,
  Award,
  Briefcase,
  Star,
  Info,
  GraduationCap,
  Loader2,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;
const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function getDiffConfig(level: 1 | 2 | 3) {
  switch (level) {
    case 1:
      return { label: "Базовый", color: "#22C55E", bg: "rgba(34,197,94,0.1)" };
    case 2:
      return { label: "Продвинутый", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" };
    case 3:
      return { label: "Экспертный", color: "#EF4444", bg: "rgba(239,68,68,0.1)" };
  }
}

interface CaseStep {
  id: string;
  title: string;
  narrative: string;
  context?: string;
  hidden_fact?: { clue: string; fact?: string };
  choices: {
    id: string;
    text: string;
    consequence: string;
    next_step_id: string | null;
    score_impact: number;
    is_optimal?: boolean;
    reveals_fact?: string;
  }[];
}

interface CaseDetail {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3;
  category: string;
  estimated_minutes: number;
  max_score: number;
  expert_analysis: string;
  optimal_path: string[];
  steps: CaseStep[];
}

interface StartResponse {
  attempt_id: string;
  first_step: CaseStep;
  case_title: string;
  total_steps: number;
}

interface ChooseResponse {
  consequence: string;
  is_optimal: boolean;
  score_impact: number;
  new_score: number;
  next_step: CaseStep | null;
  reveals_fact: string | null;
}

interface CompleteResponse {
  score: number;
  score_percent: number;
  max_score: number;
  choices_made: {
    step_id: string;
    choice_id: string;
    score_impact: number;
    is_optimal: boolean;
    text: string;
    consequence: string;
    step_title: string;
  }[];
  revealed_facts: string[];
  expert_analysis: string;
  optimal_path: string[];
}

export default function CasePlayerPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<CaseStep | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [score, setScore] = useState(0);
  const [revealedFacts, setRevealedFacts] = useState<string[]>([]);

  const [showConsequence, setShowConsequence] = useState(false);
  const [lastConsequence, setLastConsequence] = useState("");
  const [lastChoiceOptimal, setLastChoiceOptimal] = useState(false);
  const [nextStepData, setNextStepData] = useState<CaseStep | null>(null);

  const [showHiddenFact, setShowHiddenFact] = useState(false);
  const [factRevealed, setFactRevealed] = useState(false);
  const [factText, setFactText] = useState("");

  const [completed, setCompleted] = useState(false);
  const [completionResult, setCompletionResult] = useState<CompleteResponse | null>(null);
  const [showExpertAnalysis, setShowExpertAnalysis] = useState(false);

  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [startedAt] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMinutes(Math.floor((Date.now() - startedAt) / 60000));
    }, 10000);
    return () => clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await api.get<CaseDetail>(`/cases/${caseId}`);
        if (cancelled) return;
        setCaseData(detail);

        const startRes = await api.post<StartResponse>(`/cases/${caseId}/start`, {});
        if (cancelled) return;
        setAttemptId(startRes.attempt_id);
        setCurrentStep(startRes.first_step);
        setTotalSteps(startRes.total_steps);
        setStepIndex(0);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const handleChoice = useCallback(
    async (choiceId: string) => {
      if (!attemptId || !currentStep) return;
      try {
        const res = await api.post<ChooseResponse>(`/cases/${caseId}/choose`, {
          attempt_id: attemptId,
          step_id: currentStep.id,
          choice_id: choiceId,
        });
        setLastConsequence(res.consequence);
        setLastChoiceOptimal(res.is_optimal);
        setScore(res.new_score);
        setNextStepData(res.next_step);
        setShowConsequence(true);
        setShowHiddenFact(false);
        setFactRevealed(false);

        if (res.reveals_fact) {
          setRevealedFacts((prev) => [...prev, res.reveals_fact!]);
        }

        if (!res.next_step) {
          setCompleted(true);
        }
      } catch {
        // error handling silent
      }
    },
    [attemptId, currentStep, caseId],
  );

  const proceedToNext = useCallback(async () => {
    if (completed && attemptId) {
      try {
        const res = await api.post<CompleteResponse>(`/cases/${caseId}/complete`, {
          attempt_id: attemptId,
        });
        setCompletionResult(res);
      } catch {
        // already completed, still show results
        setCompletionResult({
          score,
          score_percent: caseData ? Math.round((score / caseData.max_score) * 100) : 0,
          max_score: caseData?.max_score ?? 100,
          choices_made: [],
          revealed_facts: revealedFacts,
          expert_analysis: caseData?.expert_analysis ?? "",
          optimal_path: caseData?.optimal_path ?? [],
        });
      }
      return;
    }
    if (nextStepData) {
      setCurrentStep(nextStepData);
      setStepIndex((prev) => prev + 1);
      setNextStepData(null);
      setShowConsequence(false);
    }
  }, [completed, attemptId, caseId, nextStepData, score, caseData, revealedFacts]);

  const revealHiddenFact = useCallback(async () => {
    if (!currentStep?.hidden_fact || !attemptId) return;
    try {
      const res = await api.post<{ fact_text: string; new_score: number; already_revealed: boolean }>(
        `/cases/${caseId}/reveal-fact`,
        { attempt_id: attemptId, step_id: currentStep.id },
      );
      setFactText(res.fact_text);
      setShowHiddenFact(true);
      setFactRevealed(true);
      setScore(res.new_score);
      if (!res.already_revealed) {
        setRevealedFacts((prev) => [...prev, res.fact_text]);
      }
    } catch {
      // silent
    }
  }, [currentStep, attemptId, caseId]);

  const restart = useCallback(async () => {
    setCompleted(false);
    setCompletionResult(null);
    setShowConsequence(false);
    setShowExpertAnalysis(false);
    setShowHiddenFact(false);
    setFactRevealed(false);
    setScore(0);
    setRevealedFacts([]);
    setStepIndex(0);

    try {
      const startRes = await api.post<StartResponse>(`/cases/${caseId}/start`, {});
      setAttemptId(startRes.attempt_id);
      setCurrentStep(startRes.first_step);
      setTotalSteps(startRes.total_steps);
    } catch {
      // silent
    }
  }, [caseId]);

  if (loading) {
    return (
      <AuthLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "#8B5CF6" }} />
        </div>
      </AuthLayout>
    );
  }

  if (!caseData) {
    return (
      <AuthLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <div className="text-center">
            <Briefcase size={48} className="mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Кейс не найден</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Этот кейс пока в разработке.</p>
            <button
              onClick={() => router.push("/cases")}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: "#8B5CF6", color: "#fff" }}
            >
              Вернуться к списку
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const diff = getDiffConfig(caseData.difficulty);
  const scorePercent = Math.round((score / caseData.max_score) * 100);

  /* ── Completion screen ──────────────────────────────────── */
  if (completionResult) {
    const sp = completionResult.score_percent;
    const grade =
      sp >= 85
        ? { label: "Отлично", color: "#22C55E", icon: Award }
        : sp >= 60
          ? { label: "Хорошо", color: "#F59E0B", icon: CheckCircle2 }
          : { label: "Можно лучше", color: "#EF4444", icon: AlertTriangle };
    const GradeIcon = grade.icon;

    return (
      <AuthLayout>
        <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <div
              className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]"
              style={{ background: `radial-gradient(circle, ${grade.color} 0%, transparent 70%)` }}
            />
          </div>
          <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

          <div className="relative z-10 max-w-[700px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
              <div className="text-center mb-8">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: `${grade.color}15`, boxShadow: `0 0 40px ${grade.color}20` }}
                >
                  <GradeIcon size={36} style={{ color: grade.color }} />
                </div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Кейс завершён</h1>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{caseData.title}</p>
              </div>

              <div
                className="rounded-2xl p-6 mb-6"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="grid grid-cols-3 gap-4 text-center mb-6">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: grade.color }}>{sp}%</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Результат</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{completionResult.choices_made.length}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Решений</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{completionResult.revealed_facts.length}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Фактов найдено</div>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: grade.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${sp}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />
                </div>
                <div className="flex justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <span>0</span>
                  <span className="font-bold" style={{ color: grade.color }}>{grade.label}</span>
                  <span>100%</span>
                </div>
              </div>

              {completionResult.choices_made.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Ваши решения</h3>
                  {completionResult.choices_made.map((cm, i) => (
                    <motion.div
                      key={cm.choice_id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="rounded-xl p-4 flex items-start gap-3"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                        style={{
                          background: cm.is_optimal ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                          color: cm.is_optimal ? "#22C55E" : "var(--text-muted)",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>{cm.step_title}</div>
                        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{cm.text}</div>
                        {cm.is_optimal && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold" style={{ color: "#22C55E" }}>
                            <CheckCircle2 size={10} /> Оптимальный выбор
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold shrink-0" style={{ color: cm.score_impact >= 25 ? "#22C55E" : "var(--text-muted)" }}>
                        +{cm.score_impact}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="rounded-2xl p-5 mb-6"
                style={{
                  background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.05) 100%)",
                  border: "1px solid rgba(139,92,246,0.2)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap size={16} style={{ color: "#8B5CF6" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8B5CF6" }}>Разбор эксперта</span>
                </div>
                {showExpertAnalysis ? (
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {completionResult.expert_analysis}
                  </p>
                ) : (
                  <button
                    onClick={() => setShowExpertAnalysis(true)}
                    className="flex items-center gap-2 text-sm font-bold transition-all"
                    style={{ color: "#8B5CF6" }}
                  >
                    Показать разбор <Eye size={14} />
                  </button>
                )}
              </motion.div>

              {completionResult.revealed_facts.length > 0 && (
                <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Search size={14} style={{ color: "#F59E0B" }} />
                    <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>Раскрытые факты</span>
                  </div>
                  {completionResult.revealed_facts.map((fact, i) => (
                    <p key={i} className="text-xs leading-relaxed mb-1" style={{ color: "var(--text-secondary)" }}>{fact}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={restart}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)" }}
                >
                  <RotateCcw size={14} /> Пройти заново
                </button>
                <button
                  onClick={() => router.push("/cases")}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{ background: "#8B5CF6", color: "#fff" }}
                >
                  Все кейсы <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (!currentStep) return null;

  /* ── Active game screen ─────────────────────────────────── */
  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]"
            style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
          />
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

        <div className="relative z-10 max-w-[700px] mx-auto px-5 sm:px-8 py-6 sm:py-10">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push("/cases")}
              className="flex items-center gap-1.5 text-xs font-medium transition-all"
              style={{ color: "var(--text-muted)" }}
            >
              <ArrowLeft size={14} /> Все кейсы
            </button>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <Clock size={12} /> {elapsedMinutes} мин
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase" style={{ background: diff.bg, color: diff.color }}>
                {diff.label}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{caseData.title}</span>
              <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>Шаг {stepIndex + 1} / {totalSteps}</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #8B5CF6, #7C3AED)" }}
                animate={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Score chip */}
          <div className="flex items-center gap-2 mb-6">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#8B5CF6" }}
            >
              <Star size={12} /> {score} очков
            </div>
            {revealedFacts.length > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#F59E0B" }}
              >
                <Search size={12} /> {revealedFacts.length} фактов
              </div>
            )}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id + (showConsequence ? "-consequence" : "")}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: PREMIUM_EASE }}
            >
              <div
                className="rounded-2xl overflow-hidden mb-6"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="h-[2px]" style={{ background: "linear-gradient(90deg, #8B5CF6, #7C3AED, transparent 80%)" }} />
                <div className="p-6">
                  <h2 className="text-lg font-bold mb-3" style={{ color: "var(--text-primary)" }}>{currentStep.title}</h2>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>{currentStep.narrative}</p>
                  {currentStep.context && (
                    <div
                      className="flex items-start gap-2 rounded-xl p-3 mb-4"
                      style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.15)" }}
                    >
                      <Info size={14} className="shrink-0 mt-0.5" style={{ color: "#3B82F6" }} />
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{currentStep.context}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Hidden fact clue */}
              {currentStep.hidden_fact && !factRevealed && !showConsequence && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
                  <button
                    onClick={revealHiddenFact}
                    className="w-full rounded-xl p-4 flex items-start gap-3 text-left transition-all"
                    style={{ background: "rgba(245,158,11,0.06)", border: "1px dashed rgba(245,158,11,0.3)" }}
                  >
                    <Search size={16} className="shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
                    <div>
                      <span className="text-xs font-bold block mb-0.5" style={{ color: "#F59E0B" }}>Скрытый факт</span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{currentStep.hidden_fact.clue}</span>
                    </div>
                    <Eye size={14} className="shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
                  </button>
                </motion.div>
              )}

              {/* Revealed hidden fact */}
              {showHiddenFact && factText && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mb-6 rounded-xl p-4"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb size={14} style={{ color: "#F59E0B" }} />
                    <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>Факт раскрыт! +5 очков</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{factText}</p>
                </motion.div>
              )}

              {/* Consequence display */}
              {showConsequence ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <div
                    className="rounded-2xl p-6 mb-6"
                    style={{
                      background: lastChoiceOptimal ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${lastChoiceOptimal ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {lastChoiceOptimal ? (
                        <CheckCircle2 size={16} style={{ color: "#22C55E" }} />
                      ) : (
                        <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
                      )}
                      <span
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: lastChoiceOptimal ? "#22C55E" : "var(--text-muted)" }}
                      >
                        Последствие
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{lastConsequence}</p>
                  </div>
                  <button
                    onClick={proceedToNext}
                    className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                    style={{ background: "#8B5CF6", color: "#fff" }}
                  >
                    {completed ? "Смотреть результаты" : "Далее"} <ChevronRight size={16} />
                  </button>
                </motion.div>
              ) : (
                /* Choices */
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Выберите действие</h3>
                  {currentStep.choices.map((choice, i) => (
                    <motion.button
                      key={choice.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.08 }}
                      onClick={() => handleChoice(choice.id)}
                      className="w-full text-left rounded-xl p-4 flex items-start gap-3 group transition-all"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(139,92,246,0.3)";
                        e.currentTarget.style.boxShadow = "0 4px 20px rgba(139,92,246,0.1)";
                        e.currentTarget.style.transform = "translateX(4px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "translateX(0)";
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{ background: "rgba(139,92,246,0.1)", color: "#8B5CF6" }}
                      >
                        {String.fromCharCode(65 + i)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block" style={{ color: "var(--text-primary)" }}>{choice.text}</span>
                      </div>
                      <ChevronRight
                        size={14}
                        className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "#8B5CF6" }}
                      />
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AuthLayout>
  );
}
