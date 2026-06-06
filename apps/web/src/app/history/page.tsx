"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Search,
  AlertTriangle,
  BarChart3,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Trophy,
  Filter,
  GraduationCap,
  Loader2,
  Activity,
  CheckCircle2,
  XCircle,
  BookOpen,
  Briefcase,
  Award,
  ChevronDown,
  Inbox,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";
import { EditorialHeader } from "@/components/ui/EditorialHeader";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { api } from "@/lib/api";
import { scoreColor } from "@/lib/utils";
import AuthLayout from "@/components/layout/AuthLayout";
import type {
  UnifiedHistoryItem,
  UnifiedHistoryKind,
  ManyashaExplainResponse,
  WeeklyReportResponse,
} from "@/types";

type TypeFilter = "all" | "training" | "quiz" | "case" | "exam";

/* ── Metric helpers ──────────────────────────────────────── */

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Extract the single representative score for aggregates / sparklines. */
function itemScore(item: UnifiedHistoryItem): number | null {
  const m = item.metrics;
  switch (item.kind) {
    case "exam":
      return num(m.score_percent);
    case "quiz":
      return num(m.score);
    case "case":
      return num(m.score_percent);
    case "session":
      return num(m.score_total);
    case "story":
      return num(m.best_score) ?? num(m.avg_score);
    default:
      return null;
  }
}

const KIND_LABEL: Record<UnifiedHistoryKind, string> = {
  session: "Тренировка",
  story: "AI Story",
  case: "Кейс",
  exam: "Экзамен",
  quiz: "Тест",
};

const KIND_ICON: Record<UnifiedHistoryKind, typeof BookOpen> = {
  session: GraduationCap,
  story: Layers,
  case: Briefcase,
  exam: Award,
  quiz: BookOpen,
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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

/* ── Manyasha explain panel (per-item, lazy) ─────────────── */

interface ExplainState {
  loading: boolean;
  data: ManyashaExplainResponse | null;
  error: string | null;
}

function ManyashaPanel({ state, onRetry }: { state: ExplainState; onRetry: () => void }) {
  if (state.loading) {
    return (
      <div className="mt-3 flex items-center gap-2 font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={13} className="animate-spin" /> Маняша готовит разбор…
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
        <span>Разбор временно недоступен. Попробуйте позже.</span>
        <Button variant="ghost" size="sm" icon={<Loader2 size={13} />} onClick={onRetry}>Повторить</Button>
      </div>
    );
  }
  if (!state.data) return null;
  const { report_text, weak_points, sources } = state.data;
  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--primary)" }}>
        <Sparkles size={12} /> Разбор от Маняши
      </div>
      {report_text && (
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)", whiteSpace: "pre-line" }}>
          {report_text}
        </p>
      )}
      {weak_points.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {weak_points.map((w, i) => (
            <span key={i} className="rounded-full px-2 py-0.5 font-mono text-[11px]" style={{ background: "var(--warning-muted)", color: "var(--warning)" }}>
              {w}
            </span>
          ))}
        </div>
      )}
      {sources.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Источники</div>
          {sources.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 font-mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold" style={{ color: "var(--primary)" }}>{s.law_article || "—"}</span>
              <span style={{ color: "var(--text-muted)" }}>{s.category}</span>
              {s.is_court_practice && s.court_case && (
                <span style={{ color: "var(--text-muted)" }}>· {s.court_case}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Per-kind metric body ────────────────────────────────── */

function MetricBody({ item }: { item: UnifiedHistoryItem }) {
  const m = item.metrics;
  if (item.kind === "session") {
    const hf = num(m.score_human_factor);
    const nar = num(m.score_narrative);
    const leg = num(m.score_legal);
    const parts = [
      hf !== null ? `Чел. фактор ${hf}` : null,
      nar !== null ? `Нарратив ${nar}` : null,
      leg !== null ? `Право ${leg}` : null,
    ].filter(Boolean);
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {parts.length > 0 ? parts.map((p, i) => <span key={i}>{p}</span>) : <span style={{ color: "var(--text-muted)" }}>Без детальных оценок</span>}
      </div>
    );
  }
  if (item.kind === "story") {
    const done = num(m.calls_completed);
    const leg = num(m.score_legal);
    const hf = num(m.score_human_factor);
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {done !== null && <span>{done} звонков</span>}
        {hf !== null && <span>Чел. фактор {hf}</span>}
        {leg !== null && <span>Право {leg}</span>}
      </div>
    );
  }
  if (item.kind === "case") {
    const pct = num(m.score_percent);
    const s1 = num(m.stage1_score);
    const s2 = num(m.stage2_score);
    const max = num(m.max_score);
    const raw = num(m.score);
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {pct !== null && <span>{pct}%</span>}
        {raw !== null && max !== null && <span>{raw}/{max} баллов</span>}
        {(s1 !== null || s2 !== null) && <span>этап1 {s1 ?? "—"} · этап2 {s2 ?? "—"}</span>}
      </div>
    );
  }
  if (item.kind === "exam") {
    const pct = num(m.score_percent);
    const passed = bool(m.passed);
    const threshold = num(m.pass_threshold);
    const correct = num(m.correct_count);
    const total = num(m.total_count);
    const cert = str(m.certificate_code);
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {pct !== null && <span>{pct}%{threshold !== null && <span style={{ color: "var(--text-muted)" }}> / порог {threshold}%</span>}</span>}
        {correct !== null && total !== null && <span>{correct}/{total} верно</span>}
        {passed !== null && (
          <span className="inline-flex items-center gap-1" style={{ color: passed ? "var(--success)" : "var(--danger)" }}>
            {passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {passed ? "сдан" : "не сдан"}
          </span>
        )}
        {cert && <span style={{ color: "var(--success)" }}>сертификат {cert}</span>}
      </div>
    );
  }
  // quiz
  const correct = num(m.correct_answers);
  const incorrect = num(m.incorrect_answers);
  const total = num(m.total_questions);
  const score = num(m.score);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
      {correct !== null && total !== null && <span>{correct}/{total} верно</span>}
      {incorrect !== null && incorrect > 0 && <span style={{ color: "var(--text-muted)" }}>{incorrect} ошибок</span>}
      {score !== null && <span>{Math.round(score)}%</span>}
    </div>
  );
}

