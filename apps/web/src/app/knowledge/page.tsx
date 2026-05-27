"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { KnowledgeBaseBrowser } from "@/components/pvp/KnowledgeBaseBrowser";

/* ── Legislative Radar mock data ────────────────── */
const RADAR_ITEMS = [
  {
    date: "15.05.2026",
    title: "Постановление Пленума ВС РФ о применении норм субсидиарной ответственности",
    type: "ВС РФ",
    impact: "high" as const,
  },
  {
    date: "08.05.2026",
    title: "Изменения в ст.61.2 ФЗ-127: новые критерии подозрительных сделок",
    type: "ФЗ-127",
    impact: "high" as const,
  },
  {
    date: "01.05.2026",
    title: "Разъяснения ФНС о порядке включения налоговых требований в реестр",
    type: "ФНС",
    impact: "medium" as const,
  },
  {
    date: "22.04.2026",
    title: "Обзор судебной практики: оспаривание результатов торгов",
    type: "Практика",
    impact: "low" as const,
  },
];

const IMPACT_CONFIG = {
  high: { label: "Важно", color: "#EF4444", bg: "rgba(239,68,68,0.08)" },
  medium: { label: "Значимо", color: "#F59E0B", bg: "rgba(245,158,11,0.08)" },
  low: { label: "К сведению", color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
};

/* ── Quick reference topics ───────────────────────── */
const QUICK_TOPICS = [
  { title: "Процедуры банкротства", articles: 45, icon: "📋" },
  { title: "Оспаривание сделок", articles: 32, icon: "⚖️" },
  { title: "Субсидиарная ответственность", articles: 28, icon: "🎯" },
  { title: "Торги и реализация", articles: 24, icon: "🔨" },
  { title: "Банкротство физлиц", articles: 36, icon: "👤" },
  { title: "Работа с кредиторами", articles: 22, icon: "👥" },
];

export default function KnowledgePage() {
  const [aiQuery, setAiQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"browse" | "radar" | "ai">("browse");

  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-32 right-[10%] w-[500px] h-[500px] rounded-full opacity-[0.03]"
            style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-[60%] -left-20 w-[350px] h-[350px] rounded-full opacity-[0.025]"
            style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8"
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(16,185,129,0.12)",
                  boxShadow: "0 0 0 1px rgba(16,185,129,0.2)",
                }}
              >
                <BookOpen size={22} style={{ color: "#10B981" }} />
              </div>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  База знаний
                </h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                  ФЗ-127, судебная практика, AI-помощник
                </p>
              </div>
            </div>
          </motion.div>

          {/* Section tabs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.04 }}
            className="mb-6 flex gap-2"
          >
            {[
              { id: "browse" as const, label: "Справочник", icon: BookOpen },
              { id: "radar" as const, label: "Законодательный радар", icon: Bell },
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
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </motion.div>

          {/* Browse section */}
          {activeSection === "browse" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Quick topic cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {QUICK_TOPICS.map((topic, i) => (
                  <motion.div
                    key={topic.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="group rounded-xl p-4 cursor-pointer transition-all duration-200"
                    style={{
                      background: "var(--surface-card)",
                      border: "1px solid var(--border-color)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-color)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <span className="text-xl mb-2 block">{topic.icon}</span>
                    <h4 className="text-xs font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                      {topic.title}
                    </h4>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {topic.articles} статей
                      </span>
                      <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#10B981" }} />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Existing browser */}
              <KnowledgeBaseBrowser />
            </motion.div>
          )}

          {/* Legislative Radar section */}
          {activeSection === "radar" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              {/* Radar intro */}
              <div
                className="rounded-xl p-5 flex items-start gap-3"
                style={{
                  background: "linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(245,158,11,0.04) 100%)",
                  border: "1px solid rgba(239,68,68,0.12)",
                }}
              >
                <Bell size={18} style={{ color: "#EF4444" }} className="shrink-0 mt-0.5" />
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

              {/* Radar items */}
              {RADAR_ITEMS.map((item, i) => {
                const impact = IMPACT_CONFIG[item.impact];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                    className="group rounded-xl p-4 cursor-pointer transition-all duration-200"
                    style={{
                      background: "var(--surface-card)",
                      border: "1px solid var(--border-color)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `${impact.color}30`;
                      e.currentTarget.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-color)";
                      e.currentTarget.style.transform = "translateX(0)";
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: impact.color }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
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
                        <h4 className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                          {item.title}
                        </h4>
                      </div>
                      <ExternalLink size={14} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1" style={{ color: "var(--text-muted)" }} />
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

          {/* AI Assistant section */}
          {activeSection === "ai" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              {/* AI intro */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(37,99,235,0.04) 100%)",
                  border: "1px solid rgba(16,185,129,0.12)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} style={{ color: "#10B981" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#10B981" }}>
                    AI-помощник по ФЗ-127
                  </span>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
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
                        border: "1px solid var(--border-color)",
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; }}
                    />
                  </div>
                  <button
                    className="px-5 py-3 rounded-xl text-sm font-bold transition-all"
                    style={{
                      background: "#10B981",
                      color: "#fff",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#059669";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#10B981";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    Спросить
                  </button>
                </div>
              </div>

              {/* Example questions */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Популярные вопросы
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    "Сроки для оспаривания подозрительных сделок",
                    "Критерии определения КДЛ по ст.61.10",
                    "Порядок включения требований в реестр",
                    "Основания для завершения конкурсного производства",
                    "Особенности банкротства застройщиков",
                    "Мораторий на банкротство: текущий статус",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setAiQuery(q)}
                      className="flex items-center gap-2 text-left rounded-xl p-3 transition-all text-xs"
                      style={{
                        background: "var(--surface-card)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-secondary)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)";
                        e.currentTarget.style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-color)";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }}
                    >
                      <MessageSquare size={12} className="shrink-0" style={{ color: "#10B981" }} />
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: "var(--bg-tertiary)" }}>
                <AlertTriangle size={12} className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                <span className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  AI-помощник использует актуальную редакцию ФЗ-127 и базу судебных решений.
                  Ответы носят информационный характер и не являются юридической консультацией.
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
