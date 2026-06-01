"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { KnowledgeBaseBrowser } from "@/components/pvp/KnowledgeBaseBrowser";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";

const QUICK_TOPICS = [
  { title: "Процедуры банкротства", icon: "📋", description: "Наблюдение, реструктуризация, конкурсное производство", category: "procedure" },
  { title: "Оспаривание сделок", icon: "⚖️", description: "Ст. 61.2, ст. 61.3 — подозрительные и преференциальные", category: "property" },
  { title: "Субсидиарная ответственность", icon: "🎯", description: "КДЛ, доказывание, размер ответственности", category: "consequences" },
  { title: "Торги и реализация", icon: "🔨", description: "Порядок проведения, оспаривание результатов", category: "costs" },
  { title: "Банкротство физлиц", icon: "👤", description: "Процедура, ограничения, списание долгов", category: "eligibility" },
  { title: "Работа с кредиторами", icon: "👥", description: "Реестр, собрания, голосование, очерёдность", category: "creditors" },
];

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

// Semantic, token-based — restrained labels, no glow / no fill / no rainbow.
function impactMeta(level: "high" | "medium" | "low"): { label: string; color: string } {
  if (level === "high") return { label: "Важно", color: "var(--danger)" };
  if (level === "medium") return { label: "Значимо", color: "var(--warning)" };
  return { label: "К сведению", color: "var(--text-muted)" };
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return "менее часа назад";
  if (diffHours < 24) return `${diffHours} ч. назад`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return date.toLocaleDateString("ru-RU");
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ── Eyebrow — quiet in-content label + hairline ── */
function Eyebrow({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <Icon size={13} style={{ color: "var(--text-muted)" }} />
      <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div className="h-px flex-1" style={{ background: "var(--border-color)" }} />
    </div>
  );
}

export default function KnowledgePage() {
  const [aiQuery, setAiQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"browse" | "radar" | "ai">("browse");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const browserRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiHistory, setAiHistory] = useState<HistoryEntry[]>([]);

  const [radarItems, setRadarItems] = useState<RadarItem[]>([]);
  const [radarTotal, setRadarTotal] = useState(0);
  const [radarLastUpdated, setRadarLastUpdated] = useState<string | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarCategory, setRadarCategory] = useState<string | null>(null);
  const [radarCategories, setRadarCategories] = useState<{ category: string; count: number }[]>([]);

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
    setAiError(null);

    try {
      const result = await api.post<AiResponse>("/knowledge-ai/ask", { question: q });
      setAiResult(result);
      const entry: HistoryEntry = { question: q, answer: result.answer, sources: result.sources, timestamp: Date.now() };
      saveHistory([entry, ...aiHistory]);
    } catch {
      // Отдельное error-состояние, а не «зелёная карточка ответа» с текстом ошибки.
      setAiError("Не удалось обработать запрос. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setAiLoading(false);
    }
  }, [aiQuery, aiLoading, aiHistory, saveHistory]);

  // История: восстанавливаем закэшированный ответ, без повторного сетевого запроса.
  const restoreFromHistory = useCallback((entry: HistoryEntry) => {
    setAiQuery(entry.question);
    setAiError(null);
    setAiResult({ answer: entry.answer, sources: entry.sources, model: "", retrieval_ms: 0, generation_ms: 0, total_ms: 0 });
  }, []);

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

  const openTopic = (category: string) => {
    // Фильтруем справочник напрямую (надёжно, без URL+remount-гонки) и
    // переводим взгляд к нему — клик действительно работает.
    setSelectedCategory((prev) => (prev === category ? "" : category));
    requestAnimationFrame(() => browserRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const statsDisplay = [
    { label: "Статей в базе", value: stats ? String(stats.total_chunks) : "—", icon: FileText },
    { label: "Категорий", value: stats ? String(stats.categories.length) : "—", icon: Layers },
    { label: "Обновлено", value: stats?.last_updated ? formatRelativeTime(stats.last_updated) : "—", icon: Zap },
  ];

  const tabs = [
    { id: "browse" as const, label: "Справочник", icon: BookOpen },
    { id: "radar" as const, label: "Радар", icon: Bell },
    { id: "ai" as const, label: "AI-помощник", icon: Sparkles },
  ];

  return (
    <AuthLayout>
      <div className="relative min-h-screen overflow-hidden bg-page-glow">
        <AbstractBackdrop />
        <div className="relative z-10 mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-12">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: "easeOut" }} className="mb-10">
            <div className="flex items-center gap-5">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: "var(--primary-muted)", border: "1px solid var(--border-color)" }}
              >
                <BookOpen size={24} style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>База · ФЗ-127</div>
                <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color: "var(--text-primary)" }}>База знаний</h1>
                <p className="mt-2 text-[15px]" style={{ color: "var(--text-muted)" }}>Закон, судебная практика, радар изменений и AI-помощник.</p>
              </div>
            </div>
          </motion.div>

          {/* ── Stats ── */}
          <div className="mb-10 grid grid-cols-3 gap-3 sm:gap-4">
            {statsDisplay.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                    <Icon size={16} />
                  </span>
                  <div className="mt-5 font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl" style={{ color: "var(--text-primary)" }}>{stat.value}</div>
                  <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>{stat.label}</div>
                </Card>
              );
            })}
          </div>

          {/* ── Tabs (hairline underline) ── */}
          <div className="mb-8 flex gap-1 border-b" style={{ borderColor: "var(--border-color)" }}>
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className="relative -mb-px flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
                  style={{ color: isActive ? "var(--text-primary)" : "var(--text-muted)" }}
                >
                  <TabIcon size={15} />
                  {tab.label}
                  {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: "var(--primary)" }} />}
                </button>
              );
            })}
          </div>

          {/* ── Content ── */}
          <AnimatePresence mode="wait">
            {/* ─── Browse ─── */}
            {activeSection === "browse" && (
              <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <Eyebrow icon={BookOpen} label="Быстрые темы" />
                <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                  {QUICK_TOPICS.map((topic) => {
                    const active = selectedCategory === topic.category;
                    return (
                    <Card key={topic.title} variant="interactive" accentTop={active} role="button" tabIndex={0}
                      aria-pressed={active}
                      onClick={() => openTopic(topic.category)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTopic(topic.category); } }}
                      className="group"
                      style={{ height: "100%", borderColor: active ? "var(--primary)" : "var(--border-color)", background: active ? "var(--primary-muted)" : "var(--surface-card)" }}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <span className="text-2xl leading-none">{topic.icon}</span>
                        <ArrowRight size={14} className={`transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} style={{ color: "var(--primary)" }} />
                      </div>
                      <h4 className="text-[15px] font-semibold leading-snug tracking-tight" style={{ color: "var(--text-primary)" }}>{topic.title}</h4>
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{topic.description}</p>
                      <div className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        <Hash size={10} />
                        {stats?.categories.find((c) => c.category === topic.category)?.count ?? "—"} статей
                      </div>
                    </Card>
                    );
                  })}
                </div>

                <div ref={browserRef}>
                  <KnowledgeBaseBrowser initialCategory={selectedCategory} />
                </div>
              </motion.div>
            )}

            {/* ─── Radar ─── */}
            {activeSection === "radar" && (
              <motion.div key="radar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                {/* Radar header */}
                <Card accentTop>
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>
                      <Bell size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Законодательный радар</h3>
                        <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5" style={{ background: "var(--primary-muted)" }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />
                          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--primary)" }}>live</span>
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Изменения в ФЗ-127, разъяснения ВС РФ и практика арбитражных судов.
                      </p>
                      {radarLastUpdated && (
                        <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <Clock size={11} /> Обновлено {formatRelativeTime(radarLastUpdated)}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" loading={radarLoading} icon={<RefreshCw size={15} />} onClick={() => loadRadar(radarCategory)} aria-label="Обновить" />
                  </div>
                </Card>

                {/* Category filters */}
                {radarCategories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={!radarCategory} onClick={() => setRadarCategory(null)}>Все · {radarTotal}</FilterChip>
                    {radarCategories.map((cat) => (
                      <FilterChip key={cat.category} active={radarCategory === cat.category} onClick={() => setRadarCategory(cat.category)}>
                        {cat.category} · {cat.count}
                      </FilterChip>
                    ))}
                  </div>
                )}

                {/* Loading */}
                {radarLoading && radarItems.length === 0 && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Card key={i}>
                        <div className="h-3 w-3/4 animate-pulse rounded" style={{ background: "var(--bg-tertiary)" }} />
                        <div className="mt-3 h-2 w-1/2 animate-pulse rounded" style={{ background: "var(--bg-tertiary)" }} />
                      </Card>
                    ))}
                  </div>
                )}

                {/* Items */}
                {radarItems.map((item) => {
                  const impact = impactMeta(getImpactLevel(item.relevance_score));
                  const openSource = item.source_url
                    ? () => window.open(item.source_url!, "_blank", "noopener,noreferrer")
                    : undefined;
                  return (
                    <Card
                      key={item.id}
                      variant={openSource ? "interactive" : "hairline"}
                      role={openSource ? "link" : undefined}
                      tabIndex={openSource ? 0 : undefined}
                      onClick={openSource}
                      onKeyDown={openSource ? (e) => { if (e.key === "Enter") openSource(); } : undefined}
                      className="group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: impact.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: impact.color }}>{impact.label}</span>
                            <span className="font-mono text-[11px]" style={{ color: "var(--text-secondary)" }}>{item.category}</span>
                            <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{item.source}</span>
                            <span className="ml-auto font-mono text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{formatDate(item.published_at)}</span>
                          </div>
                          <h4 className="text-[15px] font-semibold leading-snug tracking-tight" style={{ color: "var(--text-primary)" }}>{item.title}</h4>
                          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.summary}</p>
                          {item.tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {item.tags.map((tag) => (
                                <span key={tag} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px]" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                                  <Tag size={9} /> {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {openSource && (
                          <ExternalLink size={15} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--text-muted)" }} aria-hidden />
                        )}
                      </div>
                    </Card>
                  );
                })}

                {/* Empty */}
                {!radarLoading && radarItems.length === 0 && (
                  <Card padded={false}>
                    <EmptyState
                      icon={Bell}
                      title="Пока тихо"
                      description="Новые изменения в законодательстве появятся здесь автоматически."
                      hint="Радар обновляется каждые 12 часов"
                    />
                  </Card>
                )}
              </motion.div>
            )}

            {/* ─── AI ─── */}
            {activeSection === "ai" && (
              <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                {/* Ask */}
                <Card accentTop>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>
                      <Sparkles size={18} />
                    </span>
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>AI-помощник</div>
                      <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>Отвечает по закону и судебной практике — со ссылками на источники.</div>
                    </div>
                  </div>

                  <form className="mt-5" onSubmit={(e) => { e.preventDefault(); handleAsk(); }}>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative flex-1">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                        <input
                          type="text"
                          value={aiQuery}
                          onChange={(e) => setAiQuery(e.target.value)}
                          placeholder="Например: основания оспаривания сделки по ст. 61.2?"
                          disabled={aiLoading}
                          className="vh-input pl-10"
                        />
                      </div>
                      <Button type="submit" variant="primary" loading={aiLoading} disabled={!aiQuery.trim()} icon={<ArrowRight size={16} />} className="shrink-0">
                        Спросить
                      </Button>
                    </div>
                  </form>
                </Card>

                {/* Loading */}
                {aiLoading && (
                  <Card>
                    <div className="mb-3 flex items-center gap-2.5">
                      <Loader2 size={15} className="animate-spin" style={{ color: "var(--primary)" }} />
                      <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Ищу в базе знаний…</span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="h-3 w-full animate-pulse rounded" style={{ background: "var(--bg-tertiary)" }} />
                      <div className="h-3 w-5/6 animate-pulse rounded" style={{ background: "var(--bg-tertiary)" }} />
                      <div className="h-3 w-4/6 animate-pulse rounded" style={{ background: "var(--bg-tertiary)" }} />
                    </div>
                  </Card>
                )}

                {/* Error — distinct from an answer */}
                {aiError && !aiLoading && (
                  <Card style={{ borderColor: "var(--danger)" }}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--danger)" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{aiError}</p>
                        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => handleAsk(aiQuery)} className="mt-3">Повторить</Button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Result */}
                {aiResult && !aiLoading && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-4">
                    <Card accentTop>
                      <div className="mb-4 flex items-center gap-2.5">
                        <Sparkles size={14} style={{ color: "var(--primary)" }} />
                        <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Ответ</span>
                        {aiResult.total_ms > 0 && (
                          <span className="ml-auto font-mono text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{(aiResult.total_ms / 1000).toFixed(1)} с</span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{aiResult.answer}</div>
                    </Card>

                    {aiResult.sources.length > 0 && (
                      <div>
                        <Eyebrow icon={FileText} label={`Источники · ${aiResult.sources.length}`} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          {aiResult.sources.map((src, idx) => (
                            <Card key={idx}>
                              <div className="mb-2 flex items-center gap-2">
                                <span className="font-mono text-[11px] font-semibold" style={{ color: "var(--primary)" }}>{src.category}</span>
                                {src.is_court_practice && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
                                    <Scale size={10} /> Суд
                                  </span>
                                )}
                                <span className="ml-auto font-mono text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{Math.round(src.relevance * 100)}%</span>
                              </div>
                              {src.law_article && <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{src.law_article}</div>}
                              {src.court_case && <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>{src.court_case}</div>}
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Popular questions */}
                {!aiResult && !aiLoading && !aiError && (
                  <div>
                    <Eyebrow icon={MessageSquare} label="Популярные вопросы" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {POPULAR_QUESTIONS.map(({ q, category }) => (
                        <Card key={q} variant="interactive" role="button" tabIndex={0}
                          onClick={() => { setAiQuery(q); handleAsk(q); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAiQuery(q); handleAsk(q); } }}
                          className="group"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>
                              <MessageSquare size={14} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-relaxed" style={{ color: "var(--text-primary)" }}>{q}</span>
                              <span className="mt-1.5 inline-block font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{category}</span>
                            </div>
                            <ChevronRight size={14} className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--primary)" }} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* History */}
                {aiHistory.length > 0 && !aiLoading && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex flex-1 items-center gap-2.5">
                        <Clock size={13} style={{ color: "var(--text-muted)" }} />
                        <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>История вопросов</span>
                        <div className="h-px flex-1" style={{ background: "var(--border-color)" }} />
                      </div>
                      <button
                        onClick={() => { setAiHistory([]); try { sessionStorage.removeItem("knowledge_ai_history"); } catch {} }}
                        className="ml-3 font-mono text-[11px] transition-colors"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Очистить
                      </button>
                    </div>
                    <div className="space-y-2">
                      {aiHistory.slice(0, 5).map((entry, idx) => (
                        <button
                          key={idx}
                          onClick={() => restoreFromHistory(entry)}
                          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                          style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}
                        >
                          <MessageSquare size={13} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                          <span className="flex-1 truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>{entry.question}</span>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                            {new Date(entry.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="flex items-start gap-3 pt-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Ответы основаны на актуальной редакции ФЗ-127 и базе судебных решений. Носят информационный характер и не являются юридической консультацией.
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

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 font-mono text-[11px] transition-colors"
      style={{
        background: active ? "var(--primary-muted)" : "transparent",
        border: `1px solid ${active ? "var(--primary)" : "var(--border-color)"}`,
        color: active ? "var(--primary)" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}
