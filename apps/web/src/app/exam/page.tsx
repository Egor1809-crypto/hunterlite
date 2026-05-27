"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Shield,
  Clock,
  Award,
  CheckCircle,
  Lock,
  ArrowRight,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  QrCode,
  Linkedin,
  Loader2,
  X,
  BookOpen,
  FileText,
  Phone,
  Zap,
  Star,
  Trophy,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";

/* ═══════════════════════════════════════════════════════════════════════════
   EXAM SYSTEM — 4 module exams + 1 final certification exam
   Unlocked by completing test map levels (checkpoints at 30/60/90/100)
   ═══════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "hunterlite_test_map_progress";
const EXAM_STORAGE_KEY = "hunterlite_exam_progress";
const PASS_THRESHOLD = 88;

interface ExamDef {
  id: string;
  number: number;
  title: string;
  description: string;
  requiredLevels: number;
  questionsCount: number;
  timeMinutes: number;
  topics: string[];
  icon: string;
  color: string;
  colorRgb: string;
  format: string[];
  isFinal: boolean;
}

const EXAMS: ExamDef[] = [
  {
    id: "exam-1",
    number: 1,
    title: "Основы банкротства",
    description: "Условия подачи, порядок процедуры, имущество должника. Базовые знания ФЗ-127 для работы с клиентами.",
    requiredLevels: 30,
    questionsCount: 30,
    timeMinutes: 45,
    topics: ["Условия подачи", "Порядок процедуры", "Имущество должника"],
    icon: "📘",
    color: "var(--info)",
    colorRgb: "59,130,246",
    format: ["Тесты", "Мини-кейс"],
    isFinal: false,
  },
  {
    id: "exam-2",
    number: 2,
    title: "Финансы и кредиторы",
    description: "Последствия банкротства, стоимость процедуры, работа с кредиторами. Финансовая сторона дела.",
    requiredLevels: 60,
    questionsCount: 30,
    timeMinutes: 45,
    topics: ["Последствия банкротства", "Стоимость процедуры", "Работа с кредиторами"],
    icon: "💰",
    color: "#F59E0B",
    colorRgb: "245,158,11",
    format: ["Тесты", "Ситуационные задачи"],
    isFinal: false,
  },
  {
    id: "exam-3",
    number: 3,
    title: "Документы и суд",
    description: "Документооборот, процессуальные сроки, судебные процессы. Анализ реальных судебных решений.",
    requiredLevels: 90,
    questionsCount: 35,
    timeMinutes: 50,
    topics: ["Документы", "Сроки", "Судебные процессы"],
    icon: "⚖️",
    color: "#EC4899",
    colorRgb: "236,72,153",
    format: ["Тесты", "Анализ судебного решения"],
    isFinal: false,
  },
  {
    id: "exam-4",
    number: 4,
    title: "Права и защита",
    description: "Права должника и сквозные вопросы по всем темам. Стратегия защиты интересов клиента.",
    requiredLevels: 100,
    questionsCount: 35,
    timeMinutes: 50,
    topics: ["Права должника", "Сквозные вопросы", "Стратегия защиты"],
    icon: "🛡️",
    color: "#6366F1",
    colorRgb: "99,102,241",
    format: ["Тесты", "Стратегия защиты клиента"],
    isFinal: false,
  },
  {
    id: "exam-5",
    number: 5,
    title: "Финальная аттестация",
    description: "Комплексный экзамен по всем темам ФЗ-127. Тесты, кейсы, чеклисты и симуляция звонка с клиентом. Успешная сдача — сертификат.",
    requiredLevels: 100,
    questionsCount: 50,
    timeMinutes: 90,
    topics: ["Все темы ФЗ-127", "Практические кейсы", "Чеклисты", "Симуляция звонка"],
    icon: "🏆",
    color: "#F59E0B",
    colorRgb: "245,158,11",
    format: ["Тесты", "Кейс", "Чеклист", "Звонок"],
    isFinal: true,
  },
];

interface ExamProgress {
  examId: string;
  attempts: number;
  bestScore: number | null;
  passed: boolean;
  certificateId: string | null;
}

function loadExamProgress(): Record<string, ExamProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EXAM_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveExamProgress(progress: Record<string, ExamProgress>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(progress));
  } catch { /* ignore */ }
}

function getCompletedLevels(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const states = JSON.parse(raw);
      return states.filter((s: { status: string }) => s.status === "completed").length;
    }
  } catch { /* ignore */ }
  return 0;
}

/* ── Noise texture ─────────────────────────────────────────── */
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

