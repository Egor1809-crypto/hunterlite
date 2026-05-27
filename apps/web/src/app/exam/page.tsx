"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Shield,
  Clock,
  Award,
  CheckCircle,
  Lock,
  ArrowRight,
  FileCheck,
  AlertTriangle,
  Star,
  BookOpen,
  Eye,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";

/* ── Exam type definitions ───────────────────────────────── */
interface ExamModule {
  id: string;
  title: string;
  description: string;
  questionsCount: number;
  timeMinutes: number;
  passingScore: number;
  topics: string[];
  locked: boolean;
  completed: boolean;
  score: number | null;
  certificateId: string | null;
}

const EXAM_MODULES: ExamModule[] = [
  {
    id: "module-1",
    title: "Основы ФЗ-127",
    description: "Базовые положения закона о несостоятельности (банкротстве). Процедуры наблюдения, финансового оздоровления, внешнего управления.",
    questionsCount: 30,
    timeMinutes: 45,
    passingScore: 70,
    topics: ["Процедуры банкротства", "Наблюдение", "Финансовое оздоровление", "Внешнее управление"],
    locked: false,
    completed: false,
    score: null,
    certificateId: null,
  },
  {
    id: "module-2",
    title: "Конкурсное производство",
    description: "Порядок проведения конкурсного производства, формирование конкурсной массы, очерёдность удовлетворения требований кредиторов.",
    questionsCount: 35,
    timeMinutes: 50,
    passingScore: 75,
    topics: ["Конкурсная масса", "Очерёдность", "Торги", "Отчётность"],
    locked: false,
    completed: false,
    score: null,
    certificateId: null,
  },
  {
    id: "module-3",
    title: "Оспаривание сделок",
    description: "Основания и порядок оспаривания сделок должника. Подозрительные сделки, сделки с предпочтением, практика ВС РФ.",
    questionsCount: 25,
    timeMinutes: 40,
    passingScore: 75,
    topics: ["Ст.61.2 ФЗ-127", "Ст.61.3 ФЗ-127", "Практика ВС", "Доказывание"],
    locked: true,
    completed: false,
    score: null,
    certificateId: null,
  },
  {
    id: "module-4",
    title: "Субсидиарная ответственность",
    description: "Привлечение контролирующих должника лиц к субсидиарной ответственности. Критерии КДЛ, основания, процессуальные особенности.",
    questionsCount: 30,
    timeMinutes: 50,
    passingScore: 80,
    topics: ["КДЛ", "Ст.61.10-61.12", "Доказывание", "Судебная практика"],
    locked: true,
    completed: false,
    score: null,
    certificateId: null,
  },
  {
    id: "module-5",
    title: "Комплексный экзамен",
    description: "Итоговая аттестация по всем модулям. Успешная сдача подтверждает квалификацию и даёт право на получение сертификата.",
    questionsCount: 50,
    timeMinutes: 90,
    passingScore: 80,
    topics: ["Все разделы ФЗ-127", "Практические кейсы", "Ситуационные задачи"],
    locked: true,
    completed: false,
    score: null,
    certificateId: null,
  },
];

