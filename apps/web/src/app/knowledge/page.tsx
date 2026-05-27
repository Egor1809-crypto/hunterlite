"use client";

import { useState } from "react";
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
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { KnowledgeBaseBrowser } from "@/components/pvp/KnowledgeBaseBrowser";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;
const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const RADAR_ITEMS = [
  {
    date: "15.05.2026",
    title: "Постановление Пленума ВС РФ о применении норм субсидиарной ответственности",
    type: "ВС РФ",
    impact: "high" as const,
    summary: "Новые разъяснения по определению КДЛ и распределению бремени доказывания",
  },
  {
    date: "08.05.2026",
    title: "Изменения в ст.61.2 ФЗ-127: новые критерии подозрительных сделок",
    type: "ФЗ-127",
    impact: "high" as const,
    summary: "Расширен перечень оснований для оспаривания, снижен порог доказывания",
  },
  {
    date: "01.05.2026",
    title: "Разъяснения ФНС о порядке включения налоговых требований в реестр",
    type: "ФНС",
    impact: "medium" as const,
    summary: "Уточнены сроки и процедура включения налоговых требований",
  },
  {
    date: "22.04.2026",
    title: "Обзор судебной практики: оспаривание результатов торгов",
    type: "Практика",
    impact: "low" as const,
    summary: "Систематизированы основания для признания торгов недействительными",
  },
];