/* ── Weekly summary block ────────────────────────────────── */

function WeeklySummary({ weekly, loading }: { weekly: WeeklyReportResponse | null; loading: boolean }) {
  const reportText = str(weekly?.report_text ?? null);
  const recs = (weekly?.recommendations ?? []).filter((r): r is string => typeof r === "string" && r.length > 0);

  return (
    <Card accentTop className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={15} style={{ color: "var(--primary)" }} />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Итоги недели</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={13} className="animate-spin" /> Маняша считает неделю…
        </div>
      ) : reportText ? (
        <>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Маняша подвела итог твоей недели:</p>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)", whiteSpace: "pre-line" }}>
            {reportText}
          </p>
          {recs.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {recs.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  <span className="mt-1 font-mono" style={{ color: "var(--primary)" }}>—</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          Недельный отчёт появится после нескольких занятий.
        </p>
      )}
    </Card>
  );
}

/* ── Main Page ───────────────────────────────────────────── */

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<UnifiedHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weekly, setWeekly] = useState<WeeklyReportResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Per-item Manyasha разбор state, keyed by `${kind}:${id}`.
  const [explain, setExplain] = useState<Record<string, ExplainState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchAll = useCallback((silent = false) => {
    if (silent) setRefreshing(true);
    api
      .get<UnifiedHistoryItem[]>("/history/unified?limit=100")
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err: Error) => setError(err.message || "Ошибка загрузки"))
      .finally(() => { setLoading(false); setRefreshing(false); });

    api
      .get<WeeklyReportResponse>("/dashboard/weekly-report")
      .then((data) => setWeekly(data ?? null))
      .catch(() => setWeekly(null))
      .finally(() => setWeeklyLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchAll(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchAll]);

  const fetchExplain = useCallback((item: UnifiedHistoryItem) => {
    const key = `${item.kind}:${item.id}`;
    setExplain((ex) => {
      if (ex[key]?.data || ex[key]?.loading) return ex;
      api
        .get<ManyashaExplainResponse>(`/history/${item.kind}/${item.id}/explain`)
        .then((data) =>
          setExplain((e2) => ({ ...e2, [key]: { loading: false, data, error: null } })),
        )
        .catch((err: Error) =>
          setExplain((e2) => ({ ...e2, [key]: { loading: false, data: null, error: err.message || "Ошибка" } })),
        );
      return { ...ex, [key]: { loading: true, data: null, error: null } };
    });
  }, []);

  const retryExplain = useCallback((item: UnifiedHistoryItem) => {
    const key = `${item.kind}:${item.id}`;
    // Clear the prior error state so fetchExplain re-runs.
    setExplain((ex) => {
      const next = { ...ex };
      delete next[key];
      return next;
    });
    fetchExplain(item);
  }, [fetchExplain]);

  const toggleExplain = useCallback((item: UnifiedHistoryItem) => {
    const key = `${item.kind}:${item.id}`;
    setExpanded((prev) => {
      const next = !prev[key];
      // Lazy-fetch on first open.
      if (next) fetchExplain(item);
      return { ...prev, [key]: next };
    });
  }, [fetchExplain]);

  /* ── Computed aggregates (real scores only) ──────────────── */

  const scored = useMemo(
    () => items.map((it) => ({ it, score: itemScore(it) })).filter((x): x is { it: UnifiedHistoryItem; score: number } => x.score !== null),
    [items],
  );

  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length) : null;
  const bestScore = scored.length > 0 ? Math.max(...scored.map((x) => x.score)) : null;

  const byTypeCounts = useMemo(() => {
    const c: Record<UnifiedHistoryKind, number> = { session: 0, story: 0, case: 0, exam: 0, quiz: 0 };
    for (const it of items) c[it.kind]++;
    return c;
  }, [items]);

  const trendData = useMemo(() => {
    return [...scored]
      .sort((a, b) => new Date(a.it.date).getTime() - new Date(b.it.date).getTime())
      .slice(-20)
      .map((x) => ({ score: x.score, date: formatDate(x.it.date) }));
  }, [scored]);

  const recentScores = useMemo(() => {
    return [...scored]
      .sort((a, b) => new Date(a.it.date).getTime() - new Date(b.it.date).getTime())
      .slice(-5)
      .map((x) => x.score);
  }, [scored]);

  const scoreTrend = useMemo(() => {
    if (scored.length < 4) return null;
    const sorted = [...scored].sort((a, b) => new Date(a.it.date).getTime() - new Date(b.it.date).getTime());
    const half = Math.floor(sorted.length / 2);
    const avgFirst = sorted.slice(0, half).reduce((s, x) => s + x.score, 0) / half;
    const avgSecond = sorted.slice(half).reduce((s, x) => s + x.score, 0) / (sorted.length - half);
    return Math.round(avgSecond - avgFirst);
  }, [scored]);

  /* ── Filtering + grouping ────────────────────────────────── */

  const filteredItems = useMemo(() => {
    let result = items;
    if (typeFilter !== "all") {
      result = result.filter((it) => {
        if (typeFilter === "training") return it.kind === "session" || it.kind === "story";
        if (typeFilter === "quiz") return it.kind === "quiz";
        if (typeFilter === "case") return it.kind === "case";
        if (typeFilter === "exam") return it.kind === "exam";
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((it) => it.title.toLowerCase().includes(q));
    }
    return result;
  }, [items, typeFilter, searchQuery]);

  const groupedItems = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;
    const groups: { label: string; items: UnifiedHistoryItem[] }[] = [
      { label: "Сегодня", items: [] },
      { label: "На этой неделе", items: [] },
      { label: "Ранее", items: [] },
    ];
    for (const it of filteredItems) {
      const t = new Date(it.date).getTime();
      if (t >= todayStart) groups[0].items.push(it);
      else if (t >= weekStart) groups[1].items.push(it);
      else groups[2].items.push(it);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [filteredItems]);

  const hasActiveFilters = typeFilter !== "all" || searchQuery.trim() !== "";
  const resetFilters = () => { setTypeFilter("all"); setSearchQuery(""); };

  const statCards = [
    { label: "Всего записей", value: items.length, icon: BarChart3, spark: [] as number[], trend: null as number | null },
    { label: "Средний балл", value: avgScore !== null ? avgScore : "—", icon: Sparkles, spark: recentScores, trend: scoreTrend },
    { label: "Лучший балл", value: bestScore !== null ? bestScore : "—", icon: Trophy, spark: recentScores, trend: null as number | null },
    { label: "Экзамены · Кейсы", value: `${byTypeCounts.exam} · ${byTypeCounts.case}`, icon: Award, spark: [] as number[], trend: null as number | null },
  ];

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <AuthLayout>
      <div className="relative min-h-screen overflow-hidden bg-page-glow">
        <AbstractBackdrop />
        <div className="app-page relative z-10 max-w-4xl">

          {/* ── Header — единый редакторский паттерн (как /cases) ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: "easeOut" }}>
            <EditorialHeader
              eyebrowLeft="Хронология · обучение"
              eyebrowRight="всё в одном месте"
              title="История"
              subtitle="Тренировки, тесты, кейсы и экзамены — в одной хронике."
              right={
                refreshing ? (
                  <span className="hidden items-center gap-1.5 font-mono text-[11px] sm:inline-flex" style={{ color: "var(--text-muted)" }}>
                    <Loader2 size={12} className="animate-spin" /> обновляю
                  </span>
                ) : undefined
              }
            />
          </motion.div>

          {/* ── Итоги недели от Маняши ── */}
          <WeeklySummary weekly={weekly} loading={weeklyLoading} />

          {/* ── 180-day activity ── */}
          <Card className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <Activity size={15} style={{ color: "var(--text-muted)" }} />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Активность за 180 дней</span>
            </div>
            <ActivityHeatmap days={180} accent="var(--primary)" />
          </Card>

          {/* ── Score trend ── */}
          {!loading && trendData.length >= 2 && (
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
              <ScoreTrendChart sessions={trendData} />
            </Card>
          )}

          {/* ── Stats ── */}
          {!loading && items.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {statCards.map((item) => (
                <Card key={item.label}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>{item.label}</div>
                    {item.trend !== null && (
                      <span className="flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums" style={{ color: item.trend >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {item.trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{item.trend >= 0 ? "+" : ""}{item.trend}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl" style={{ color: "var(--text-primary)" }}>{item.value}</div>
                  {item.spark.length >= 2 && <div className="mt-2"><MiniSparkline values={item.spark} /></div>}
                </Card>
              ))}
            </div>
          )}

          {/* ── Filters ── */}
          {!loading && items.length > 0 && (
            <Card className="mt-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                <Filter size={15} style={{ color: "var(--text-muted)" }} />
                <div className="flex flex-wrap gap-1.5">
                  {([["all", "Все"], ["training", "Тренировки"], ["quiz", "Тесты"], ["case", "Кейсы"], ["exam", "Экзамены"]] as [TypeFilter, string][]).map(([val, label]) => (
                    <FilterChip key={val} label={label} active={typeFilter === val} onClick={() => setTypeFilter(val)} />
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

          {/* ── Entry list ── */}
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
              <Button variant="ghost" size="sm" icon={<Loader2 size={14} />} onClick={() => fetchAll()} className="mt-3">Повторить</Button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Здесь появится твоя история"
              description="Тренировки, тесты, кейсы и экзамены собираются в единую хронику."
              hint="Начни с первой тренировки"
              actionLabel="Начать обучение"
              onAction={() => router.push("/training")}
              className="mt-10"
            />
          ) : filteredItems.length === 0 ? (
            <div className="mt-12 flex flex-col items-center text-center">
              <Search size={30} style={{ color: "var(--text-muted)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Нет записей по выбранным фильтрам.</p>
              <button type="button" onClick={resetFilters} className="mt-2 font-mono text-[12px]" style={{ color: "var(--primary)" }}>Сбросить фильтры</button>
            </div>
          ) : (
            <div className="mt-6 space-y-7">
              {groupedItems.map((group) => (
                <div key={group.label}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>{group.label}</span>
                    <div className="h-px flex-1" style={{ background: "var(--border-color)" }} />
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{group.items.length}</span>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item, i) => {
                      const key = `${item.kind}:${item.id}`;
                      const KindIcon = KIND_ICON[item.kind];
                      const score = itemScore(item);
                      const isOpen = !!expanded[key];
                      return (
                        <motion.div key={key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.2) }}>
                          <Card
                            variant="interactive"
                            role="link"
                            tabIndex={0}
                            onClick={() => router.push(item.deep_link)}
                            onKeyDown={(e) => { if (e.key === "Enter") router.push(item.deep_link); }}
                            className="group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="shrink-0">
                                {score !== null ? (
                                  <CircularScore score={score} size={48} />
                                ) : (
                                  <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--bg-secondary)" }}>
                                    <KindIcon size={20} style={{ color: "var(--text-muted)" }} />
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--primary)" }}>
                                    <KindIcon size={12} /> {KIND_LABEL[item.kind]}
                                  </span>
                                  <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{formatDate(item.date)}</span>
                                </div>

                                <div className="mt-1.5 truncate text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                                  {item.title}
                                </div>

                                <MetricBody item={item} />

                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleExplain(item); }}
                                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors"
                                  style={{
                                    background: isOpen ? "var(--primary-muted)" : "transparent",
                                    color: isOpen ? "var(--primary)" : "var(--text-secondary)",
                                    border: `1px solid ${isOpen ? "var(--primary)" : "var(--border-color)"}`,
                                  }}
                                >
                                  <Sparkles size={11} /> Разбор от Маняши
                                  <ChevronDown size={12} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                                </button>

                                <AnimatePresence initial={false}>
                                  {isOpen && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.2 }}
                                      style={{ overflow: "hidden" }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ManyashaPanel state={explain[key] ?? { loading: true, data: null, error: null }} onRetry={() => retryExplain(item)} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>

                              <ArrowRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--text-muted)" }} />
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
