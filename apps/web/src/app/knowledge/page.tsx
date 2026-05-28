"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  MessageSquare,
  Bell,
  ArrowRight,
  FileText,
  Scale,
  Sparkles,
  ExternalLink,
  Clock,
  AlertTriangle,
  Layers,
  Hash,
  ChevronRight,
  Zap,
  RefreshCw,
  Loader2,
  Tag,
  Send,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { KnowledgeBaseBrowser } from "@/components/pvp/KnowledgeBaseBrowser";
import { api } from "@/lib/api";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;
const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const QUICK_TOPICS = [
  { title: "Процедуры банкротства", icon: "📋", color: "#8B5CF6", description: "Наблюдение, реструктуризация, конкурсное производство", category: "procedure" },
  { title: "Оспаривание сделок", icon: "⚖️", color: "#EF4444", description: "Ст.61.2, ст.61.3, подозрительные и преференциальные", category: "property" },
  { title: "Субсидиарная ответственность", icon: "🎯", color: "#F59E0B", description: "КДЛ, доказывание, размер ответственности", category: "consequences" },
  { title: "Торги и реализация", icon: "🔨", color: "#10B981", description: "Порядок проведения, оспаривание результатов", category: "costs" },
  { title: "Банкротство физлиц", icon: "👤", color: "#3B82F6", description: "Процедура, ограничения, списание долгов", category: "eligibility" },
  { title: "Работа с кредиторами", icon: "👥", color: "#EC4899", description: "Реестр, собрания, голосование, очерёдность", category: "creditors" },
];

const IMPACT_CONFIG: Record<string, { label: string; color: string; bg: string; glow: string }> = {
  high: { label: "Важно", color: "#EF4444", bg: "rgba(239,68,68,0.08)", glow: "rgba(239,68,68,0.15)" },
  medium: { label: "Значимо", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", glow: "rgba(245,158,11,0.15)" },
  low: { label: "К сведению", color: "#3B82F6", bg: "rgba(59,130,246,0.08)", glow: "rgba(59,130,246,0.15)" },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Практика ВС": "#8B5CF6",
  "Изменения ФЗ": "#EF4444",
  "Постановления Пленума": "#F59E0B",
  "Обзоры практики": "#10B981",
  "Разъяснения ФНС": "#3B82F6",
  "Арбитражная практика": "#EC4899",
};

const POPULAR_QUESTIONS = [
  { q: "Какие сроки для подачи заявления о банкротстве?", category: "Процедуры" },
  { q: "Кто может быть арбитражным управляющим?", category: "АУ" },
  { q: "Как оспорить подозрительную сделку?", category: "Сделки" },
  { q: "Какая очерёдность требований кредиторов?", category: "Реестр" },
  { q: "Что такое субсидиарная ответственность КДЛ?", category: "КДЛ" },
  { q: "Как проходит реструктуризация долгов гражданина?", category: "Физлица" },
];

interface KnowledgeStats {
  total_chunks: number;
  categories: { category: string; count: number }[];
  last_updated: string | null;
}

interface AiSource {
  category: string;
  law_article: string;
  relevance: number;
  is_court_practice: boolean;
  court_case: string;
}

interface AiResponse {
  answer: string;
  sources: AiSource[];
  model: string;
  retrieval_ms: number;
  generation_ms: number;
  total_ms: number;
}

interface RadarItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  source_url: string | null;
  category: string;
  relevance_score: number;
  published_at: string;
  tags: string[];
  is_ai_generated: boolean;
}

interface RadarResponse {
  items: RadarItem[];
  total: number;
  last_updated: string | null;
}

interface HistoryEntry {
  question: string;
  answer: string;
  sources: AiSource[];
  timestamp: number;
}

function getImpactLevel(score: number): "high" | "medium" | "low" {
  if (score >= 0.85) return "high";
  if (score >= 0.7) return "medium";
  return "low";
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "менее часа назад";
  if (diffHours < 24) return `${diffHours} ч. назад`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return date.toLocaleDateString("ru-RU");
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      idx.current += 2;
      if (idx.current >= text.length) {
        setDisplayed(text);
        clearInterval(interval);
      } else {
        setDisplayed(text.slice(0, idx.current));
      }
    }, 8);
    return () => clearInterval(interval);
  }, [text]);

  return <>{displayed}</>;
}

