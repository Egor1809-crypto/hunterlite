"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  ArrowRight,
  Clock,
  Star,
  FileText,
  Search,
  Award,
  GraduationCap,
  Lock,
  TrendingUp,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";

/* ── Types ──────────────────────────────────────────────── */
interface CaseListItem {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3;
  category: string;
  estimated_minutes: number;
  max_score: number;
  order_index: number;
  completed: boolean;
  best_score: number | null;
  attempts: number;
}

interface CaseListResponse {
  cases: CaseListItem[];
  stats: {
    total: number;
    completed: number;
    average_score: number | null;
    total_attempts: number;
  };
}

/* ── Difficulty config ──────────────────────────────────── */
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

/* ── Butterfly SVG icon ─────────────────────────────────── */
function ButterflyIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 21c0 0-8-4.5-8-11.8C4 5.5 7.6 2 12 2c4.4 0 8 3.5 8 7.2C20 16.5 12 21 12 21z" />
      <path d="M12 2v19" />
      <path d="M4.9 7.5C2 9.2 2 14 5.1 15.7" />
      <path d="M19.1 7.5C22 9.2 22 14 18.9 15.7" />
    </svg>
  );
}

const CATEGORIES = [
  "Все",
  "Застройщик-банкрот",
  "Банкротство физлица",
  "Финансовая организация",
  "Группа компаний",
  "Сокрытие активов",
  "Оспаривание сделок",
  "Субсидиарная ответственность",
];

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ── Page Component ──────────────────────────────────────── */
export default function CasesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"all" | "completed" | "incomplete">("all");
  const [hoveredCase, setHoveredCase] = useState<string | null>(null);

  const [data, setData] = useState<CaseListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get<CaseListResponse>("/cases/").then((res) => {
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <AuthLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "#8B5CF6" }} />
        </div>
      </AuthLayout>
    );
  }

  const cases = data?.cases ?? [];
  const stats = data?.stats ?? { total: 0, completed: 0, average_score: null, total_attempts: 0 };

  let filteredCases = cases;
  if (selectedCategory !== "Все") {
    filteredCases = filteredCases.filter((c) => c.category === selectedCategory);
  }
  if (selectedDifficulty !== null) {
    filteredCases = filteredCases.filter((c) => c.difficulty === selectedDifficulty);
  }
  if (selectedStatus === "completed") {
    filteredCases = filteredCases.filter((c) => c.completed);
  } else if (selectedStatus === "incomplete") {
    filteredCases = filteredCases.filter((c) => !c.completed);
  }

  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        <style>{`
          @keyframes pulse-glow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.75); }
          }
        `}</style>
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]"
            style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-[60%] -right-32 w-[700px] h-[700px] rounded-full opacity-[0.025]"
            style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
          />
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

        <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
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
              { label: "Всего кейсов", value: stats.total, icon: FileText, color: "var(--info)" },
              { label: "Пройдено", value: `${stats.completed}/${stats.total}`, icon: Star, color: "var(--success)" },
              { label: "Средний балл", value: stats.average_score != null ? `${Math.round(stats.average_score)}%` : "—", icon: Award, color: "#8B5CF6" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl p-4 text-center relative"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                >
                  <span
                    className="absolute top-3 right-3 block w-[6px] h-[6px] rounded-full"
                    style={{
                      background: stat.color,
                      boxShadow: `0 0 6px ${stat.color}`,
                      animation: "pulse-glow 2s ease-in-out infinite",
                    }}
                  />
                  <Icon size={16} className="mx-auto mb-1.5" style={{ color: stat.color }} />
                  <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {stat.value}
                  </div>
                  <div
                    className="text-[10px] font-semibold uppercase tracking-wider mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Hidden facts info card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-5 rounded-xl p-4 flex items-start gap-3 relative"
            style={{
              background: "rgba(139, 92, 246, 0.06)",
              border: "1px solid rgba(139, 92, 246, 0.15)",
            }}
          >
            <div
              className="absolute top-0 left-0 pointer-events-none"
              aria-hidden
              style={{
                width: 16, height: 16,
                borderTop: "2px solid rgba(139,92,246,0.5)",
                borderLeft: "2px solid rgba(139,92,246,0.5)",
                borderRadius: "4px 0 0 0",
              }}
            />
            <div
              className="absolute bottom-0 right-0 pointer-events-none"
              aria-hidden
              style={{
                width: 16, height: 16,
                borderBottom: "2px solid rgba(139,92,246,0.5)",
                borderRight: "2px solid rgba(139,92,246,0.5)",
                borderRadius: "0 0 4px 0",
              }}
            />
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "rgba(139, 92, 246, 0.12)" }}
            >
              <Search size={15} style={{ color: "#8B5CF6" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#8B5CF6" }}>
                Скрытые факты
              </p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                В каждом кейсе есть скрытые факты. Найдите их, задавая правильные вопросы.
                Чем больше фактов раскроете — тем точнее будет ваше решение.
              </p>
            </div>
          </motion.div>

          {/* Category filter */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-5 flex gap-2 overflow-x-auto pb-1"
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

          {/* Status + Difficulty filters */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.13 }}
            className="mt-3 flex gap-2 flex-wrap"
          >
            {(["all", "completed", "incomplete"] as const).map((s) => {
              const labels = { all: "Все", completed: "Пройденные", incomplete: "Непройденные" };
              return (
                <button
                  key={s}
                  onClick={() => setSelectedStatus(s)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: selectedStatus === s ? "rgba(34,197,94,0.12)" : "var(--surface-card)",
                    border: `1px solid ${selectedStatus === s ? "rgba(34,197,94,0.4)" : "var(--border-color)"}`,
                    color: selectedStatus === s ? "var(--success)" : "var(--text-muted)",
                  }}
                >
                  {labels[s]}
                </button>
              );
            })}
            <div className="w-px h-6 self-center" style={{ background: "var(--border-color)" }} />
            {([1, 2, 3] as const).map((d) => {
              const cfg = getDiffConfig(d);
              const active = selectedDifficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDifficulty(active ? null : d)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: active ? cfg.bg : "var(--surface-card)",
                    border: `1px solid ${active ? cfg.border : "var(--border-color)"}`,
                    color: active ? cfg.color : "var(--text-muted)",
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </motion.div>

          {/* Butterfly Effect hero card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="mt-6 rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(88, 28, 235, 0.08) 100%)",
              border: "1px solid",
              borderImage: "linear-gradient(135deg, #8B5CF6, #7C3AED, #6D28D9, #8B5CF6) 1",
              boxShadow: "0 0 30px rgba(139,92,246,0.1)",
            }}
          >
            <div className="p-5 sm:p-6 flex items-start gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                  boxShadow: "0 4px 16px rgba(139, 92, 246, 0.3)",
                }}
              >
                <ButterflyIcon size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Эффект бабочки
                </h2>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Интерактивные кейсы из реальной арбитражной практики. Каждое ваше решение ведёт
                  к разным последствиям — как в жизни. Нет правильных ответов, есть стратегия.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Cases grid */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {filteredCases.map((caseItem, i) => {
                const diff = getDiffConfig(caseItem.difficulty);
                const isHovered = hoveredCase === caseItem.id;

                return (
                  <motion.div
                    key={caseItem.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4, delay: 0.02 + i * 0.04 }}
                    layout
                    className="group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: `1px solid ${isHovered ? "rgba(139, 92, 246, 0.3)" : "rgba(255,255,255,0.06)"}`,
                      boxShadow: isHovered ? "0 8px 32px rgba(139,92,246,0.12)" : "none",
                      transition: `all 0.4s cubic-bezier(${PREMIUM_EASE.join(",")})`,
                    }}
                    onMouseEnter={() => setHoveredCase(caseItem.id)}
                    onMouseLeave={() => setHoveredCase(null)}
                    onClick={() => router.push(`/cases/${caseItem.id}`)}
                  >
                    {/* Top accent line */}
                    <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${diff.color}, transparent 80%)` }} />

                    <div className="p-5">
                      {/* Header row: badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
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
                        {caseItem.completed && (
                          <span
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.2)" }}
                          >
                            <CheckCircle2 size={10} />
                            Пройден
                          </span>
                        )}
                      </div>

                      {/* Title & description */}
                      <h3 className="text-base font-bold tracking-tight leading-snug mb-2" style={{ color: "var(--text-primary)" }}>
                        {caseItem.title}
                      </h3>
                      <p className="text-sm leading-relaxed line-clamp-2 mb-3" style={{ color: "var(--text-secondary)" }}>
                        {caseItem.description}
                      </p>

                      {/* Expert analysis teaser */}
                      <div className="flex items-center gap-1.5 text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
                        <GraduationCap size={12} style={{ color: "#8B5CF6" }} />
                        По завершении — разбор эксперта
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />~{caseItem.estimated_minutes} мин
                        </span>
                        {caseItem.attempts > 0 && (
                          <span className="flex items-center gap-1">
                            <TrendingUp size={12} />
                            {caseItem.attempts} {caseItem.attempts === 1 ? "попытка" : caseItem.attempts < 5 ? "попытки" : "попыток"}
                          </span>
                        )}
                        {caseItem.best_score != null && (
                          <span className="flex items-center gap-1">
                            <Award size={12} />
                            Лучший: {caseItem.best_score}%
                          </span>
                        )}
                      </div>

                      {/* Butterfly effect row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(139, 92, 246, 0.7)" }}>
                          <ButterflyIcon size={13} />
                          <span>Каждое решение меняет ход дела</span>
                        </div>
                      </div>

                      {/* Action */}
                      <div
                        className="flex items-center gap-1.5 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ color: "#8B5CF6" }}
                      >
                        {caseItem.completed ? "Пройти заново" : "Начать кейс"}
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredCases.length === 0 && (
            <div className="mt-8 text-center py-12">
              <Briefcase size={40} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Нет кейсов по выбранным фильтрам</p>
            </div>
          )}

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