const IMPACT_CONFIG = {
  high: { label: "Важно", color: "#EF4444", bg: "rgba(239,68,68,0.08)", glow: "rgba(239,68,68,0.15)" },
  medium: { label: "Значимо", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", glow: "rgba(245,158,11,0.15)" },
  low: { label: "К сведению", color: "#3B82F6", bg: "rgba(59,130,246,0.08)", glow: "rgba(59,130,246,0.15)" },
};

const QUICK_TOPICS = [
  { title: "Процедуры банкротства", articles: 45, icon: "📋", color: "#8B5CF6", description: "Наблюдение, реструктуризация, конкурсное производство" },
  { title: "Оспаривание сделок", articles: 32, icon: "⚖️", color: "#EF4444", description: "Ст.61.2, ст.61.3, подозрительные и преференциальные" },
  { title: "Субсидиарная ответственность", articles: 28, icon: "🎯", color: "#F59E0B", description: "КДЛ, доказывание, размер ответственности" },
  { title: "Торги и реализация", articles: 24, icon: "🔨", color: "#10B981", description: "Порядок проведения, оспаривание результатов" },
  { title: "Банкротство физлиц", articles: 36, icon: "👤", color: "#3B82F6", description: "Процедура, ограничения, списание долгов" },
  { title: "Работа с кредиторами", articles: 22, icon: "👥", color: "#EC4899", description: "Реестр, собрания, голосование, очерёдность" },
];

const STATS = [
  { label: "Статей в базе", value: "624", icon: FileText, color: "#10B981" },
  { label: "Категорий", value: "10", icon: Layers, color: "#8B5CF6" },
  { label: "Обновлено", value: "Сегодня", icon: Zap, color: "#F59E0B" },
];

export default function KnowledgePage() {
  const [aiQuery, setAiQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"browse" | "radar" | "ai">("browse");

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
        `}</style>

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-32 right-[10%] rounded-full opacity-[0.035]"
            style={{ width: 800, height: 800, background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-[60%] -left-20 rounded-full opacity-[0.025]"
            style={{ width: 600, height: 600, background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-[30%] right-[-5%] rounded-full opacity-[0.02]"
            style={{ width: 500, height: 500, background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
          />
        </div>

        <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden style={{ backgroundImage: NOISE_SVG, backgroundRepeat: "repeat", opacity: 1 }} />

        <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: PREMIUM_EASE }}
            className="mb-6"
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.1))",
                  boxShadow: "0 0 0 1px rgba(16,185,129,0.2), 0 0 20px rgba(16,185,129,0.1)",
                }}
              >
                <BookOpen size={22} style={{ color: "#10B981" }} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  База знаний
                </h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                  ФЗ-127, судебная практика, AI-помощник
                </p>
              </div>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.04 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            {STATS.map((stat) => {
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
                  <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Section tabs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06 }}
            className="mb-6 flex gap-2"
          >
            {[
              { id: "browse" as const, label: "Справочник", icon: BookOpen },
              { id: "radar" as const, label: "Радар", icon: Bell },
              { id: "ai" as const, label: "AI-помощник", icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: isActive ? "rgba(16,185,129,0.12)" : "var(--surface-card)",
                    border: `1.5px solid ${isActive ? "rgba(16,185,129,0.4)" : "var(--border-color)"}`,
                    color: isActive ? "#10B981" : "var(--text-muted)",
                    boxShadow: isActive ? "0 0 20px rgba(16,185,129,0.15)" : "none",
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </motion.div>

          {/* ─── Browse section ──────────────────────────── */}
          <AnimatePresence mode="wait">
            {activeSection === "browse" && (
              <motion.div
                key="browse"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
              >
                {/* Topic cards — enhanced */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {QUICK_TOPICS.map((topic, i) => (
                    <motion.div
                      key={topic.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4, ease: PREMIUM_EASE }}
                      className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${topic.color}40`;
                        e.currentTarget.style.transform = "translateY(-3px)";
                        e.currentTarget.style.boxShadow = `0 8px 30px ${topic.color}15`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      {/* Top accent gradient */}
                      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${topic.color}, transparent 80%)` }} />

                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-2xl block">{topic.icon}</span>
                          <ArrowRight
                            size={12}
                            className="opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                            style={{ color: topic.color }}
                          />
                        </div>
                        <h4 className="text-xs font-bold mb-1 leading-snug" style={{ color: "var(--text-primary)" }}>
                          {topic.title}
                        </h4>
                        <p className="text-[10px] leading-relaxed mb-2 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                          {topic.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: `${topic.color}12`, color: topic.color }}
                          >
                            <Hash size={9} />
                            {topic.articles} статей
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <KnowledgeBaseBrowser />
              </motion.div>
            )}

            {/* ─── Legislative Radar section ───────────────── */}
            {activeSection === "radar" && (
              <motion.div
                key="radar"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                {/* Radar intro card */}
                <div
                  className="rounded-2xl p-5 relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(245,158,11,0.04) 100%)",
                    border: "1px solid rgba(239,68,68,0.12)",
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent, #EF4444, #F59E0B, transparent)" }} />
                  <div className="absolute top-2 left-2 w-4 h-4" style={{ borderTop: "2px solid rgba(239,68,68,0.4)", borderLeft: "2px solid rgba(239,68,68,0.4)", borderRadius: "2px 0 0 0" }} />
                  <div className="absolute bottom-2 right-2 w-4 h-4" style={{ borderBottom: "2px solid rgba(239,68,68,0.4)", borderRight: "2px solid rgba(239,68,68,0.4)", borderRadius: "0 0 2px 0" }} />
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(239,68,68,0.12)" }}
                    >
                      <Bell size={16} style={{ color: "#EF4444" }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                        Законодательный радар
                      </h3>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Отслеживаем изменения в ФЗ-127, разъяснения ВС РФ и практику арбитражных судов.
                        Важные изменения автоматически обновляют тесты и кейсы на платформе.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Radar items — enhanced */}
                {RADAR_ITEMS.map((item, i) => {
                  const impact = IMPACT_CONFIG[item.impact];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: PREMIUM_EASE }}
                      className="group rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${impact.color}30`;
                        e.currentTarget.style.transform = "translateX(4px)";
                        e.currentTarget.style.boxShadow = `0 4px 20px ${impact.glow}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                        e.currentTarget.style.transform = "translateX(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${impact.color}, transparent 60%)` }} />
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-1">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: impact.color, boxShadow: `0 0 8px ${impact.color}` }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                                style={{ background: impact.bg, color: impact.color }}
                              >
                                {impact.label}
                              </span>
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                                style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                              >
                                {item.type}
                              </span>
                              <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
                                {item.date}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold leading-snug mb-1" style={{ color: "var(--text-primary)" }}>
                              {item.title}
                            </h4>
                            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                              {item.summary}
                            </p>
                          </div>
                          <ExternalLink
                            size={14}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                            style={{ color: "var(--text-muted)" }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                <div className="text-center pt-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Обновления загружаются автоматически
                  </span>
                </div>
              </motion.div>
            )}

            {/* ─── AI Assistant section ──────────────────── */}
            {activeSection === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                {/* AI hero card */}
                <div
                  className="rounded-2xl p-6 relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.05) 100%)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    boxShadow: "0 0 40px rgba(16,185,129,0.08)",
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[1px]"
                    style={{ background: "linear-gradient(90deg, transparent, #10B981, #3B82F6, transparent)" }}
                  />
                  <div
                    className="absolute -top-20 right-[-10%] w-[300px] h-[300px] rounded-full opacity-[0.06] pointer-events-none"
                    style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }}
                  />

                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(16,185,129,0.15)" }}
                      >
                        <Sparkles size={15} style={{ color: "#10B981" }} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#10B981" }}>
                        AI-помощник по ФЗ-127
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-secondary)" }}>
                      Задайте вопрос — AI найдёт ответ в базе законодательства, судебной практике
                      и материалах платформы. Все ответы со ссылками на первоисточники.
                    </p>

                    {/* AI query input */}
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                        <input
                          type="text"
                          value={aiQuery}
                          onChange={(e) => setAiQuery(e.target.value)}
                          placeholder="Например: Какие основания для оспаривания сделки по ст.61.2?"
                          className="w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                          style={{
                            background: "var(--bg-tertiary)",
                            border: "1.5px solid var(--border-color)",
                            color: "var(--text-primary)",
                            outline: "none",
                            transition: "border-color 0.2s, box-shadow 0.2s",
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)";
                            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.08)";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = "var(--border-color)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        />
                      </div>
                      <button
                        className="px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        style={{ background: "#10B981", color: "#fff", boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#059669";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#10B981";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <Zap size={14} />
                        Спросить
                      </button>
                    </div>
                  </div>
                </div>

                {/* Popular questions — enhanced grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                    Популярные вопросы
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { q: "Сроки для оспаривания подозрительных сделок", category: "Сделки" },
                      { q: "Критерии определения КДЛ по ст.61.10", category: "КДЛ" },
                      { q: "Порядок включения требований в реестр", category: "Реестр" },
                      { q: "Основания для завершения конкурсного производства", category: "Процедуры" },
                      { q: "Особенности банкротства застройщиков", category: "Застройщик" },
                      { q: "Мораторий на банкротство: текущий статус", category: "Мораторий" },
                    ].map(({ q, category }) => (
                      <button
                        key={q}
                        onClick={() => setAiQuery(q)}
                        className="flex items-start gap-3 text-left rounded-xl p-3.5 transition-all text-xs group"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          backdropFilter: "blur(12px)",
                          WebkitBackdropFilter: "blur(12px)",
                          color: "var(--text-secondary)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)";
                          e.currentTarget.style.color = "var(--text-primary)";
                          e.currentTarget.style.boxShadow = "0 4px 20px rgba(16,185,129,0.08)";
                          e.currentTarget.style.transform = "translateX(2px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                          e.currentTarget.style.color = "var(--text-secondary)";
                          e.currentTarget.style.boxShadow = "none";
                          e.currentTarget.style.transform = "translateX(0)";
                        }}
                      >
                        <MessageSquare size={13} className="shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                        <div className="flex-1 min-w-0">
                          <span className="block leading-relaxed">{q}</span>
                          <span
                            className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(16,185,129,0.08)", color: "#10B981" }}
                          >
                            {category}
                          </span>
                        </div>
                        <ChevronRight
                          size={12}
                          className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: "#10B981" }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="flex items-start gap-2 rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    AI-помощник использует актуальную редакцию ФЗ-127 и базу судебных решений.
                    Ответы носят информационный характер и не являются юридической консультацией.
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AuthLayout>
  );
}