/* ── Section Header ───────────────────────────────────────────── */
function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon size={13} style={{ color: "var(--text-muted)" }} />
      <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)" }} />
    </div>
  );
}

export default function KnowledgePage() {
  const router = useRouter();
  const [aiQuery, setAiQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"browse" | "radar" | "ai">("browse");
  const [browserKey, setBrowserKey] = useState(0);

  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResponse | null>(null);
  const [aiHistory, setAiHistory] = useState<HistoryEntry[]>([]);

  const [radarItems, setRadarItems] = useState<RadarItem[]>([]);
  const [radarTotal, setRadarTotal] = useState(0);
  const [radarLastUpdated, setRadarLastUpdated] = useState<string | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarCategory, setRadarCategory] = useState<string | null>(null);
  const [radarCategories, setRadarCategories] = useState<{ category: string; count: number }[]>([]);

  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    api.get<KnowledgeStats>("/knowledge-ai/stats").then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("knowledge_ai_history");
      if (saved) setAiHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const saveHistory = useCallback((entries: HistoryEntry[]) => {
    setAiHistory(entries);
    try {
      sessionStorage.setItem("knowledge_ai_history", JSON.stringify(entries.slice(0, 20)));
    } catch {}
  }, []);

  const handleAsk = useCallback(async (question?: string) => {
    const q = (question || aiQuery).trim();
    if (!q || aiLoading) return;

    setAiLoading(true);
    setAiResult(null);

    try {
      const result = await api.post<AiResponse>("/knowledge-ai/ask", { question: q });
      setAiResult(result);
      const entry: HistoryEntry = {
        question: q,
        answer: result.answer,
        sources: result.sources,
        timestamp: Date.now(),
      };
      saveHistory([entry, ...aiHistory]);
    } catch {
      setAiResult({
        answer: "Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.",
        sources: [],
        model: "",
        retrieval_ms: 0,
        generation_ms: 0,
        total_ms: 0,
      });
    } finally {
      setAiLoading(false);
    }
  }, [aiQuery, aiLoading, aiHistory, saveHistory]);

  const loadRadar = useCallback(async (cat?: string | null) => {
    setRadarLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cat) params.set("category", cat);
      const data = await api.get<RadarResponse>(`/knowledge-ai/radar?${params}`);
      setRadarItems(data.items);
      setRadarTotal(data.total);
      setRadarLastUpdated(data.last_updated);
    } catch {}
    setRadarLoading(false);
  }, []);

  const loadRadarCategories = useCallback(async () => {
    try {
      const cats = await api.get<{ category: string; count: number }[]>("/knowledge-ai/radar/categories");
      setRadarCategories(cats);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeSection === "radar") {
      loadRadar(radarCategory);
      loadRadarCategories();
    }
  }, [activeSection, radarCategory, loadRadar, loadRadarCategories]);

  const statsDisplay = stats
    ? [
        { label: "Статей в базе", value: String(stats.total_chunks), icon: FileText, color: "#10B981" },
        { label: "Категорий", value: String(stats.categories.length), icon: Layers, color: "#8B5CF6" },
        { label: "Обновлено", value: stats.last_updated ? formatRelativeTime(stats.last_updated) : "—", icon: Zap, color: "#F59E0B" },
      ]
    : [
        { label: "Статей в базе", value: "—", icon: FileText, color: "#10B981" },
        { label: "Категорий", value: "—", icon: Layers, color: "#8B5CF6" },
        { label: "Обновлено", value: "—", icon: Zap, color: "#F59E0B" },
      ];

  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        <style>{`
          @keyframes pulse-glow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.75); }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes live-pulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
            50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(239,68,68,0); }
          }
          @keyframes gradient-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes input-glow {
            0%, 100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.06), 0 0 20px rgba(16,185,129,0.05); }
            50% { box-shadow: 0 0 0 4px rgba(16,185,129,0.1), 0 0 30px rgba(16,185,129,0.08); }
          }
        `}</style>

        {/* Ambient glow orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-32 right-[10%] rounded-full opacity-[0.04]" style={{ width: 900, height: 900, background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }} />
          <div className="absolute top-[60%] -left-20 rounded-full opacity-[0.03]" style={{ width: 700, height: 700, background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }} />
          <div className="absolute top-[30%] right-[-5%] rounded-full opacity-[0.025]" style={{ width: 600, height: 600, background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }} />
        </div>

        {/* Noise texture */}
        <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden style={{ backgroundImage: NOISE_SVG, backgroundRepeat: "repeat", opacity: 1 }} />

        <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 py-8 sm:py-12">

          {/* ═══════════════════ PAGE HEADER ═══════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="mb-8"
          >
            <div className="flex items-center gap-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.1))",
                  boxShadow: "0 0 0 1px rgba(16,185,129,0.25), 0 0 30px rgba(16,185,129,0.12), 0 8px 32px rgba(0,0,0,0.3)",
                }}
              >
                <BookOpen size={26} style={{ color: "#10B981" }} />
              </div>
              <div>
                <h1
                  className="text-3xl sm:text-4xl font-black tracking-tight"
                  style={{
                    background: "linear-gradient(135deg, #ffffff 0%, #10B981 50%, #3B82F6 100%)",
                    backgroundSize: "200% 200%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "gradient-shift 6s ease infinite",
                  }}
                >
                  База знаний
                </h1>
                <p className="text-sm mt-1 font-medium" style={{ color: "var(--text-muted)" }}>
                  ФЗ-127, судебная практика, AI-помощник
                </p>
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════ STATS ROW ═══════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="grid grid-cols-3 gap-3 sm:gap-4 mb-8"
          >
            {statsDisplay.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.08 + i * 0.05, ease: PREMIUM_EASE }}
                  className="group rounded-2xl p-4 sm:p-5 relative overflow-hidden"
                  style={{
                    background: "rgba(15, 15, 30, 0.95)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `color-mix(in srgb, ${stat.color} 40%, transparent)`;
                    e.currentTarget.style.boxShadow = `0 0 20px color-mix(in srgb, ${stat.color} 10%, transparent), 0 8px 32px rgba(0, 0, 0, 0.3)`;
                    e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                    e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.3)";
                    e.currentTarget.style.transform = "translateY(0) scale(1)";
                  }}
                >
                  {/* Hover radial glow */}
                  <div
                    className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `radial-gradient(circle, color-mix(in srgb, ${stat.color} 15%, transparent) 0%, transparent 70%)` }}
                  />
                  <div className="relative z-10">
                    <div className="relative inline-block">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                        style={{ background: `color-mix(in srgb, ${stat.color} 12%, transparent)`, color: stat.color }}
                      >
                        <Icon size={16} />
                      </div>
                      {/* Animated pulse dot */}
                      <motion.div
                        animate={{
                          opacity: [0.4, 1, 0.4],
                          boxShadow: [`0 0 4px ${stat.color}`, `0 0 12px ${stat.color}`, `0 0 4px ${stat.color}`],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                          position: "absolute",
                          top: "0px",
                          right: "-2px",
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: stat.color,
                        }}
                      />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight" style={{ color: "var(--text-primary)" }}>
                      {stat.value}
                    </div>
                    <div className="text-[10px] font-bold mt-1 uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
                      {stat.label}
                    </div>
                  </div>
                  {/* Bottom accent line */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: `linear-gradient(90deg, ${stat.color}, transparent 80%)` }}
                  />
                </motion.div>
              );
            })}
          </motion.div>

          {/* ═══════════════════ SECTION TABS ═══════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mb-8 flex gap-2"
          >
            {([
              { id: "browse" as const, label: "Справочник", icon: BookOpen },
              { id: "radar" as const, label: "Радар", icon: Bell },
              { id: "ai" as const, label: "AI-помощник", icon: Sparkles },
            ]).map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 relative overflow-hidden"
                  style={{
                    background: isActive ? "rgba(15, 15, 30, 0.95)" : "rgba(15, 15, 30, 0.6)",
                    border: `1.5px solid ${isActive ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.06)"}`,
                    color: isActive ? "#10B981" : "var(--text-muted)",
                    boxShadow: isActive ? "0 0 20px rgba(16,185,129,0.12), 0 4px 24px rgba(0,0,0,0.3)" : "0 4px 24px rgba(0,0,0,0.15)",
                  }}
                >
                  <TabIcon size={14} />
                  {tab.label}
                  {isActive && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ background: "linear-gradient(90deg, #10B981, transparent 80%)" }}
                    />
                  )}
                </button>
              );
            })}
          </motion.div>

          {/* ═══════════════════ CONTENT SECTIONS ═══════════════════ */}
          <AnimatePresence mode="wait">
            {/* ─── Browse section ──────────────────────────── */}
            {activeSection === "browse" && (
              <motion.div
                key="browse"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: PREMIUM_EASE }}
              >
                <SectionHeader icon={BookOpen} label="Быстрые темы" />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
                  {QUICK_TOPICS.map((topic, i) => (
                    <motion.div
                      key={topic.title}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.45, ease: PREMIUM_EASE }}
                      className="group relative rounded-2xl overflow-hidden cursor-pointer"
                      style={{
                        background: "rgba(15, 15, 30, 0.95)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
                        transition: "all 0.3s ease",
                      }}
                      onClick={() => {
                        router.push(`/knowledge?category=${topic.category}`);
                        setBrowserKey((k) => k + 1);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `color-mix(in srgb, ${topic.color} 40%, transparent)`;
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow = `0 0 20px color-mix(in srgb, ${topic.color} 15%, transparent), 0 12px 40px rgba(0, 0, 0, 0.35)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.3)";
                      }}
                    >
                      {/* Top gradient line */}
                      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${topic.color}, transparent 80%)` }} />

                      {/* Hover gradient overlay */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse at top left, color-mix(in srgb, ${topic.color} 6%, transparent) 0%, transparent 60%)` }}
                      />

                      <div className="p-4 sm:p-5 relative z-10">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-2xl block">{topic.icon}</span>
                          <ArrowRight
                            size={14}
                            className="opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5 mt-1"
                            style={{ color: topic.color }}
                          />
                        </div>
                        <h4 className="text-sm font-black mb-1.5 leading-snug tracking-tight" style={{ color: "var(--text-primary)" }}>
                          {topic.title}
                        </h4>
                        <p className="text-[11px] leading-relaxed mb-3 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                          {topic.description}
                        </p>
                        <div className="flex items-center">
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: `color-mix(in srgb, ${topic.color} 10%, transparent)`, color: topic.color }}
                          >
                            <Hash size={9} />
                            {stats?.categories.find((c) => c.category === topic.category)?.count ?? "—"} статей
                          </span>
                        </div>
                      </div>

                      {/* Bottom accent line */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-[2px]"
                        style={{ background: `linear-gradient(90deg, ${topic.color}, transparent 80%)` }}
                      />
                    </motion.div>
                  ))}
                </div>

                <KnowledgeBaseBrowser key={browserKey} />
              </motion.div>
            )}

            {/* ─── Legislative Radar section ───────────────── */}
            {activeSection === "radar" && (
              <motion.div
                key="radar"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: PREMIUM_EASE }}
                className="space-y-5"
              >
                {/* Radar hero card */}
                <div
                  className="rounded-2xl p-6 relative overflow-hidden"
                  style={{
                    background: "rgba(15, 15, 30, 0.95)",
                    border: "1px solid rgba(239,68,68,0.15)",
                    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(239,68,68,0.05)",
                  }}
                >
                  {/* Top gradient line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #EF4444, #F59E0B, transparent)" }} />

                  {/* Corner marks */}
                  <div className="absolute top-3 left-3 w-4 h-4" style={{ borderTop: "2px solid rgba(239,68,68,0.4)", borderLeft: "2px solid rgba(239,68,68,0.4)", borderRadius: "2px 0 0 0" }} />
                  <div className="absolute bottom-3 right-3 w-4 h-4" style={{ borderBottom: "2px solid rgba(239,68,68,0.4)", borderRight: "2px solid rgba(239,68,68,0.4)", borderRadius: "0 0 2px 0" }} />

                  {/* Ambient glow */}
                  <div className="absolute -top-20 right-[-10%] w-[300px] h-[300px] rounded-full opacity-[0.04] pointer-events-none" style={{ background: "radial-gradient(circle, #EF4444 0%, transparent 70%)" }} />

                  <div className="flex items-start gap-4 relative z-10">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(239,68,68,0.12)", boxShadow: "0 0 20px rgba(239,68,68,0.08)" }}
                    >
                      <Bell size={18} style={{ color: "#EF4444" }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                          Законодательный радар
                        </h3>
                        {/* LIVE indicator */}
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md" style={{ background: "rgba(239,68,68,0.1)" }}>
                          <div
                            className="w-[6px] h-[6px] rounded-full"
                            style={{ background: "#EF4444", animation: "live-pulse 2s ease-in-out infinite" }}
                          />
                          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#EF4444" }}>Live</span>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Отслеживаем изменения в ФЗ-127, разъяснения ВС РФ и практику арбитражных судов.
                      </p>
                    </div>
                    <button
                      onClick={() => loadRadar(radarCategory)}
                      disabled={radarLoading}
                      className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                      style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.15)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.boxShadow = "0 0 15px rgba(239,68,68,0.15)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      {radarLoading ? <Loader2 size={16} className="animate-spin" style={{ color: "#EF4444" }} /> : <RefreshCw size={16} style={{ color: "#EF4444" }} />}
                    </button>
                  </div>
                  {radarLastUpdated && (
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] relative z-10" style={{ color: "var(--text-muted)" }}>
                      <Clock size={10} />
                      Последнее обновление: {formatRelativeTime(radarLastUpdated)}
                    </div>
                  )}

                  {/* Bottom accent */}
                  <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #EF4444, transparent 80%)" }} />
                </div>

                {/* Category filters */}
                {radarCategories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setRadarCategory(null)}
                      className="text-[10px] font-black px-3 py-1.5 rounded-lg transition-all duration-300"
                      style={{
                        background: !radarCategory ? "rgba(15, 15, 30, 0.95)" : "rgba(15, 15, 30, 0.6)",
                        border: `1.5px solid ${!radarCategory ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.06)"}`,
                        color: !radarCategory ? "#10B981" : "var(--text-muted)",
                        boxShadow: !radarCategory ? "0 0 15px rgba(16,185,129,0.1)" : "none",
                      }}
                    >
                      Все ({radarTotal})
                    </button>
                    {radarCategories.map((cat) => {
                      const color = CATEGORY_COLORS[cat.category] || "#6B7280";
                      const isActive = radarCategory === cat.category;
                      return (
                        <button
                          key={cat.category}
                          onClick={() => setRadarCategory(cat.category)}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all duration-300"
                          style={{
                            background: isActive ? "rgba(15, 15, 30, 0.95)" : "rgba(15, 15, 30, 0.6)",
                            border: `1.5px solid ${isActive ? `color-mix(in srgb, ${color} 50%, transparent)` : "rgba(255,255,255,0.06)"}`,
                            color: isActive ? color : "var(--text-muted)",
                            boxShadow: isActive ? `0 0 15px color-mix(in srgb, ${color} 12%, transparent)` : "none",
                          }}
                        >
                          {cat.category} ({cat.count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Radar loading skeleton */}
                {radarLoading && radarItems.length === 0 && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-2xl p-5 animate-pulse"
                        style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <div className="h-3 w-3/4 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                        <div className="h-2 w-1/2 rounded mt-3" style={{ background: "rgba(255,255,255,0.04)" }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Radar items */}
                {radarItems.map((item, i) => {
                  const impact = IMPACT_CONFIG[getImpactLevel(item.relevance_score)];
                  const catColor = CATEGORY_COLORS[item.category] || "#6B7280";
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.45, ease: PREMIUM_EASE }}
                      className="group rounded-2xl overflow-hidden relative"
                      style={{
                        background: "rgba(15, 15, 30, 0.95)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `color-mix(in srgb, ${impact.color} 35%, transparent)`;
                        e.currentTarget.style.transform = "translateX(4px)";
                        e.currentTarget.style.boxShadow = `0 0 20px ${impact.glow}, 0 8px 32px rgba(0, 0, 0, 0.3)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                        e.currentTarget.style.transform = "translateX(0)";
                        e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.3)";
                      }}
                    >
                      {/* Top accent line */}
                      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${impact.color}, transparent 60%)` }} />

                      <div className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-1.5">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ background: impact.color, boxShadow: `0 0 10px ${impact.color}` }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {/* Impact badge with glow */}
                              <span
                                className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg"
                                style={{
                                  background: impact.bg,
                                  color: impact.color,
                                  boxShadow: `0 0 12px ${impact.glow}`,
                                }}
                              >
                                {impact.label}
                              </span>
                              <span
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                                style={{ background: `color-mix(in srgb, ${catColor} 10%, transparent)`, color: catColor }}
                              >
                                {item.category}
                              </span>
                              <span
                                className="text-[10px] font-medium px-2.5 py-1 rounded-lg"
                                style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}
                              >
                                {item.source}
                              </span>
                              <span className="text-[10px] ml-auto font-medium" style={{ color: "var(--text-muted)" }}>
                                {formatDate(item.published_at)}
                              </span>
                            </div>
                            <h4 className="text-sm font-black leading-snug mb-1.5 tracking-tight" style={{ color: "var(--text-primary)" }}>
                              {item.title}
                            </h4>
                            <p className="text-xs leading-relaxed mb-2.5" style={{ color: "var(--text-muted)" }}>
                              {item.summary}
                            </p>
                            {item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {item.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-md"
                                    style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.04)" }}
                                  >
                                    <Tag size={8} />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {item.source_url && (
                            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <ExternalLink
                                size={14}
                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-1"
                                style={{ color: "var(--text-muted)" }}
                              />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Bottom accent line */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-[2px]"
                        style={{ background: `linear-gradient(90deg, ${impact.color}, transparent 80%)` }}
                      />
                    </motion.div>
                  );
                })}

                {/* Empty state */}
                {!radarLoading && radarItems.length === 0 && (
                  <div
                    className="text-center py-10 rounded-2xl relative overflow-hidden"
                    style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
                  >
                    <Bell size={36} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
                    <p className="text-sm font-bold mb-1" style={{ color: "var(--text-secondary)" }}>Радар обновляется каждые 12 часов</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Новые изменения в законодательстве появятся здесь автоматически</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── AI Assistant section ──────────────────── */}
            {activeSection === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: PREMIUM_EASE }}
                className="space-y-5"
              >
                {/* AI hero card — premium chat input */}
                <div
                  className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
                  style={{
                    background: "rgba(15, 15, 30, 0.95)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 60px rgba(16,185,129,0.06)",
                  }}
                >
                  {/* Top gradient line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #10B981, #3B82F6, transparent)" }} />

                  {/* Ambient glow */}
                  <div className="absolute -top-20 right-[-10%] w-[350px] h-[350px] rounded-full opacity-[0.05] pointer-events-none" style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }} />
                  <div className="absolute -bottom-20 left-[-10%] w-[250px] h-[250px] rounded-full opacity-[0.03] pointer-events-none" style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }} />

                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(16,185,129,0.15)", boxShadow: "0 0 20px rgba(16,185,129,0.1)" }}
                      >
                        <Sparkles size={18} style={{ color: "#10B981" }} />
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] block" style={{ color: "#10B981" }}>
                          AI-помощник
                        </span>
                        <span className="text-[10px] font-medium block mt-0.5" style={{ color: "var(--text-muted)" }}>
                          ФЗ-127 и судебная практика
                        </span>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
                      Задайте вопрос — AI найдёт ответ в базе законодательства, судебной практике и материалах платформы. Все ответы со ссылками на первоисточники.
                    </p>

                    {/* Premium input */}
                    <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }}>
                      <div
                        className="rounded-xl p-1 transition-all duration-500"
                        style={{
                          background: inputFocused
                            ? "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,130,246,0.15))"
                            : "rgba(255,255,255,0.04)",
                          boxShadow: inputFocused
                            ? "0 0 0 1px rgba(16,185,129,0.3), 0 0 30px rgba(16,185,129,0.08)"
                            : "0 0 0 1px rgba(255,255,255,0.06)",
                          animation: inputFocused ? "input-glow 3s ease-in-out infinite" : "none",
                        }}
                      >
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300" style={{ color: inputFocused ? "#10B981" : "var(--text-muted)" }} />
                            <input
                              type="text"
                              value={aiQuery}
                              onChange={(e) => setAiQuery(e.target.value)}
                              placeholder="Например: Какие основания для оспаривания сделки по ст.61.2?"
                              disabled={aiLoading}
                              className="w-full pl-11 pr-4 py-4 rounded-lg text-sm font-medium"
                              style={{
                                background: "rgba(15, 15, 30, 0.8)",
                                border: "none",
                                color: "var(--text-primary)",
                                outline: "none",
                              }}
                              onFocus={() => setInputFocused(true)}
                              onBlur={() => setInputFocused(false)}
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={aiLoading || !aiQuery.trim()}
                            className="px-6 py-4 rounded-lg text-sm font-black transition-all duration-300 flex items-center gap-2 disabled:opacity-40 shrink-0"
                            style={{
                              background: "linear-gradient(135deg, #10B981, #059669)",
                              color: "#fff",
                              boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
                            }}
                            onMouseEnter={(e) => {
                              if (!aiLoading) {
                                e.currentTarget.style.boxShadow = "0 4px 30px rgba(16,185,129,0.5)";
                                e.currentTarget.style.transform = "translateY(-2px)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = "0 4px 20px rgba(16,185,129,0.3)";
                              e.currentTarget.style.transform = "translateY(0)";
                            }}
                          >
                            {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Спросить
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Bottom accent */}
                  <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #10B981, #3B82F6, transparent 80%)" }} />
                </div>

                {/* AI Loading */}
                {aiLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-6 space-y-3 relative overflow-hidden"
                    style={{
                      background: "rgba(15, 15, 30, 0.95)",
                      border: "1px solid rgba(16,185,129,0.12)",
                      boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                    }}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <Loader2 size={16} className="animate-spin" style={{ color: "#10B981" }} />
                      <span className="text-xs font-black uppercase tracking-wider" style={{ color: "#10B981" }}>Ищу в базе знаний...</span>
                    </div>
                    <div className="space-y-2.5 animate-pulse">
                      <div className="h-3 w-full rounded-md" style={{ background: "rgba(255,255,255,0.06)" }} />
                      <div className="h-3 w-5/6 rounded-md" style={{ background: "rgba(255,255,255,0.05)" }} />
                      <div className="h-3 w-4/6 rounded-md" style={{ background: "rgba(255,255,255,0.04)" }} />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #10B981, transparent 80%)" }} />
                  </motion.div>
                )}

                {/* AI Result */}
                {aiResult && !aiLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: PREMIUM_EASE }}
                    className="space-y-4"
                  >
                    {/* Answer card */}
                    <div
                      className="rounded-2xl p-6 relative overflow-hidden"
                      style={{
                        background: "rgba(15, 15, 30, 0.95)",
                        border: "1px solid rgba(16,185,129,0.2)",
                        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 30px rgba(16,185,129,0.05)",
                      }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #10B981, transparent 60%)" }} />

                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)" }}>
                          <Sparkles size={13} style={{ color: "#10B981" }} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider" style={{ color: "#10B981" }}>Ответ AI</span>
                        {aiResult.total_ms > 0 && (
                          <span className="text-[10px] ml-auto font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>
                            {(aiResult.total_ms / 1000).toFixed(1)}с
                          </span>
                        )}
                      </div>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                        <TypewriterText text={aiResult.answer} />
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #10B981, transparent 80%)" }} />
                    </div>

                    {/* Sources */}
                    {aiResult.sources.length > 0 && (
                      <div>
                        <SectionHeader icon={FileText} label={`Источники (${aiResult.sources.length})`} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          {aiResult.sources.map((src, idx) => (
                            <div
                              key={idx}
                              className="group rounded-2xl p-4 text-xs relative overflow-hidden"
                              style={{
                                background: "rgba(15, 15, 30, 0.95)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
                                transition: "all 0.3s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "rgba(16,185,129,0.25)";
                                e.currentTarget.style.boxShadow = "0 0 15px rgba(16,185,129,0.08), 0 8px 32px rgba(0,0,0,0.3)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.3)";
                              }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {/* Citation badge with glow */}
                                <span
                                  className="font-black px-2 py-0.5 rounded-md text-[10px]"
                                  style={{
                                    background: "rgba(16,185,129,0.1)",
                                    color: "#10B981",
                                    boxShadow: "0 0 10px rgba(16,185,129,0.08)",
                                  }}
                                >
                                  {src.category}
                                </span>
                                {src.is_court_practice && (
                                  <span
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                    style={{ background: "rgba(139,92,246,0.1)", color: "#8B5CF6", boxShadow: "0 0 8px rgba(139,92,246,0.06)" }}
                                  >
                                    <Scale size={9} />
                                    Суд
                                  </span>
                                )}
                                <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color: "var(--text-muted)" }}>
                                  {Math.round(src.relevance * 100)}%
                                </span>
                              </div>
                              {src.law_article && (
                                <div className="text-[11px] font-bold mb-0.5" style={{ color: "var(--text-secondary)" }}>{src.law_article}</div>
                              )}
                              {src.court_case && (
                                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{src.court_case}</div>
                              )}

                              {/* Bottom accent */}
                              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #10B981, transparent 80%)" }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Popular questions — shown when no result */}
                {!aiResult && !aiLoading && (
                  <div>
                    <SectionHeader icon={MessageSquare} label="Популярные вопросы" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {POPULAR_QUESTIONS.map(({ q, category }) => (
                        <button
                          key={q}
                          onClick={() => { setAiQuery(q); handleAsk(q); }}
                          className="flex items-start gap-3 text-left rounded-2xl p-4 transition-all duration-300 text-xs group relative overflow-hidden"
                          style={{
                            background: "rgba(15, 15, 30, 0.95)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
                            color: "var(--text-secondary)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)";
                            e.currentTarget.style.color = "var(--text-primary)";
                            e.currentTarget.style.boxShadow = "0 0 20px rgba(16,185,129,0.08), 0 8px 32px rgba(0,0,0,0.3)";
                            e.currentTarget.style.transform = "translateX(4px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                            e.currentTarget.style.color = "var(--text-secondary)";
                            e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.3)";
                            e.currentTarget.style.transform = "translateX(0)";
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: "rgba(16,185,129,0.1)" }}
                          >
                            <MessageSquare size={14} style={{ color: "#10B981" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block leading-relaxed font-medium">{q}</span>
                            <span
                              className="inline-block mt-1.5 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider"
                              style={{ background: "rgba(16,185,129,0.08)", color: "#10B981" }}
                            >
                              {category}
                            </span>
                          </div>
                          <ChevronRight
                            size={14}
                            className="shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5"
                            style={{ color: "#10B981" }}
                          />

                          {/* Bottom accent */}
                          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #10B981, transparent 80%)" }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* History */}
                {aiHistory.length > 0 && !aiLoading && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <Clock size={13} style={{ color: "var(--text-muted)" }} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                          История вопросов
                        </span>
                        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)" }} />
                      </div>
                      <button
                        onClick={() => { setAiHistory([]); try { sessionStorage.removeItem("knowledge_ai_history"); } catch {} }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all duration-300"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.15)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.boxShadow = "0 0 10px rgba(239,68,68,0.1)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        Очистить
                      </button>
                    </div>
                    <div className="space-y-2">
                      {aiHistory.slice(0, 5).map((entry, idx) => (
                        <button
                          key={idx}
                          onClick={() => { setAiQuery(entry.question); handleAsk(entry.question); }}
                          className="w-full text-left rounded-xl p-3.5 transition-all duration-300 text-xs group flex items-center gap-3 relative overflow-hidden"
                          style={{
                            background: "rgba(15, 15, 30, 0.8)",
                            border: "1px solid rgba(255,255,255,0.04)",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "rgba(16,185,129,0.2)";
                            e.currentTarget.style.boxShadow = "0 0 15px rgba(16,185,129,0.06), 0 4px 20px rgba(0,0,0,0.25)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
                            e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.2)";
                          }}
                        >
                          <MessageSquare size={12} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                          <span className="flex-1 truncate font-medium" style={{ color: "var(--text-secondary)" }}>{entry.question}</span>
                          <span className="text-[9px] shrink-0 font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>
                            {new Date(entry.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div
                  className="flex items-start gap-3 rounded-2xl p-4 relative overflow-hidden"
                  style={{
                    background: "rgba(15, 15, 30, 0.95)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    AI-помощник использует актуальную редакцию ФЗ-127 и базу судебных решений.
                    Ответы носят информационный характер и не являются юридической консультацией.
                  </span>
                  <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.06), transparent 80%)" }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AuthLayout>
  );
}
