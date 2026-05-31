"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, History, Search } from "lucide-react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Warning,
  Tray,
  ChartBar,
  Sparkle,
  TrendUp,
  TrendDown,
  Trophy,
  Timer,
  Star,
  FunnelSimple,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { scoreColor } from "@/lib/utils";
import AuthLayout from "@/components/layout/AuthLayout";
import type { HistoryEntry } from "@/types";

/* ── Constants ──────────────────────────────────────────── */

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;
const HISTORY_SCHEME_SVG = `url("data:image/svg+xml,%3Csvg width='640' height='420' viewBox='0 0 640 420' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2385f7e8' stroke-width='1' stroke-opacity='.12'%3E%3Cpath d='M42 74h98v64h118v72h126v88h188'/%3E%3Cpath d='M96 330h104v-68h114v-76h116v-92h128'/%3E%3Cpath d='M180 42v96m166-72v120m112 132v74'/%3E%3Ccircle cx='140' cy='138' r='4'/%3E%3Ccircle cx='258' cy='210' r='4'/%3E%3Ccircle cx='384' cy='298' r='4'/%3E%3Ccircle cx='430' cy='186' r='4'/%3E%3C/g%3E%3Cg fill='%23a78bfa' fill-opacity='.08'%3E%3Crect x='72' y='302' width='8' height='8' rx='2'/%3E%3Crect x='552' y='90' width='8' height='8' rx='2'/%3E%3Crect x='336' y='60' width='8' height='8' rx='2'/%3E%3C/g%3E%3C/svg%3E")`;
const HISTORY_BACKGROUND = `
  linear-gradient(135deg, rgba(7, 13, 35, 0.98) 0%, rgba(24, 18, 62, 0.96) 34%, rgba(9, 68, 92, 0.88) 58%, rgba(16, 103, 88, 0.76) 78%, rgba(72, 29, 97, 0.92) 100%),
  linear-gradient(55deg, rgba(59,130,246,0.12), transparent 30%, rgba(45,212,191,0.1) 58%, rgba(236,72,153,0.1))
`;

type StatusFilter = "all" | "completed" | "active";
type TypeFilter = "all" | "training" | "story";
type ScoreFilter = "all" | "excellent" | "good" | "practice";

/* ── Helpers ─────────────────────────────────────────────── */

function statusConfig(status: string) {
  switch (status) {
    case "completed":
      return { label: "Завершено", icon: CheckCircle, color: "var(--success)" };
    case "abandoned":
      return { label: "Прервано", icon: XCircle, color: "var(--danger)" };
    case "error":
      return { label: "Ошибка", icon: Warning, color: "var(--warning)" };
    default:
      return { label: "Активно", icon: Clock, color: "var(--accent)" };
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

/* ── Score Trend Chart (SVG) ─────────────────────────────── */

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

  const firstScore = scores[0] ?? 0;
  const lastScore = scores[scores.length - 1] ?? 0;
  const isUptrend = lastScore >= firstScore;

  const gradientId = "score-gradient";
  const areaGradientId = "score-area-gradient";
  const lineColor = isUptrend ? "var(--success)" : "var(--danger)";

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
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    setHoveredIdx(closestIdx);
  }, [points]);

  if (sessions.length < 2) return null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={isUptrend ? "var(--success)" : "var(--danger)"} />
            <stop offset="100%" stopColor={isUptrend ? "var(--success)" : "var(--danger)"} />
          </linearGradient>
          <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PAD_Y + chartH * (1 - frac);
          const val = Math.round(minScore + range * frac);
          return (
            <g key={frac}>
              <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="var(--border-color)" strokeWidth="0.5" />
              <text x={PAD_X - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)" fontFamily="inherit">{val}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={`url(#${areaGradientId})`} />

        {/* Line */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 5 : 3}
            fill={lineColor}
            stroke="var(--bg-primary)"
            strokeWidth="2"
            style={{ transition: "r 0.15s ease" }}
          />
        ))}

        {/* Hover tooltip */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line
              x1={points[hoveredIdx].x}
              y1={PAD_Y}
              x2={points[hoveredIdx].x}
              y2={PAD_Y + chartH}
              stroke="var(--text-muted)"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
            <rect
              x={points[hoveredIdx].x - 45}
              y={points[hoveredIdx].y - 38}
              width="90"
              height="30"
              rx="6"
              fill="var(--surface-elevated)"
              stroke="var(--border-color)"
              strokeWidth="1"
            />
            <text
              x={points[hoveredIdx].x}
              y={points[hoveredIdx].y - 24}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="var(--text-primary)"
              fontFamily="inherit"
            >
              {points[hoveredIdx].score} баллов
            </text>
            <text
              x={points[hoveredIdx].x}
              y={points[hoveredIdx].y - 13}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-muted)"
              fontFamily="inherit"
            >
              {points[hoveredIdx].date}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ── Mini Sparkline ──────────────────────────────────────── */

