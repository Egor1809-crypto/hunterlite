"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Shield,
  Clock,
  Award,
  CheckCircle,
  Lock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  BookOpen,
  FileText,
  Star,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

const EXAM_KEYFRAMES = `
@keyframes examShine {
  0% { transform: translateX(-100%) skewX(-15deg); }
  100% { transform: translateX(200%) skewX(-15deg); }
}
@keyframes examGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.1); }
  50% { box-shadow: 0 0 40px rgba(245,158,11,0.2); }
}
`;

const PASS_THRESHOLD = 88;

const EXAM_COLORS: Record<string, { color: string; rgb: string; icon: string }> = {
  "exam-1": { color: "var(--info)", rgb: "59,130,246", icon: "\u{1F4D8}" },
  "exam-2": { color: "#F59E0B", rgb: "245,158,11", icon: "\u{1F4B0}" },
  "exam-3": { color: "#EC4899", rgb: "236,72,153", icon: "⚖️" },
  "exam-4": { color: "#6366F1", rgb: "99,102,241", icon: "\u{1F6E1}️" },
  "exam-5": { color: "#F59E0B", rgb: "245,158,11", icon: "\u{1F3C6}" },
};

interface ExamItem {
  id: string;
  title: string;
  description: string;
  categories: string[];
  question_count: number;
  time_limit_minutes: number;
  pass_threshold: number;
  order_index: number;
  unlock_condition: Record<string, unknown>;
  best_score: number | null;
  attempts_count: number;
  passed: boolean;
  is_locked: boolean;
  certificate_code: string | null;
}