/* ── Page Component ──────────────────────────────────────── */
export default function ExamPage() {
  const router = useRouter();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const completedModules = EXAM_MODULES.filter((m) => m.completed).length;
  const totalModules = EXAM_MODULES.length;
  const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-32 right-[15%] w-[500px] h-[500px] rounded-full opacity-[0.03]"
            style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-[70%] -left-20 w-[350px] h-[350px] rounded-full opacity-[0.025]"
            style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  boxShadow: "0 0 0 1px rgba(245, 158, 11, 0.2)",
                }}
              >
                <GraduationCap size={22} style={{ color: "#F59E0B" }} />
              </div>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  Экзамен
                </h1>
                <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                  Аттестация с выдачей сертификата
                </p>
              </div>
            </div>
          </motion.div>

          {/* Certificate banner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-6 rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(37,99,235,0.06) 100%)",
              border: "1px solid rgba(245,158,11,0.15)",
            }}
          >
            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={18} style={{ color: "#F59E0B" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#F59E0B" }}>
                      Сертификация
                    </span>
                  </div>
                  <h2
                    className="text-lg sm:text-xl font-bold tracking-tight mb-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Подтвердите квалификацию
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Пройдите модули и получите сертификат, подтверждающий вашу компетенцию
                    в арбитражном управлении. Результаты засчитываются в счёт 24 ак. часов
                    обязательного повышения квалификации.
                  </p>
                </div>

                {/* Progress circle */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                      <circle
                        cx="40" cy="40" r="34"
                        fill="none"
                        stroke="var(--border-color)"
                        strokeWidth="6"
                      />
                      <circle
                        cx="40" cy="40" r="34"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${(progressPct / 100) * 213.6} 213.6`}
                        style={{ transition: "stroke-dasharray 0.5s ease" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                        {progressPct}%
                      </span>
                    </div>
                  </div>
                  <span className="mt-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Прогресс
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Exam info cards */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {[
              { icon: FileCheck, label: "Модулей", value: totalModules, color: "#F59E0B" },
              { icon: CheckCircle, label: "Пройдено", value: completedModules, color: "var(--success)" },
              { icon: Eye, label: "Прокторинг", value: "AI", color: "#2563EB" },
              { icon: Award, label: "Сертификат", value: "24 ч.", color: "#8B5CF6" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: "var(--surface-card)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <Icon size={16} className="mx-auto mb-1.5" style={{ color: item.color }} />
                  <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                    {item.value}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {item.label}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Exam modules list */}
          <div className="mt-8 space-y-3">
            {EXAM_MODULES.map((module, i) => {
              const isExpanded = expandedModule === module.id;
              const isComposite = module.id === "module-5";

              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.16 + i * 0.05 }}
                  className="rounded-2xl overflow-hidden transition-all duration-200"
                  style={{
                    background: "var(--surface-card)",
                    border: `1px solid ${isExpanded ? "rgba(245,158,11,0.3)" : "var(--border-color)"}`,
                    opacity: module.locked ? 0.55 : 1,
                  }}
                >
                  {/* Module header */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-4 p-5 text-left transition-colors"
                    onClick={() => setExpandedModule(isExpanded ? null : module.id)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      if (!module.locked) e.currentTarget.style.background = "var(--surface-card-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Module number */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                      style={{
                        background: module.completed
                          ? "rgba(34,197,94,0.12)"
                          : module.locked
                            ? "var(--bg-tertiary)"
                            : isComposite
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(37,99,235,0.1)",
                        color: module.completed
                          ? "var(--success)"
                          : module.locked
                            ? "var(--text-muted)"
                            : isComposite
                              ? "#F59E0B"
                              : "#2563EB",
                      }}
                    >
                      {module.completed ? (
                        <CheckCircle size={18} />
                      ) : module.locked ? (
                        <Lock size={16} />
                      ) : (
                        i + 1
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>
                          {module.title}
                        </h3>
                        {isComposite && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                            style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}
                          >
                            Итоговый
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        <span>{module.questionsCount} вопросов</span>
                        <span className="flex items-center gap-1"><Clock size={10} />{module.timeMinutes} мин</span>
                        <span>Порог: {module.passingScore}%</span>
                      </div>
                    </div>

                    {module.score !== null && (
                      <div
                        className="text-lg font-bold shrink-0"
                        style={{ color: module.score >= module.passingScore ? "var(--success)" : "var(--danger)" }}
                      >
                        {module.score}%
                      </div>
                    )}

                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.15 }}
                      className="shrink-0"
                    >
                      <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                    </motion.div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-5 pb-5 pt-0"
                        style={{ borderTop: "1px solid var(--border-color)" }}
                      >
                        <p className="text-sm leading-relaxed mt-4 mb-4" style={{ color: "var(--text-secondary)" }}>
                          {module.description}
                        </p>

                        {/* Topics */}
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {module.topics.map((topic) => (
                            <span
                              key={topic}
                              className="text-[11px] px-2.5 py-1 rounded-lg"
                              style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                            >
                              {topic}
                            </span>
                          ))}
                        </div>

                        {/* Proctoring notice */}
                        <div
                          className="flex items-start gap-3 p-3 rounded-xl mb-4"
                          style={{
                            background: "rgba(37,99,235,0.06)",
                            border: "1px solid rgba(37,99,235,0.12)",
                          }}
                        >
                          <Shield size={16} className="shrink-0 mt-0.5" style={{ color: "#2563EB" }} />
                          <div>
                            <div className="text-xs font-semibold" style={{ color: "#2563EB" }}>
                              AI-прокторинг
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                              Экзамен проходит под контролем AI-наблюдателя. Запрещено
                              переключение вкладок, копирование вопросов, использование
                              внешних источников.
                            </p>
                          </div>
                        </div>

                        {/* Action button */}
                        {module.locked ? (
                          <div
                            className="flex items-center gap-2 text-xs font-medium py-2"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Lock size={12} />
                            Пройдите предыдущие модули для разблокировки
                          </div>
                        ) : (
                          <button
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
                            style={{
                              background: isComposite
                                ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                                : "#2563EB",
                              color: isComposite ? "#000" : "#fff",
                              boxShadow: isComposite
                                ? "0 4px 16px rgba(245,158,11,0.3)"
                                : "0 4px 16px rgba(37,99,235,0.25)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                            }}
                          >
                            {module.completed ? "Пересдать" : "Начать экзамен"}
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Bottom info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 rounded-xl p-4"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Правила аттестации
                </div>
                <ul className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
                  <li>Каждый модуль можно пересдавать не чаще 1 раза в 24 часа</li>
                  <li>Комплексный экзамен доступен после прохождения всех модулей</li>
                  <li>Сертификат выдаётся в электронном формате с QR-верификацией</li>
                  <li>Срок действия сертификата - 1 год с момента выдачи</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
