"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Bell,
  ArrowRight,
  FileText,
  Sparkles,
  ExternalLink,
  Clock,
  Layers,
  Hash,
  Zap,
  RefreshCw,
  Tag,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { KnowledgeBaseBrowser } from "@/components/pvp/KnowledgeBaseBrowser";
import { ManyashaTab } from "@/components/knowledge/ManyashaTab";
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

interface KnowledgeStats {
  total_chunks: number;
  categories: { category: string; count: number }[];
  last_updated: string | null;
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
  const [activeSection, setActiveSection] = useState<"browse" | "radar" | "ai">("browse");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const browserRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<KnowledgeStats | null>(null);

  const [radarItems, setRadarItems] = useState<RadarItem[]>([]);
  const [radarTotal, setRadarTotal] = useState(0);
  const [radarLastUpdated, setRadarLastUpdated] = useState<string | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarCategory, setRadarCategory] = useState<string | null>(null);
  const [radarCategories, setRadarCategories] = useState<{ category: string; count: number }[]>([]);

  useEffect(() => {
    api.get<KnowledgeStats>("/knowledge-ai/stats").then(setStats).catch(() => {});
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

            {/* ─── AI: Маняша-агент (in-tab чат, серверная память) ─── */}
            {activeSection === "ai" && (
              <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <ManyashaTab
                  onOpenSource={(category) => {
                    setSelectedCategory(category);
                    setActiveSection("browse");
                    requestAnimationFrame(() => browserRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                />
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