function MiniSparkline({ values, color, width = 60, height = 24 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const d = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--input-bg)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference - progress}`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.3,
          fontWeight: 700,
          color,
          fontFamily: "var(--font-display, inherit)",
        }}
      >
        {Math.round(score)}
      </div>
    </div>
  );
}

/* ── Mini Score Bars ─────────────────────────────────────── */

function MiniScoreBars({ session }: { session: HistoryEntry["latest_session"] }) {
  const bars = [
    { label: "Скрипт", value: session.score_script_adherence, max: 30, color: "var(--accent)" },
    { label: "Возражения", value: session.score_objection_handling, max: 25, color: "var(--magenta)" },
    { label: "Коммуникация", value: session.score_communication, max: 20, color: "var(--info)" },
    { label: "Результат", value: session.score_result, max: 10, color: "var(--success)" },
  ];

  return (
    <div className="flex gap-2 mt-2">
      {bars.map((bar) => {
        const pct = bar.value !== null && bar.max > 0 ? Math.round((bar.value / bar.max) * 100) : 0;
        return (
          <div key={bar.label} className="flex-1" title={`${bar.label}: ${bar.value ?? 0}/${bar.max}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600 }}>{bar.label}</span>
              <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace" }}>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--input-bg)" }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ background: bar.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Filter Chip ─────────────────────────────────────────── */

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
      style={{
        background: active
          ? "linear-gradient(135deg, var(--accent), var(--magenta))"
          : "var(--input-bg)",
        color: active ? "#fff" : "var(--text-secondary)",
        border: active ? "1px solid transparent" : "1px solid var(--border-color)",
        boxShadow: active ? "0 2px 8px rgba(59,130,246,0.25)" : "none",
      }}
    >
      {label}
    </button>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const PREMIUM_STYLES = `
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.history-card {
  transition: box-shadow 0.3s ease, transform 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}
.history-card:hover {
  box-shadow: 0 0 24px rgba(168,85,247,0.1), 0 0 48px rgba(59,130,246,0.06), 0 12px 36px rgba(0,0,0,0.4) !important;
  border-color: rgba(139, 92, 246, 0.25) !important;
  transform: translateY(-3px);
}
.stat-card {
  transition: box-shadow 0.3s ease, transform 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}
.stat-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(59,130,246,0.08) !important;
  border-color: rgba(59, 130, 246, 0.2) !important;
}
.featured-card {
  background: linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(15,15,30,0.98) 100%) !important;
  border-color: rgba(74,222,128,0.25) !important;
  box-shadow: 0 0 30px rgba(74,222,128,0.08), 0 8px 32px rgba(0,0,0,0.4) !important;
}
.featured-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(74,222,128,0.06), transparent 60%);
  pointer-events: none;
}
`;

