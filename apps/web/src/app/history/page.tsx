"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  History,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Inbox,
  BarChart3,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Trophy,
  Timer,
  Star,
  Filter,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";
import { api } from "@/lib/api";
import { scoreColor } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/categories";
import AuthLayout from "@/components/layout/AuthLayout";
import type { HistoryEntry } from "@/types";

type StatusFilter = "all" | "completed" | "active";
type TypeFilter = "all" | "training" | "story" | "quiz";
type ScoreFilter = "all" | "excellent" | "good" | "practice";

/* ── Helpers ─────────────────────────────────────────────── */

function statusConfig(status: string) {
  switch (status) {
    case "completed":
      return { label: "Завершено", icon: CheckCircle2, color: "var(--success)" };
    case "abandoned":
      return { label: "Прервано", icon: XCircle, color: "var(--danger)" };
    case "error":
      return { label: "Ошибка", icon: AlertTriangle, color: "var(--warning)" };
    default:
      return { label: "Активно", icon: Clock, color: "var(--primary)" };
  }
}

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotalTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}с`;
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${mins}м`;
  return `${mins}м`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function scoreBadge(score: number | null): { label: string; accentColor: string; bgColor: string } {
  if (score === null) return { label: "", accentColor: "var(--text-muted)", bgColor: "transparent" };
  if (score >= 80) return { label: "Отлично", accentColor: "var(--success)", bgColor: "var(--success-muted)" };
  if (score >= 60) return { label: "Хорошо", accentColor: "var(--info)", bgColor: "var(--info-muted)" };
  return { label: "Нужна практика", accentColor: "var(--warning)", bgColor: "var(--warning-muted)" };
}

/* ── Score Trend Chart (SVG, token-based) ────────────────── */

function ScoreTrendChart({ sessions }: { sessions: Array<{ score: number; date: string }> }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 700;
  const H = 180;
  const PAD_X = 40;
  const PAD_Y = 30;
  const PAD_BOTTOM = 30;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y - PAD_BOTTOM;

  const scores = sessions.map((s) => s.score);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const range = maxScore - minScore || 1;

  const points = useMemo(() => sessions.length >= 2
    ? sessions.map((s, i) => ({
        x: PAD_X + (i / (sessions.length - 1)) * chartW,
        y: PAD_Y + chartH - ((s.score - minScore) / range) * chartH,
        score: s.score,
        date: s.date,
      }))
    : [], [sessions, chartW, chartH, minScore, range]);

  const pathD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  const areaD = points.length >= 2
    ? `${pathD} L${points[points.length - 1].x},${PAD_Y + chartH} L${points[0].x},${PAD_Y + chartH} Z`
    : "";

  const areaGradientId = "score-area-gradient";

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mouseX);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    }
    setHoveredIdx(closestIdx);
  }, [points]);

  if (sessions.length < 2) return null;

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIdx(null)}>
        <defs>
          <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PAD_Y + chartH * (1 - frac);
          const val = Math.round(minScore + range * frac);
          return (
            <g key={frac}>
              <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="var(--border-color)" strokeWidth="0.5" />
              <text x={PAD_X - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-geist-mono, monospace)">{val}</text>
            </g>
          );
        })}

        <path d={areaD} fill={`url(#${areaGradientId})`} />
        <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hoveredIdx === i ? 5 : 3} fill="var(--primary)" stroke="var(--bg-primary)" strokeWidth="2" style={{ transition: "r 0.15s ease" }} />
        ))}

        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line x1={points[hoveredIdx].x} y1={PAD_Y} x2={points[hoveredIdx].x} y2={PAD_Y + chartH} stroke="var(--text-muted)" strokeWidth="0.5" strokeDasharray="3,3" />
            <rect x={points[hoveredIdx].x - 45} y={points[hoveredIdx].y - 38} width="90" height="30" rx="6" fill="var(--surface-elevated)" stroke="var(--border-color)" strokeWidth="1" />
            <text x={points[hoveredIdx].x} y={points[hoveredIdx].y - 24} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-primary)" fontFamily="var(--font-geist-mono, monospace)">{points[hoveredIdx].score} баллов</text>
            <text x={points[hoveredIdx].x} y={points[hoveredIdx].y - 13} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="inherit">{points[hoveredIdx].date}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ── Mini Sparkline ──────────────────────────────────────── */