/* ── CSS keyframes ─────────────────────────────────────────── */
const EXAM_KEYFRAMES = `
@keyframes examShine {
  0% { transform: translateX(-100%) skewX(-15deg); }
  100% { transform: translateX(200%) skewX(-15deg); }
}
@keyframes examPulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.5); }
}
@keyframes examGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.1); }
  50% { box-shadow: 0 0 40px rgba(245,158,11,0.2); }
}
`;

/* ── QR placeholder ────────────────────────────────────────── */
function QrPlaceholder() {
  const grid = [
    [1,1,1,1,1,1,1,0,1,0,1,0,0,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,1,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,1,0,1,1,0,0,1,0,1,0,1,1,0,1,0],
    [0,1,0,0,1,0,0,1,0,0,1,1,0,1,0,1,0,0,1,0,1],
    [1,0,1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,0],
    [0,1,0,1,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,0],
    [0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,0,0],
    [1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,0,0,0,1,0,1,0,0,1,1,0],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,1,1,0,1,1,0,0,1,0,1,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1],
  ];
  return (
    <div className="inline-grid gap-0" style={{ gridTemplateColumns: "repeat(21, 1fr)" }}>
      {grid.flat().map((cell, i) => (
        <div key={i} style={{ width: 4, height: 4, background: cell ? "rgba(245,158,11,0.8)" : "transparent" }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXAM CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function ExamCard({
  exam,
  progress,
  isUnlocked,
  completedLevels,
  allPrevExamsPassed,
  onStart,
}: {
  exam: ExamDef;
  progress?: ExamProgress;
  isUnlocked: boolean;
  completedLevels: number;
  allPrevExamsPassed: boolean;
  onStart: () => void;
}) {
  const isPassed = progress?.passed ?? false;
  const bestScore = progress?.bestScore ?? null;
  const attempts = progress?.attempts ?? 0;
  const maxAttempts = exam.isFinal ? 3 : MAX_ATTEMPTS_MODULE;
  const canRetry = attempts < maxAttempts;

  const isLocked = !isUnlocked || (exam.isFinal && !allPrevExamsPassed);
  const lockReason = exam.isFinal
    ? !allPrevExamsPassed
      ? "Пройдите все 4 экзамена на 88%+ для разблокировки"
      : `Пройдите ${exam.requiredLevels} уровней на карте тестов`
    : `Пройдите ${exam.requiredLevels} уровней на карте тестов (сейчас: ${completedLevels})`;

  const failedAndMustRetrain = !isPassed && attempts > 0 && !exam.isFinal;

  return (
    <motion.div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: exam.isFinal
          ? `linear-gradient(135deg, rgba(${exam.colorRgb},0.06), rgba(${exam.colorRgb},0.02))`
          : "rgba(255,255,255,0.02)",
        border: isPassed
          ? `2px solid rgba(${exam.colorRgb},0.4)`
          : `1px solid ${isLocked ? "rgba(255,255,255,0.05)" : `rgba(${exam.colorRgb},0.15)`}`,
        opacity: isLocked ? 0.5 : 1,
        boxShadow: exam.isFinal && !isLocked ? `0 8px 40px rgba(${exam.colorRgb},0.12)` : "none",
      }}
    >
      {/* Top accent */}
      {!isLocked && (
        <div
          className="h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, rgba(${exam.colorRgb},0.5), transparent)` }}
        />
      )}

      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
            style={{
              background: `rgba(${exam.colorRgb},0.1)`,
              border: `1px solid rgba(${exam.colorRgb},0.2)`,
            }}
          >
            {exam.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{
                  background: `rgba(${exam.colorRgb},0.1)`,
                  color: exam.color,
                }}
              >
                Экзамен {exam.number}
              </span>
              {exam.isFinal && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}
                >
                  Финальный
                </span>
              )}
              {isPassed && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)" }}
                >
                  Сдан
                </span>
              )}
            </div>
            <h3 className="font-bold text-base mt-1.5" style={{ color: "var(--text-primary)" }}>
              {exam.title}
            </h3>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {exam.description}
            </p>
          </div>
          {isPassed && bestScore !== null && (
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold" style={{ color: "var(--success)" }}>
                {Math.round(bestScore)}%
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>лучший</div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { icon: FileText, label: "Вопросов", value: exam.questionsCount },
            { icon: Clock, label: "Время", value: `${exam.timeMinutes} мин` },
            { icon: Star, label: "Порог", value: `${PASS_THRESHOLD}%` },
            { icon: RefreshCw, label: "Попытки", value: `${maxAttempts - attempts}/${maxAttempts}` },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-lg p-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)" }}
              >
                <Icon size={12} className="mx-auto mb-1" style={{ color: exam.color }} />
                <div className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</div>
                <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Topics */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {exam.topics.map(t => (
            <span
              key={t}
              className="text-[10px] px-2 py-1 rounded-md"
              style={{ background: `rgba(${exam.colorRgb},0.06)`, color: exam.color, border: `1px solid rgba(${exam.colorRgb},0.12)` }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Format tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {exam.format.map(f => (
            <span
              key={f}
              className="text-[10px] px-2 py-0.5 rounded-md font-medium"
              style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* Failed retrain notice */}
        {failedAndMustRetrain && (
          <div
            className="rounded-xl p-3 mb-4 flex items-start gap-3"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
            <div>
              <div className="text-xs font-semibold" style={{ color: "var(--danger)" }}>Экзамен не сдан</div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Перепройдите модуль тестов на карте (уровни {exam.requiredLevels - 29}-{exam.requiredLevels}) и попробуйте снова.
              </p>
            </div>
          </div>
        )}

        {/* Action */}
        {isLocked ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <Lock size={12} />
            {lockReason}
          </div>
        ) : !canRetry && !isPassed ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--danger)" }}>
            <AlertTriangle size={12} />
            {exam.isFinal ? "Попытки исчерпаны. Приобретите дополнительные попытки." : "Попытки исчерпаны"}
          </div>
        ) : (
          <motion.button
            onClick={onStart}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: exam.isFinal
                ? `linear-gradient(135deg, rgba(${exam.colorRgb},0.2), rgba(${exam.colorRgb},0.1))`
                : `rgba(${exam.colorRgb},0.1)`,
              border: `1.5px solid rgba(${exam.colorRgb},0.3)`,
              color: exam.color,
              boxShadow: exam.isFinal ? `0 4px 20px rgba(${exam.colorRgb},0.15)` : "none",
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <GraduationCap size={16} />
            {isPassed ? "Пересдать" : "Начать экзамен"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

const MAX_ATTEMPTS_MODULE = 5;

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ExamPage() {
  const router = useRouter();
  const [completedLevels, setCompletedLevels] = useState(0);
  const [examProgress, setExamProgress] = useState<Record<string, ExamProgress>>({});

  useEffect(() => {
    setCompletedLevels(getCompletedLevels());
    setExamProgress(loadExamProgress());
  }, []);

  const passedExams = useMemo(
    () => EXAMS.filter(e => !e.isFinal && examProgress[e.id]?.passed).length,
    [examProgress],
  );
  const allModulesPassed = passedExams === 4;
  const finalPassed = examProgress["exam-5"]?.passed ?? false;
  const overallProgress = finalPassed ? 100 : Math.round((passedExams / 5) * 100);

  return (
    <AuthLayout>
      <style dangerouslySetInnerHTML={{ __html: EXAM_KEYFRAMES }} />

      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        {/* Noise */}
        <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden style={{ backgroundImage: NOISE_SVG, backgroundRepeat: "repeat", opacity: 1 }} />

        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-32 right-[15%] rounded-full opacity-[0.03]" style={{ width: 850, height: 850, background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }} />
          <div className="absolute top-[70%] -left-20 rounded-full opacity-[0.025]" style={{ width: 650, height: 650, background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }} />
        </div>

        <div className="relative z-10 max-w-[900px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(245,158,11,0.12)", boxShadow: "0 0 0 1px rgba(245,158,11,0.2)" }}
              >
                <GraduationCap size={22} style={{ color: "#F59E0B" }} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Экзамен
                </h1>
                <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                  4 модуля + финальная аттестация → сертификат
                </p>
              </div>
            </div>
          </motion.div>

          {/* Progress banner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-6 rounded-2xl overflow-hidden relative"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(99,102,241,0.06))",
              border: "1px solid rgba(245,158,11,0.15)",
              boxShadow: "0 0 40px rgba(245,158,11,0.08)",
            }}
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: "inherit", zIndex: 1 }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)", animation: "examShine 4s ease-in-out infinite" }} />
            </div>

            <div className="p-6 sm:p-8 relative z-[2]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={18} style={{ color: "#F59E0B" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#F59E0B" }}>
                      Путь к сертификату
                    </span>
                  </div>

                  {/* Checkpoint chain */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {EXAMS.filter(e => !e.isFinal).map((exam, i) => {
                      const passed = examProgress[exam.id]?.passed;
                      return (
                        <div key={exam.id} className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                            style={{
                              background: passed ? `rgba(${exam.colorRgb},0.15)` : "rgba(255,255,255,0.05)",
                              border: `1.5px solid ${passed ? `rgba(${exam.colorRgb},0.4)` : "rgba(255,255,255,0.08)"}`,
                              color: passed ? exam.color : "var(--text-muted)",
                            }}
                          >
                            {passed ? <CheckCircle size={14} /> : i + 1}
                          </div>
                          {i < 3 && (
                            <div
                              className="w-6 h-0.5 rounded-full"
                              style={{ background: passed ? `rgba(${exam.colorRgb},0.4)` : "rgba(255,255,255,0.08)" }}
                            />
                          )}
                        </div>
                      );
                    })}
                    <div className="w-6 h-0.5 rounded-full" style={{ background: allModulesPassed ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)" }} />
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{
                        background: finalPassed ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
                        border: `2px solid ${finalPassed ? "rgba(245,158,11,0.5)" : allModulesPassed ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`,
                        boxShadow: finalPassed ? "0 0 16px rgba(245,158,11,0.2)" : "none",
                      }}
                    >
                      {finalPassed ? "🏆" : "🔒"}
                    </div>
                  </div>

                  <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                    {finalPassed
                      ? "Поздравляем! Сертификат получен."
                      : allModulesPassed
                        ? "Все 4 модуля сданы! Финальный экзамен открыт."
                        : `Сдано ${passedExams} из 4 модулей. Каждый экзамен требует минимум ${PASS_THRESHOLD}%.`}
                  </p>
                </div>

                {/* Progress circle */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90" style={{ filter: "drop-shadow(0 0 8px rgba(245,158,11,0.3))" }}>
                      <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-color)" strokeWidth="6" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(overallProgress / 100) * 213.6} 213.6`} style={{ transition: "stroke-dasharray 0.5s ease" }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{overallProgress}%</span>
                    </div>
                  </div>
                  <span className="mt-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Прогресс</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Map progress info */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-4 rounded-xl p-4 flex items-center justify-between"
            style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}
          >
            <div className="flex items-center gap-2">
              <BookOpen size={14} style={{ color: "var(--info)" }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Пройдено уровней на карте тестов
              </span>
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--info)" }}>
              {completedLevels}/100
            </span>
          </motion.div>

          {/* Exam cards */}
          <div className="mt-8 space-y-4">
            {EXAMS.map((exam, i) => {
              const isUnlocked = completedLevels >= exam.requiredLevels;
              return (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16 + i * 0.06 }}
                >
                  <ExamCard
                    exam={exam}
                    progress={examProgress[exam.id]}
                    isUnlocked={isUnlocked}
                    completedLevels={completedLevels}
                    allPrevExamsPassed={allModulesPassed}
                    onStart={() => {
                      router.push(`/exam/${exam.id}`);
                    }}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Certificate preview */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-10 rounded-2xl overflow-hidden relative"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "2px solid transparent",
              borderImage: "linear-gradient(135deg, #F59E0B 0%, #D97706 40%, #B45309 70%, #F59E0B 100%) 1",
              boxShadow: "0 0 40px rgba(245,158,11,0.08)",
              animation: finalPassed ? "examGlow 3s ease-in-out infinite" : "none",
            }}
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: "inherit", zIndex: 1 }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)", animation: "examShine 5s ease-in-out 1s infinite" }} />
            </div>
            <div className="p-6 sm:p-8 relative z-[2]" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.04), rgba(217,119,6,0.02))" }}>
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={20} style={{ color: "#F59E0B" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#F59E0B" }}>
                      {finalPassed ? "Ваш сертификат" : "Образец"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
                    Сертификат Hunter888
                  </h3>
                  <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                    Специалист по банкротству физических лиц (ФЗ-127)
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <QrCode size={12} style={{ color: "#F59E0B" }} />
                      Верификация по QR-коду
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Linkedin size={12} style={{ color: "#2563EB" }} />
                      Добавьте в LinkedIn-профиль
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-center">
                  <div className="p-3 rounded-xl" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <QrPlaceholder />
                  </div>
                  <span className="mt-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    QR-верификация
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Rules */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-start gap-3">
              <Shield size={16} className="shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Правила экзаменации
                </div>
                <ul className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
                  <li>Экзамены 1-4 открываются после прохождения соответствующих уровней на карте тестов</li>
                  <li>Минимальный порог сдачи — {PASS_THRESHOLD}% на каждом экзамене</li>
                  <li>При провале экзамена — перепройдите модуль тестов, затем пересдайте</li>
                  <li>Финальный экзамен (5) открывается после сдачи всех 4 модулей на {PASS_THRESHOLD}%+</li>
                  <li>Финальный экзамен: 3 бесплатные попытки, далее — платная разблокировка</li>
                  <li>Финальный экзамен включает: тесты + кейс + чеклист + симуляцию звонка</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