/* ── Main Page ───────────────────────────────────────────── */

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchHistory = () => {
    api
      .get("/training/history?limit=50")
      .then(setEntries)
      .catch((err: Error) => setError(err.message || "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchHistory();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  /* ── Computed data ─────────────────────────────────────── */

  const latestSessions = entries.map((entry) => entry.latest_session);
  const completed = latestSessions.filter((s) => s.status === "completed");

  const avgScore = completed.length > 0
    ? Math.round(completed.reduce((sum, s) => sum + (s.score_total ?? 0), 0) / completed.length)
    : null;

  const bestScore = completed.length > 0
    ? Math.max(...completed.map((s) => s.score_total ?? 0))
    : null;

  const totalTime = latestSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);

  // Score trend data for chart (last 20 completed sessions, oldest first)
  const scoreTrendData = useMemo(() => {
    const sorted = [...completed]
      .filter((s) => s.score_total !== null)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
      .slice(-20);
    return sorted.map((s) => ({
      score: s.score_total ?? 0,
      date: formatDate(s.started_at),
    }));
  }, [completed]);

  // Recent scores for stat sparklines
  const recentScores = useMemo(() => {
    return [...completed]
      .filter((s) => s.score_total !== null)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
      .slice(-5)
      .map((s) => s.score_total ?? 0);
  }, [completed]);

  const recentCounts = useMemo(() => {
    // last 5 weeks session counts
    const now = Date.now();
    const weeks: number[] = [0, 0, 0, 0, 0];
    for (const e of entries) {
      const age = now - new Date(e.sort_at).getTime();
      const weekIdx = Math.min(4, Math.floor(age / (7 * 86400000)));
      weeks[4 - weekIdx]++;
    }
    return weeks;
  }, [entries]);

  // Trend vs first half
  const scoreTrend = useMemo(() => {
    if (completed.length < 4) return null;
    const sorted = [...completed]
      .filter((s) => s.score_total !== null)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);
    const avgFirst = firstHalf.reduce((s, x) => s + (x.score_total ?? 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, x) => s + (x.score_total ?? 0), 0) / secondHalf.length;
    return Math.round(avgSecond - avgFirst);
  }, [completed]);

  // Best session of the week
  const bestSessionOfWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const thisWeek = entries.filter(
      (e) => new Date(e.sort_at).getTime() > weekAgo && e.latest_session.status === "completed" && e.latest_session.score_total !== null
    );
    if (thisWeek.length === 0) return null;
    return thisWeek.reduce((best, e) =>
      (e.latest_session.score_total ?? 0) > (best.latest_session.score_total ?? 0) ? e : best
    );
  }, [entries]);

  /* ── Filtered entries ──────────────────────────────────── */

  const filteredEntries = useMemo(() => {
    let result = entries;

    if (statusFilter !== "all") {
      result = result.filter((e) => {
        if (statusFilter === "completed") return e.latest_session.status === "completed";
        return e.latest_session.status !== "completed";
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((e) => {
        if (typeFilter === "story") return e.kind === "story";
        return e.kind === "session";
      });
    }

    if (scoreFilter !== "all") {
      result = result.filter((e) => {
        const score = e.avg_score ?? e.latest_session.score_total;
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
        const scenarioId = e.latest_session.scenario_id?.toLowerCase() ?? "";
        return storyName.includes(q) || scenarioId.includes(q);
      });
    }

    return result;
  }, [entries, statusFilter, typeFilter, scoreFilter, searchQuery]);

  // Group filtered entries by date
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

  /* ── Было / Стало data ─────────────────────────────────── */

  const comparisonData = useMemo(() => {
    if (completed.length < 2) return null;
    const sorted = [...completed].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return { first, last };
  }, [completed]);

  /* ── Render ────────────────────────────────────────────── */

  return (
    <AuthLayout>
      <style dangerouslySetInnerHTML={{ __html: PREMIUM_STYLES }} />
      <div className="relative min-h-screen" style={{ background: "var(--bg-primary)" }}>
        {/* Noise overlay */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: NOISE_SVG,
            backgroundRepeat: "repeat",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div className="app-page max-w-4xl" style={{ position: "relative", zIndex: 1 }}>

          {/* ═══ Section 1: Header + Score Trend ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--primary-muted)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <History size={24} style={{ color: "var(--brand-logo-hunter)" }} />
            </div>
            <div>
              <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-0.07em]" style={{ color: "var(--text-primary)" }}>
                История
              </h1>
              <p className="mt-2 text-lg font-medium" style={{ color: "var(--brand-logo-hunter)" }}>
                Хронология обучения, практики и профессионального роста
              </p>
            </div>
          </motion.div>

          {/* Score Trend Chart */}
          {!loading && scoreTrendData.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-6 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(15, 15, 30, 0.95)",
                border: "1px solid rgba(37, 99, 235, 0.12)",
                boxShadow: "0 8px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(37, 99, 235, 0.06)",
              }}
            >
              <div className="p-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChartBar size={16} weight="duotone" style={{ color: "var(--accent)" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Динамика баллов
                  </span>
                </div>
                {scoreTrend !== null && (
                  <div className="flex items-center gap-1">
                    {scoreTrend >= 0
                      ? <TrendUp size={14} weight="bold" style={{ color: "var(--success)" }} />
                      : <TrendDown size={14} weight="bold" style={{ color: "var(--danger)" }} />
                    }
                    <span
                      className="text-xs font-bold"
                      style={{ color: scoreTrend >= 0 ? "var(--success)" : "var(--danger)" }}
                    >
                      {scoreTrend >= 0 ? "+" : ""}{scoreTrend} за период
                    </span>
                  </div>
                )}
              </div>
              <div className="px-2 pb-3">
                <ScoreTrendChart sessions={scoreTrendData} />
              </div>
            </motion.div>
          )}

          {/* ═══ Section 2: Enhanced Stats Row ═══ */}
          {!loading && entries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"
            >
              {[
                {
                  label: "Всего сессий",
                  value: entries.length,
                  icon: ChartBar,
                  color: "var(--accent)",
                  sparkValues: recentCounts,
                  trend: null as number | null,
                },
                {
                  label: "Средний балл",
                  value: avgScore !== null ? avgScore : "—",
                  icon: Sparkle,
                  color: "var(--warning)",
                  sparkValues: recentScores,
                  trend: scoreTrend,
                },
                {
                  label: "Лучший балл",
                  value: bestScore !== null ? bestScore : "—",
                  icon: Trophy,
                  color: "var(--success)",
                  sparkValues: recentScores,
                  trend: null as number | null,
                },
                {
                  label: "Время обучения",
                  value: formatTotalTime(totalTime),
                  icon: Timer,
                  color: "var(--magenta)",
                  sparkValues: [] as number[],
                  trend: null as number | null,
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.04 }}
                    className="stat-card rounded-2xl p-5 relative overflow-hidden"
                    style={{
                      background: "rgba(15, 15, 30, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    {/* Color accent overlay */}
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        background: `radial-gradient(circle, color-mix(in srgb, ${item.color} 15%, transparent) 0%, transparent 70%)`,
                        pointerEvents: "none",
                      }}
                    />
                    <div className="flex items-start justify-between mb-3">
                      <div className="relative inline-block">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)`, color: item.color }}>
                          <Icon size={18} weight="duotone" />
                        </div>
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4], boxShadow: [`0 0 4px ${item.color}`, `0 0 12px ${item.color}`, `0 0 4px ${item.color}`] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: idx * 0.3 }}
                          style={{ position: "absolute", top: "0px", right: "-2px", width: "6px", height: "6px", borderRadius: "50%", background: item.color }}
                        />
                      </div>
                      {item.trend !== null && (
                        <span
                          className="text-[10px] font-bold flex items-center gap-0.5"
                          style={{ color: item.trend >= 0 ? "var(--success)" : "var(--danger)" }}
                        >
                          {item.trend >= 0 ? <TrendUp size={10} weight="bold" /> : <TrendDown size={10} weight="bold" />}
                          {item.trend >= 0 ? "+" : ""}{item.trend}
                        </span>
                      )}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight" style={{ color: "var(--text-primary)" }}>
                      {item.value}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] mt-1" style={{ color: "var(--text-muted)" }}>
                      {item.label}
                    </div>
                    {item.sparkValues.length >= 2 && (
                      <div className="mt-2">
                        <MiniSparkline values={item.sparkValues} color={item.color} width={80} height={20} />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${item.color}, transparent 80%)` }} />
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ═══ Section 3: Filters ═══ */}
          {!loading && entries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-6 rounded-2xl p-4"
              style={{
                background: "rgba(15, 15, 30, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <FunnelSimple size={14} weight="bold" style={{ color: "var(--text-muted)" }} />

                {/* Status */}
                <div className="flex gap-1">
                  {([
                    ["all", "Все"],
                    ["completed", "Завершённые"],
                    ["active", "В процессе"],
                  ] as [StatusFilter, string][]).map(([val, label]) => (
                    <FilterChip key={val} label={label} active={statusFilter === val} onClick={() => setStatusFilter(val)} />
                  ))}
                </div>

                <div className="w-px h-5" style={{ background: "var(--border-color)" }} />

                {/* Type */}
                <div className="flex gap-1">
                  {([
                    ["all", "Все типы"],
                    ["training", "Тренировки"],
                    ["story", "AI Story"],
                  ] as [TypeFilter, string][]).map(([val, label]) => (
                    <FilterChip key={val} label={label} active={typeFilter === val} onClick={() => setTypeFilter(val)} />
                  ))}
                </div>

                <div className="w-px h-5" style={{ background: "var(--border-color)" }} />

                {/* Score */}
                <div className="flex gap-1">
                  {([
                    ["all", "Все баллы"],
                    ["excellent", "80+"],
                    ["good", "60-80"],
                    ["practice", "<60"],
                  ] as [ScoreFilter, string][]).map(([val, label]) => (
                    <FilterChip key={val} label={label} active={scoreFilter === val} onClick={() => setScoreFilter(val)} />
                  ))}
                </div>

                {/* Search */}
                <div className="flex-1 min-w-[140px]">
                  <div className="relative">
                    <MagnifyingGlass
                      size={14}
                      style={{
                        position: "absolute",
                        left: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Поиск..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-full text-xs py-1.5 pl-8 pr-3"
                      style={{
                        background: "var(--input-bg)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("all");
                      setTypeFilter("all");
                      setScoreFilter("all");
                      setSearchQuery("");
                    }}
                    className="text-[10px] font-semibold uppercase px-2 py-1 rounded-full"
                    style={{ color: "var(--danger)", background: "var(--danger-muted)" }}
                  >
                    Сбросить
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ Section 4: Было / Стало ═══ */}
          {!loading && comparisonData && (() => {
            const { first, last } = comparisonData;
            const firstScore = first.score_total ?? 0;
            const lastScore = last.score_total ?? 0;
            const diff = Math.round(lastScore - firstScore);
            const isPositive = diff > 0;

            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: isPositive ? "var(--success)" : "var(--danger)",
                      boxShadow: isPositive ? "0 0 6px rgba(34,197,94,0.6)" : "0 0 6px rgba(239,68,68,0.6)",
                      animation: "pulse 2s ease-in-out infinite", flexShrink: 0,
                    }}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Было / Стало
                  </span>
                  <div
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: isPositive ? "var(--success-muted)" : "var(--danger-muted)",
                      color: isPositive ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {isPositive ? "+" : ""}{diff} баллов
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                  {/* First session card */}
                  <div
                    className="rounded-xl p-4 relative overflow-hidden"
                    style={{
                      background: "rgba(15, 15, 30, 0.95)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                      Первая сессия
                    </div>
                    <div className="flex items-center gap-3">
                      <CircularScore score={firstScore} size={56} />
                      <div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatDate(first.started_at)}
                        </div>
                        <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                          {formatDuration(first.duration_seconds)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{
                        background: isPositive ? "var(--success-muted)" : "var(--danger-muted)",
                      }}
                    >
                      <ArrowRight size={18} style={{ color: isPositive ? "var(--success)" : "var(--danger)" }} />
                    </div>
                  </div>

                  {/* Last session card */}
                  <div
                    className="rounded-xl p-4 relative overflow-hidden"
                    style={{
                      background: "rgba(15, 15, 30, 0.95)",
                      border: `1px solid ${isPositive ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                      boxShadow: isPositive
                        ? "0 0 20px rgba(74,222,128,0.08)"
                        : "0 0 20px rgba(248,113,113,0.08)",
                    }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: isPositive ? "var(--success)" : "var(--danger)" }}>
                      Последняя сессия
                    </div>
                    <div className="flex items-center gap-3">
                      <CircularScore score={lastScore} size={56} />
                      <div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatDate(last.started_at)}
                        </div>
                        <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                          {formatDuration(last.duration_seconds)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}

          {/* ═══ Section 5: Session List ═══ */}
          {loading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 flex items-center gap-4 animate-pulse"
                  style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid var(--border-color)" }}
                >
                  <div className="w-11 h-11 rounded-full bg-[var(--input-bg)]" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <div className="h-3 w-16 rounded-full bg-[var(--input-bg)]" />
                      <div className="h-3 w-24 rounded bg-[var(--input-bg)]" />
                    </div>
                    <div className="h-2.5 w-32 rounded bg-[var(--input-bg)]" />
                    <div className="flex gap-2 mt-1">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="flex-1 h-1.5 rounded-full bg-[var(--input-bg)]" />
                      ))}
                    </div>
                  </div>
                  <div className="h-11 w-11 rounded-full bg-[var(--input-bg)]" />
                </div>
              ))}
            </div>
          ) : error ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-16 flex flex-col items-center">
              <Warning size={40} weight="duotone" style={{ color: "var(--danger)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{error}</p>
            </motion.div>
          ) : entries.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-16 flex flex-col items-center">
              <Tray size={40} weight="duotone" style={{ color: "var(--text-muted)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Твоя история начнётся с первой тренировки.</p>
              <Button onClick={() => router.push("/training")} className="mt-4" iconRight={<ArrowRight size={16} />}>
                Начать обучение
              </Button>
            </motion.div>
          ) : filteredEntries.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 flex flex-col items-center">
              <Search size={32} style={{ color: "var(--text-muted)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Нет сессий по выбранным фильтрам</p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setScoreFilter("all");
                  setSearchQuery("");
                }}
                className="mt-2 text-xs font-semibold"
                style={{ color: "var(--accent)" }}
              >
                Сбросить фильтры
              </button>
            </motion.div>
          ) : (
            <div className="mt-6 space-y-6">
              {groupedEntries.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                      {group.label}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
                    <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                      {group.entries.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.entries.map((entry, i) => {
                      const session = entry.latest_session;
                      const st = statusConfig(session.status);
                      const Icon = st.icon;
                      const canViewResults = session.status === "completed" && session.score_total !== null;
                      const story = entry.story;
                      const targetHref = `/results/${session.id}`;
                      const canOpenEntry = canViewResults;
                      const entryScore = entry.avg_score ?? session.score_total;
                      const badge = scoreBadge(entryScore);
                      const isFeatured = bestSessionOfWeek && (story?.id || session.id) === (bestSessionOfWeek.story?.id || bestSessionOfWeek.latest_session.id);

                      // Left accent color based on score
                      let leftAccent = "var(--text-muted)";
                      if (entryScore !== null) {
                        if (entryScore >= 80) leftAccent = "var(--success)";
                        else if (entryScore >= 60) leftAccent = "var(--info)";
                        else leftAccent = "var(--warning)";
                      }

                      return (
                        <motion.div
                          key={story?.id || session.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.35 }}
                          className={`history-card rounded-xl p-5 relative overflow-hidden ${canOpenEntry ? "cursor-pointer" : ""} ${isFeatured ? "featured-card" : ""}`}
                          style={{
                            background: "rgba(15, 15, 30, 0.95)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                          }}
                          onClick={() => canOpenEntry && router.push(targetHref)}
                        >
                          {/* Left accent bar */}
                          <div
                            aria-hidden
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 8,
                              bottom: 8,
                              width: 3,
                              borderRadius: 2,
                              background: leftAccent,
                            }}
                          />

                          {/* Featured star */}
                          {isFeatured && (
                            <div
                              style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                              }}
                            >
                              <Star size={16} weight="fill" style={{ color: "var(--warning)" }} />
                            </div>
                          )}

                          <div className="flex items-center gap-4 pl-2">
                            {/* Score circle or status icon */}
                            <div className="shrink-0">
                              {entryScore !== null ? (
                                <CircularScore score={entryScore} size={48} />
                              ) : (
                                <div
                                  className="flex h-12 w-12 items-center justify-center rounded-full"
                                  style={{ background: `color-mix(in srgb, ${st.color} 10%, transparent)` }}
                                >
                                  <Icon size={20} weight="duotone" style={{ color: st.color }} />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Badge */}
                                {canViewResults && badge.label && (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                    style={{ background: badge.bgColor, color: badge.accentColor }}
                                  >
                                    {badge.label}
                                  </span>
                                )}
                                {/* Type badge */}
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                  style={{
                                    background: story ? "var(--accent-muted)" : `color-mix(in srgb, ${st.color} 8%, transparent)`,
                                    color: story ? "var(--accent)" : st.color,
                                  }}
                                >
                                  {story ? "AI Story" : st.label}
                                </span>
                                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                  {formatDate(session.started_at)}
                                </span>
                              </div>

                              {/* Title */}
                              <div className="mt-1.5 text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                {story ? story.story_name : (session.scenario_id || "Тренировка")}
                              </div>

                              {/* Meta row */}
                              <div className="mt-1 flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                                <span className="flex items-center gap-1">
                                  <Clock size={12} weight="duotone" />
                                  {formatDuration(session.duration_seconds)}
                                </span>
                                {story && (
                                  <span>{story.completed_calls}/{story.total_calls_planned} звонков</span>
                                )}
                              </div>

                              {/* Score breakdown mini-bars */}
                              {canViewResults && <MiniScoreBars session={session} />}

                              {/* Story metadata */}
                              {story && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                    Статус: {story.game_status}
                                  </span>
                                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                    Факторов: {story.active_factors.length}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/results/${story.id}`);
                                    }}
                                    className="ml-auto text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                                    style={{
                                      background: "var(--accent-muted)",
                                      color: "var(--accent)",
                                      border: "1px solid var(--accent-glow)",
                                    }}
                                    aria-label="Открыть арку клиента в AI-Портфеле"
                                  >
                                    Открыть арку
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Right arrow */}
                            {canOpenEntry && (
                              <ArrowRight size={16} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                            )}
                          </div>
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