function ExamCard({
  exam,
  onStart,
}: {
  exam: ExamItem;
  onStart: () => void;
}) {
  const style = EXAM_COLORS[exam.id] ?? { color: "#8B5CF6", rgb: "139,92,246", icon: "\u{1F4DA}" };
  const isFinal = exam.id === "exam-5";

  return (
    <motion.div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: isFinal
          ? `linear-gradient(135deg, rgba(${style.rgb},0.06), rgba(${style.rgb},0.02))`
          : "rgba(255,255,255,0.02)",
        border: exam.passed
          ? `2px solid rgba(${style.rgb},0.4)`
          : `1px solid ${exam.is_locked ? "rgba(255,255,255,0.05)" : `rgba(${style.rgb},0.15)`}`,
        opacity: exam.is_locked ? 0.5 : 1,
        boxShadow: isFinal && !exam.is_locked ? `0 8px 40px rgba(${style.rgb},0.12)` : "none",
      }}
    >
      {!exam.is_locked && (
        <div
          className="h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, rgba(${style.rgb},0.5), transparent)` }}
        />
      )}

      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
            style={{
              background: `rgba(${style.rgb},0.1)`,
              border: `1px solid rgba(${style.rgb},0.2)`,
            }}
          >
            {style.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: `rgba(${style.rgb},0.1)`, color: style.color }}
              >
                Экзамен {exam.order_index}
              </span>
              {isFinal && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}
                >
                  Финальный
                </span>
              )}
              {exam.passed && (
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
          {exam.passed && exam.best_score !== null && (
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold" style={{ color: "var(--success)" }}>
                {exam.best_score}%
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>лучший</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { icon: FileText, label: "Вопросов", value: String(exam.question_count) },
            { icon: Clock, label: "Время", value: `${exam.time_limit_minutes} мин` },
            { icon: Star, label: "Порог", value: `${exam.pass_threshold}%` },
            { icon: RefreshCw, label: "Попытки", value: String(exam.attempts_count) },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-lg p-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)" }}
              >
                <Icon size={12} className="mx-auto mb-1" style={{ color: style.color }} />
                <div className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</div>
                <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {exam.categories.map(t => (
            <span
              key={t}
              className="text-[10px] px-2 py-1 rounded-md"
              style={{ background: `rgba(${style.rgb},0.06)`, color: style.color, border: `1px solid rgba(${style.rgb},0.12)` }}
            >
              {t}
            </span>
          ))}
        </div>

        {exam.is_locked ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <Lock size={12} />
            Сдайте предыдущий экзамен для разблокировки
          </div>
        ) : (
          <motion.button
            onClick={onStart}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: isFinal
                ? `linear-gradient(135deg, rgba(${style.rgb},0.2), rgba(${style.rgb},0.1))`
                : `rgba(${style.rgb},0.1)`,
              border: `1.5px solid rgba(${style.rgb},0.3)`,
              color: style.color,
              boxShadow: isFinal ? `0 4px 20px rgba(${style.rgb},0.15)` : "none",
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <GraduationCap size={16} />
            {exam.passed ? "Пересдать" : "Начать экзамен"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function ExamPage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ExamItem[]>("/exams/")
      .then(data => {
        setExams(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || "Ошибка загрузки");
        setLoading(false);
      });
  }, []);

  const passedModules = useMemo(
    () => exams.filter(e => e.id !== "exam-5" && e.passed).length,
    [exams],
  );
  const finalPassed = exams.find(e => e.id === "exam-5")?.passed ?? false;
  const overallProgress = finalPassed ? 100 : Math.round((passedModules / 5) * 100);

  if (loading) {
    return (
      <AuthLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "#F59E0B" }} />
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <div className="text-center">
            <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: "var(--danger)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{error}</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <style dangerouslySetInnerHTML={{ __html: EXAM_KEYFRAMES }} />

      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden style={{ backgroundImage: NOISE_SVG, backgroundRepeat: "repeat", opacity: 1 }} />
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-32 right-[15%] rounded-full opacity-[0.03]" style={{ width: 850, height: 850, background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }} />
          <div className="absolute top-[70%] -left-20 rounded-full opacity-[0.025]" style={{ width: 650, height: 650, background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }} />
        </div>

        <div className="relative z-10 max-w-[900px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
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
                  4 модуля + финальная аттестация
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

                  <div className="flex items-center gap-2 flex-wrap">
                    {exams.filter(e => e.id !== "exam-5").map((exam, i) => {
                      const st = EXAM_COLORS[exam.id] ?? { color: "#8B5CF6", rgb: "139,92,246", icon: "" };
                      return (
                        <div key={exam.id} className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                            style={{
                              background: exam.passed ? `rgba(${st.rgb},0.15)` : "rgba(255,255,255,0.05)",
                              border: `1.5px solid ${exam.passed ? `rgba(${st.rgb},0.4)` : "rgba(255,255,255,0.08)"}`,
                              color: exam.passed ? st.color : "var(--text-muted)",
                            }}
                          >
                            {exam.passed ? <CheckCircle size={14} /> : i + 1}
                          </div>
                          {i < 3 && (
                            <div
                              className="w-6 h-0.5 rounded-full"
                              style={{ background: exam.passed ? `rgba(${st.rgb},0.4)` : "rgba(255,255,255,0.08)" }}
                            />
                          )}
                        </div>
                      );
                    })}
                    <div className="w-6 h-0.5 rounded-full" style={{ background: passedModules === 4 ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)" }} />
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{
                        background: finalPassed ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
                        border: `2px solid ${finalPassed ? "rgba(245,158,11,0.5)" : passedModules === 4 ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`,
                        boxShadow: finalPassed ? "0 0 16px rgba(245,158,11,0.2)" : "none",
                      }}
                    >
                      {finalPassed ? "\u{1F3C6}" : "\u{1F512}"}
                    </div>
                  </div>

                  <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                    {finalPassed
                      ? "Поздравляем! Сертификат получен."
                      : passedModules === 4
                        ? "Все 4 модуля сданы! Финальный экзамен открыт."
                        : `Сдано ${passedModules} из 4 модулей. Каждый экзамен требует минимум ${PASS_THRESHOLD}%.`}
                  </p>
                </div>

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

          {/* Exam cards */}
          <div className="mt-8 space-y-4">
            {exams.map((exam, i) => (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 + i * 0.06 }}
              >
                <ExamCard
                  exam={exam}
                  onStart={() => router.push(`/exam/${exam.id}`)}
                />
              </motion.div>
            ))}
          </div>

          {/* Certificates section */}
          {exams.some(e => e.certificate_code) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-10"
            >
              <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                Ваши сертификаты
              </h2>
              <div className="space-y-3">
                {exams.filter(e => e.certificate_code).map(exam => (
                  <div
                    key={exam.id}
                    className="rounded-xl p-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
                    style={{
                      background: "rgba(245,158,11,0.04)",
                      border: "1px solid rgba(245,158,11,0.15)",
                    }}
                    onClick={() => router.push(`/exam/certificate/${exam.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Award size={20} style={{ color: "#F59E0B" }} />
                      <div>
                        <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {exam.title}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {exam.best_score}% — код: {exam.certificate_code}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>Открыть</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

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
                  <li>Экзамен 1 доступен сразу, далее последовательно после сдачи предыдущего</li>
                  <li>Минимальный порог сдачи — {PASS_THRESHOLD}% на каждом экзамене</li>
                  <li>Вопросы выбираются случайно из банка 200+ вопросов</li>
                  <li>Финальный экзамен (5) открывается после сдачи всех 4 модулей</li>
                  <li>При успешной сдаче выдаётся сертификат с уникальным кодом верификации</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
