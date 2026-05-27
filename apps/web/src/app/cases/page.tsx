"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  ArrowRight,
  Clock,
  Users,
  Scale,
  AlertTriangle,
  ChevronRight,
  FileText,
  TrendingUp,
  Shield,
  Zap,
  Lock,
  Star,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";

/* ── Case difficulty config ──────────────────────────────── */
function getDiffConfig(level: 1 | 2 | 3) {
  switch (level) {
    case 1:
      return { label: "Базовый", color: "var(--success)", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)" };
    case 2:
      return { label: "Продвинутый", color: "var(--warning)", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" };
    case 3:
      return { label: "Экспертный", color: "var(--danger)", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" };
  }
}

/* ── Case data (will be API-driven later) ────────────────── */
interface CaseItem {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3;
  category: string;
  estimatedMinutes: number;
  branchCount: number;
  tags: string[];
  locked: boolean;
  completedByUser: boolean;
}

const SAMPLE_CASES: CaseItem[] = [
  {
    id: "case-1",
    title: "Должник скрывает имущество",
    description: "Клиент утверждает, что у него нет активов, но косвенные признаки говорят об обратном. Ваша задача - выстроить стратегию раскрытия и убедить клиента сотрудничать.",
    difficulty: 1,
    category: "Выявление активов",
    estimatedMinutes: 15,
    branchCount: 4,
    tags: ["ФЗ-127", "Активы", "Переговоры"],
    locked: false,
    completedByUser: false,
  },
  {
    id: "case-2",
    title: "Конфликт кредиторов на собрании",
    description: "Два крупных кредитора предъявляют взаимоисключающие требования. Необходимо найти компромисс и провести собрание в рамках закона.",
    difficulty: 2,
    category: "Собрание кредиторов",
    estimatedMinutes: 25,
    branchCount: 6,
    tags: ["Собрание", "Конфликт", "Медиация"],
    locked: false,
    completedByUser: false,
  },
  {
    id: "case-3",
    title: "Оспаривание сделки должника",
    description: "Обнаружена подозрительная сделка за 6 месяцев до банкротства. Нужно оценить перспективы оспаривания и подготовить правовую позицию.",
    difficulty: 2,
    category: "Оспаривание сделок",
    estimatedMinutes: 20,
    branchCount: 5,
    tags: ["Ст.61.2", "Сделки", "Анализ"],
    locked: false,
    completedByUser: false,
  },
  {
    id: "case-4",
    title: "Субсидиарная ответственность КДЛ",
    description: "Директор компании-банкрота подал на личное банкротство. Кредиторы требуют привлечь его к субсидиарной ответственности.",
    difficulty: 3,
    category: "Субсидиарная ответственность",
    estimatedMinutes: 35,
    branchCount: 8,
    tags: ["Ст.61.11", "КДЛ", "Стратегия"],
    locked: true,
    completedByUser: false,
  },
  {
    id: "case-5",
    title: "Торги с нарушениями",
    description: "Участник торгов жалуется на нарушения процедуры. Арбитражный управляющий должен разобраться в ситуации и принять решение.",
    difficulty: 3,
    category: "Торги",
    estimatedMinutes: 30,
    branchCount: 7,
    tags: ["Торги", "Жалобы", "Процедура"],
    locked: true,
    completedByUser: false,
  },
];

const CATEGORIES = ["Все", "Выявление активов", "Собрание кредиторов", "Оспаривание сделок", "Субсидиарная ответственность", "Торги"];

/* ── Page Component ──────────────────────────────────────── */
export default function CasesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [hoveredCase, setHoveredCase] = useState<string | null>(null);

  const filteredCases = selectedCategory === "Все"
    ? SAMPLE_CASES
    : SAMPLE_CASES.filter((c) => c.category === selectedCategory);

  const completedCount = SAMPLE_CASES.filter((c) => c.completedByUser).length;
  const totalCount = SAMPLE_CASES.length;
  const unlockedCount = SAMPLE_CASES.filter((c) => !c.locked).length;

  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-40 left-[20%] w-[600px] h-[600px] rounded-full opacity-[0.035]"
            style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-[60%] -right-32 w-[400px] h-[400px] rounded-full opacity-[0.025]"
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
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(139, 92, 246, 0.12)",
                    boxShadow: "0 0 0 1px rgba(139, 92, 246, 0.2)",
                  }}
                >
                  <Briefcase size={22} style={{ color: "#8B5CF6" }} />
                </div>
                <div>
                  <h1
                    className="text-2xl sm:text-3xl font-bold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Кейсы
                  </h1>
                  <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                    Интерактивные сценарии с ветвлением решений
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-6 grid grid-cols-3 gap-3"
          >
            {[
              { label: "Доступно", value: unlockedCount, icon: Briefcase, color: "#8B5CF6" },
              { label: "Пройдено", value: `${completedCount}/${totalCount}`, icon: Star, color: "var(--success)" },
              { label: "Всего кейсов", value: totalCount, icon: FileText, color: "var(--info)" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: "var(--surface-card)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <Icon size={16} className="mx-auto mb-1.5" style={{ color: stat.color }} />
                  <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {stat.value}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Category filter */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-6 flex gap-2 overflow-x-auto pb-1"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
                style={{
                  background: selectedCategory === cat ? "rgba(139, 92, 246, 0.12)" : "var(--surface-card)",
                  border: `1px solid ${selectedCategory === cat ? "rgba(139, 92, 246, 0.4)" : "var(--border-color)"}`,
                  color: selectedCategory === cat ? "#8B5CF6" : "var(--text-muted)",
                }}
              >
                {cat}
              </button>
            ))}
          </motion.div>

          {/* Cases grid */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {filteredCases.map((caseItem, i) => {
              const diff = getDiffConfig(caseItem.difficulty);
              const isHovered = hoveredCase === caseItem.id;

              return (
                <motion.div
                  key={caseItem.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.14 + i * 0.06 }}
                  className="group relative rounded-2xl overflow-hidden transition-all duration-300"
                  style={{
                    background: "var(--surface-card)",
                    border: `1px solid ${isHovered && !caseItem.locked ? "rgba(139, 92, 246, 0.3)" : "var(--border-color)"}`,
                    cursor: caseItem.locked ? "default" : "pointer",
                    opacity: caseItem.locked ? 0.6 : 1,
                  }}
                  onMouseEnter={() => setHoveredCase(caseItem.id)}
                  onMouseLeave={() => setHoveredCase(null)}
                  onClick={() => {
                    if (!caseItem.locked) {
                      // Will route to case player when implemented
                      // router.push(`/cases/${caseItem.id}`);
                    }
                  }}
                >
                  {/* Top accent line */}
                  <div
                    className="h-[2px]"
                    style={{ background: `linear-gradient(90deg, ${diff.color}, transparent 80%)` }}
                  />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                          style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}
                        >
                          {diff.label}
                        </span>
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                          style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                        >
                          {caseItem.category}
                        </span>
                      </div>
                      {caseItem.locked && (
                        <Lock size={14} style={{ color: "var(--text-muted)" }} />
                      )}
                    </div>

                    {/* Title & description */}
                    <h3
                      className="text-base font-bold tracking-tight leading-snug mb-2"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {caseItem.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed line-clamp-2 mb-4"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {caseItem.description}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        ~{caseItem.estimatedMinutes} мин
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        {caseItem.branchCount} развилок
                      </span>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {caseItem.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] px-2 py-0.5 rounded-md"
                          style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Action */}
                    {caseItem.locked ? (
                      <div
                        className="flex items-center gap-2 text-xs font-medium py-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Lock size={12} />
                        Пройдите предыдущие кейсы для разблокировки
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ color: "#8B5CF6" }}
                      >
                        Начать кейс
                        <ArrowRight size={14} />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Coming soon note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Новые кейсы добавляются еженедельно на основе реальной арбитражной практики
            </p>
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