function MiniSparkline({ values, width = 80, height = 20 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => ({ x: (i / (values.length - 1)) * width, y: height - ((v - min) / range) * (height - 4) - 2 }));
  const d = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

/* ── Circular Score ──────────────────────────────────────── */

function CircularScore({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color = scoreColor(score);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-color)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${progress} ${circumference - progress}`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.3, fontWeight: 700, color, fontFamily: "var(--font-geist-mono, monospace)", fontVariantNumeric: "tabular-nums" }}>
        {Math.round(score)}
      </div>
    </div>
  );
}

/* ── Mini Score Bars (single accent) ─────────────────────── */

function MiniScoreBars({ session }: { session: NonNullable<HistoryEntry["latest_session"]> }) {
  const bars = [
    { label: "Скрипт", value: session.score_script_adherence, max: 30 },
    { label: "Возражения", value: session.score_objection_handling, max: 25 },
    { label: "Коммуникация", value: session.score_communication, max: 20 },
    { label: "Результат", value: session.score_result, max: 10 },
  ];
  return (
    <div className="mt-2 flex gap-2">
      {bars.map((bar) => {
        const pct = bar.value !== null && bar.max > 0 ? Math.round((bar.value / bar.max) * 100) : 0;
        return (
          <div key={bar.label} className="flex-1" title={`${bar.label}: ${bar.value ?? 0}/${bar.max}`}>
            <div className="mb-0.5 flex items-center justify-between">
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{bar.label}</span>
              <span className="font-mono tabular-nums" style={{ fontSize: 10, color: "var(--text-muted)" }}>{pct}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full" style={{ background: "var(--border-color)" }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} style={{ background: "var(--primary)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Filter Chip (token, single accent) ──────────────────── */

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-[11px] transition-colors"
      style={{
        background: active ? "var(--primary-muted)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-secondary)",
        border: `1px solid ${active ? "var(--primary)" : "var(--border-color)"}`,
      }}
    >
      {label}
    </button>
  );
}

/* ── Main Page ───────────────────────────────────────────── */

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchHistory = useCallback((silent = false) => {
    if (silent) setRefreshing(true);
    api
      .get("/training/history?limit=50")
      .then(setEntries)
      .catch((err: Error) => setError(err.message || "Ошибка загрузки"))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchHistory(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchHistory]);

  /* ── Computed data ─────────────────────────────────────── */

  const latestSessions = entries.map((entry) => entry.latest_session).filter((s): s is NonNullable<typeof s> => s !== null);
  const completed = latestSessions.filter((s) => s.status === "completed");
  const avgScore = completed.length > 0 ? Math.round(completed.reduce((sum, s) => sum + (s.score_total ?? 0), 0) / completed.length) : null;
  const bestScore = completed.length > 0 ? Math.max(...completed.map((s) => s.score_total ?? 0)) : null;
  const totalTime = latestSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);

  const scoreTrendData = useMemo(() => {
    return [...completed]
      .filter((s) => s.score_total !== null)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
      .slice(-20)
      .map((s) => ({ score: s.score_total ?? 0, date: formatDate(s.started_at) }));
  }, [completed]);

  const recentScores = useMemo(() => {
    return [...completed]
      .filter((s) => s.score_total !== null)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
      .slice(-5)
      .map((s) => s.score_total ?? 0);
  }, [completed]);

  const recentCounts = useMemo(() => {
    const now = Date.now();
    const weeks: number[] = [0, 0, 0, 0, 0];
    for (const e of entries) {
      const age = now - new Date(e.sort_at).getTime();
      const weekIdx = Math.min(4, Math.floor(age / (7 * 86400000)));
      weeks[4 - weekIdx]++;
    }
    return weeks;
  }, [entries]);

  const scoreTrend = useMemo(() => {
    if (completed.length < 4) return null;
    const sorted = [...completed].filter((s) => s.score_total !== null).sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);
    const avgFirst = firstHalf.reduce((s, x) => s + (x.score_total ?? 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, x) => s + (x.score_total ?? 0), 0) / secondHalf.length;
    return Math.round(avgSecond - avgFirst);
  }, [completed]);

  const bestSessionOfWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const thisWeek = entries.filter((e) => new Date(e.sort_at).getTime() > weekAgo && e.latest_session?.status === "completed" && e.latest_session?.score_total !== null);
    if (thisWeek.length === 0) return null;
    return thisWeek.reduce((best, e) => (e.latest_session?.score_total ?? 0) > (best.latest_session?.score_total ?? 0) ? e : best);
  }, [entries]);

  /* ── Filtered + grouped ────────────────────────────────── */

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (statusFilter !== "all") {
      result = result.filter((e) => {
        const status = e.kind === "quiz" ? "completed" : e.latest_session?.status;
        if (statusFilter === "completed") return status === "completed";
        return status !== "completed";
      });
    }
    if (typeFilter !== "all") {
      result = result.filter((e) => {
        if (typeFilter === "story") return e.kind === "story";
        if (typeFilter === "quiz") return e.kind === "quiz";
        return e.kind === "session" || e.kind === "crm_client";
      });
    }
    if (scoreFilter !== "all") {
      result = result.filter((e) => {
        const score = e.avg_score ?? e.latest_session?.score_total ?? null;
        if (score === null) return scoreFilter === "practice";
        if (scoreFilter === "excellent") return score >= 80;
        if (scoreFilter === "good") return score >= 60 && score < 80;
        return score < 60;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((e) => {
        const storyName = e.story?.story_name?.toLowerCase() ?? "";
        const scenarioId = e.latest_session?.scenario_id?.toLowerCase() ?? "";
        const quizCat = e.quiz?.category?.toLowerCase() ?? "";
        return storyName.includes(q) || scenarioId.includes(q) || quizCat.includes(q);
      });
    }
    return result;
  }, [entries, statusFilter, typeFilter, scoreFilter, searchQuery]);

  const groupedEntries = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;
    const groups: { label: string; entries: HistoryEntry[] }[] = [
      { label: "Сегодня", entries: [] },
      { label: "На этой неделе", entries: [] },
      { label: "Ранее", entries: [] },
    ];
    for (const entry of filteredEntries) {
      const t = new Date(entry.sort_at).getTime();
      if (t >= todayStart) groups[0].entries.push(entry);
      else if (t >= weekStart) groups[1].entries.push(entry);
      else groups[2].entries.push(entry);
    }
    return groups.filter((g) => g.entries.length > 0);
  }, [filteredEntries]);

  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all" || scoreFilter !== "all" || searchQuery.trim() !== "";

  const comparisonData = useMemo(() => {
    if (completed.length < 2) return null;
    const sorted = [...completed].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    return { first: sorted[0], last: sorted[sorted.length - 1] };
  }, [completed]);

  const resetFilters = () => { setStatusFilter("all"); setTypeFilter("all"); setScoreFilter("all"); setSearchQuery(""); };

  const statCards = [
    { label: "Всего сессий", value: entries.length, icon: BarChart3, spark: recentCounts, trend: null as number | null },
    { label: "Средний балл", value: avgScore !== null ? avgScore : "—", icon: Sparkles, spark: recentScores, trend: scoreTrend },
    { label: "Лучший балл", value: bestScore !== null ? bestScore : "—", icon: Trophy, spark: recentScores, trend: null as number | null },
    { label: "Время обучения", value: formatTotalTime(totalTime), icon: Timer, spark: [] as number[], trend: null as number | null },
  ];

  /* ── Render ────────────────────────────────────────────── */

  return (
    <AuthLayout>
      <div className="relative min-h-screen overflow-hidden bg-page-glow">
        <AbstractBackdrop />
        <div className="app-page relative z-10 max-w-4xl">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: "easeOut" }} className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--primary-muted)", border: "1px solid var(--border-color)" }}>
              <History size={24} style={{ color: "var(--primary)" }} />
            </div>
            <div className="flex-1">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Хронология</div>
              <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color: "var(--text-primary)" }}>История</h1>
              <p className="mt-2 text-[15px]" style={{ color: "var(--text-muted)" }}>Обучение, практика и профессиональный рост — по шагам.</p>
            </div>
            {refreshing && (
              <span className="hidden items-center gap-1.5 font-mono text-[11px] sm:inline-flex" style={{ color: "var(--text-muted)" }}>
                <Loader2 size={12} className="animate-spin" /> обновляю
              </span>
            )}
          </motion.div>

          {/* ── Score trend ── */}
          {!loading && scoreTrendData.length >= 2 && (
            <Card accentTop className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={15} style={{ color: "var(--text-muted)" }} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Динамика баллов</span>
                </div>
                {scoreTrend !== null && (
                  <div className="flex items-center gap-1 font-mono text-[12px] font-semibold tabular-nums" style={{ color: scoreTrend >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {scoreTrend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {scoreTrend >= 0 ? "+" : ""}{scoreTrend} за период
                  </div>
                )}
              </div>
              <ScoreTrendChart sessions={scoreTrendData} />
            </Card>
          )}

          {/* ── Stats ── */}
          {!loading && entries.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {statCards.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label}>
                    <div className="flex items-start justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                        <Icon size={17} />
                      </span>
                      {item.trend !== null && (
                        <span className="flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums" style={{ color: item.trend >= 0 ? "var(--success)" : "var(--danger)" }}>
                          {item.trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{item.trend >= 0 ? "+" : ""}{item.trend}
                        </span>
                      )}
                    </div>
                    <div className="mt-5 font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl" style={{ color: "var(--text-primary)" }}>{item.value}</div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>{item.label}</div>
                    {item.spark.length >= 2 && <div className="mt-2"><MiniSparkline values={item.spark} /></div>}
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Filters ── */}
          {!loading && entries.length > 0 && (
            <Card className="mt-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                <Filter size={15} style={{ color: "var(--text-muted)" }} />
                <div className="flex flex-wrap gap-1.5">
                  {([["all", "Все"], ["completed", "Завершённые"], ["active", "В процессе"]] as [StatusFilter, string][]).map(([val, label]) => (
                    <FilterChip key={val} label={label} active={statusFilter === val} onClick={() => setStatusFilter(val)} />
                  ))}
                </div>
                <div className="hidden h-5 w-px sm:block" style={{ background: "var(--border-color)" }} />
                <div className="flex flex-wrap gap-1.5">
                  {([["all", "Все типы"], ["training", "Тренировки"], ["quiz", "Тесты"], ["story", "AI Story"]] as [TypeFilter, string][]).map(([val, label]) => (
                    <FilterChip key={val} label={label} active={typeFilter === val} onClick={() => setTypeFilter(val)} />
                  ))}
                </div>
                <div className="hidden h-5 w-px sm:block" style={{ background: "var(--border-color)" }} />
                <div className="flex flex-wrap gap-1.5">
                  {([["all", "Все баллы"], ["excellent", "80+"], ["good", "60–80"], ["practice", "<60"]] as [ScoreFilter, string][]).map(([val, label]) => (
                    <FilterChip key={val} label={label} active={scoreFilter === val} onClick={() => setScoreFilter(val)} />
                  ))}
                </div>
                <div className="relative w-full sm:ml-auto sm:w-auto sm:min-w-[180px] sm:flex-1">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input type="text" placeholder="Поиск по названию…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="vh-input pl-9" style={{ height: 36, fontSize: 13 }} />
                </div>
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters} className="font-mono text-[11px] transition-colors" style={{ color: "var(--text-muted)" }}>
                    Сбросить
                  </button>
                )}
              </div>
            </Card>
          )}

          {/* ── Было / Стало ── */}
          {!loading && comparisonData && (() => {
            const { first, last } = comparisonData;
            const firstScore = first.score_total ?? 0;
            const lastScore = last.score_total ?? 0;
            const diff = Math.round(lastScore - firstScore);
            const isPositive = diff > 0;
            return (
              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Было · Стало</span>
                  <span className="rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums" style={{ background: isPositive ? "var(--success-muted)" : "var(--danger-muted)", color: isPositive ? "var(--success)" : "var(--danger)" }}>
                    {isPositive ? "+" : ""}{diff} баллов
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
                  <Card>
                    <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Первая сессия</div>
                    <div className="mt-3 flex items-center gap-3">
                      <CircularScore score={firstScore} size={52} />
                      <div className="font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                        <div>{formatDate(first.started_at)}</div>
                        <div className="mt-1 tabular-nums" style={{ color: "var(--text-secondary)" }}>{formatDuration(first.duration_seconds)}</div>
                      </div>
                    </div>
                  </Card>
                  <div className="flex items-center justify-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--primary-muted)" }}>
                      <ArrowRight size={17} style={{ color: "var(--primary)" }} />
                    </span>
                  </div>
                  <Card accentTop>
                    <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--primary)" }}>Последняя сессия</div>
                    <div className="mt-3 flex items-center gap-3">
                      <CircularScore score={lastScore} size={52} />
                      <div className="font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                        <div>{formatDate(last.started_at)}</div>
                        <div className="mt-1 tabular-nums" style={{ color: "var(--text-secondary)" }}>{formatDuration(last.duration_seconds)}</div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            );
          })()}

          {/* ── Session list ── */}
          {loading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="flex items-center gap-4">
                  <div className="h-11 w-11 animate-pulse rounded-full" style={{ background: "var(--bg-tertiary)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded" style={{ background: "var(--bg-tertiary)" }} />
                    <div className="h-2.5 w-32 animate-pulse rounded" style={{ background: "var(--bg-tertiary)" }} />
                  </div>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="mt-16 flex flex-col items-center">
              <AlertTriangle size={36} style={{ color: "var(--danger)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{error}</p>
              <Button variant="ghost" size="sm" icon={<Loader2 size={14} />} onClick={() => fetchHistory()} className="mt-3">Повторить</Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="mt-16 flex flex-col items-center text-center">
              <Inbox size={36} style={{ color: "var(--text-muted)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Твоя история начнётся с первой тренировки.</p>
              <Button onClick={() => router.push("/training")} className="mt-4" iconRight={<ArrowRight size={16} />}>Начать обучение</Button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="mt-12 flex flex-col items-center text-center">
              <Search size={30} style={{ color: "var(--text-muted)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Нет сессий по выбранным фильтрам.</p>
              <button type="button" onClick={resetFilters} className="mt-2 font-mono text-[12px]" style={{ color: "var(--primary)" }}>Сбросить фильтры</button>
            </div>
          ) : (
            <div className="mt-6 space-y-7">
              {groupedEntries.map((group) => (
                <div key={group.label}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>{group.label}</span>
                    <div className="h-px flex-1" style={{ background: "var(--border-color)" }} />
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{group.entries.length}</span>
                  </div>
                  <div className="space-y-3">
                    {group.entries.map((entry, i) => {
                      // Quiz / test-map runs — compact row.
                      if (entry.kind === "quiz" && entry.quiz) {
                        const q = entry.quiz;
                        const qScore = Math.round(q.score);
                        const qTitle = q.category ? CATEGORY_LABELS[q.category] ?? q.category : "Тест по ФЗ-127";
                        return (
                          <motion.div key={q.quiz_session_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.2) }}>
                            <Card>
                              <div className="flex items-center gap-4">
                                <CircularScore score={qScore} size={48} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--primary)" }}>
                                      <GraduationCap size={12} /> Тест
                                    </span>
                                    <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{formatDate(q.completed_at)}</span>
                                  </div>
                                  <div className="mt-1.5 truncate text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{qTitle}</div>
                                  <div className="mt-1 flex items-center gap-4 font-mono text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
                                    <span>{q.correct_answers}/{q.total_questions} верно</span>
                                    <span>{qScore}%</span>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        );
                      }

                      const session = entry.latest_session;
                      if (!session) return null;
                      const st = statusConfig(session.status);
                      const Icon = st.icon;
                      const canViewResults = session.status === "completed" && session.score_total !== null;
                      const story = entry.story;
                      // Single nav target: story → its arc; session → its results. No second button.
                      const targetHref = story ? `/results/${story.id}` : `/results/${session.id}`;
                      const canOpen = canViewResults || !!story;
                      const entryScore = entry.avg_score ?? session.score_total;
                      const badge = scoreBadge(entryScore);
                      const isFeatured = !!bestSessionOfWeek && (story?.id || session.id) === (bestSessionOfWeek.story?.id || bestSessionOfWeek.latest_session?.id);

                      return (
                        <motion.div key={story?.id || session.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.2) }}>
                          <Card
                            variant={canOpen ? "interactive" : "hairline"}
                            accentTop={isFeatured}
                            role={canOpen ? "link" : undefined}
                            tabIndex={canOpen ? 0 : undefined}
                            onClick={canOpen ? () => router.push(targetHref) : undefined}
                            onKeyDown={canOpen ? (e) => { if (e.key === "Enter") router.push(targetHref); } : undefined}
                            className="group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="shrink-0">
                                {entryScore !== null ? (
                                  <CircularScore score={entryScore} size={48} />
                                ) : (
                                  <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--bg-secondary)" }}>
                                    <Icon size={20} style={{ color: st.color }} />
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {canViewResults && badge.label && (
                                    <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide" style={{ background: badge.bgColor, color: badge.accentColor }}>{badge.label}</span>
                                  )}
                                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: story ? "var(--primary)" : st.color }}>
                                    {story ? "AI Story" : st.label}
                                  </span>
                                  {isFeatured && <Star size={13} style={{ color: "var(--warning)" }} />}
                                  <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{formatDate(session.started_at)}</span>
                                </div>

                                <div className="mt-1.5 truncate text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                                  {story ? story.story_name : (session.scenario_id || "Тренировка")}
                                </div>

                                <div className="mt-1 flex items-center gap-4 font-mono text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
                                  <span className="flex items-center gap-1"><Clock size={12} />{formatDuration(session.duration_seconds)}</span>
                                  {story && <span>{story.completed_calls}/{story.total_calls_planned} звонков</span>}
                                </div>

                                {canViewResults && <MiniScoreBars session={session} />}

                                {story && (
                                  <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                                    <span>Статус: {story.game_status}</span>
                                    <span>Факторов: {story.active_factors.length}</span>
                                  </div>
                                )}
                              </div>

                              {canOpen && <ArrowRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--text-muted)" }} />}
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
