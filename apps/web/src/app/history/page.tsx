"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, History } from "lucide-react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Warning,
  Tray,
  ChartBar,
  Stack,
  Sparkle,
  TrendUp,
  TrendDown,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { scoreColor } from "@/lib/utils";
import AuthLayout from "@/components/layout/AuthLayout";
import type { HistoryEntry } from "@/types";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

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

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Mini score bars for breakdown
function MiniScoreBars({ session }: { session: HistoryEntry["latest_session"] }) {
  const bars = [
    { label: "Скр", value: session.score_script_adherence, max: 30, color: "var(--accent)" },
    { label: "Возр", value: session.score_objection_handling, max: 25, color: "var(--magenta)" },
    { label: "Ком", value: session.score_communication, max: 20, color: "var(--info)" },
    { label: "Рез", value: session.score_result, max: 10, color: "var(--success)" },
  ];

  return (
    <div className="flex gap-1 mt-2">
      {bars.map((bar) => {
        const pct = bar.value !== null && bar.max > 0 ? Math.round((bar.value / bar.max) * 100) : 0;
        return (
          <div key={bar.label} className="flex-1" title={`${bar.label}: ${bar.value ?? 0}/${bar.max}`}>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--input-bg)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bar.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PREMIUM_STYLES = `
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
.history-session-card {
  transition: box-shadow 0.3s ease, transform 0.15s ease;
}
.history-session-card:hover {
  box-shadow: 0 0 20px rgba(168,85,247,0.06), 0 0 40px rgba(59,130,246,0.04), 0 4px 16px rgba(0,0,0,0.15) !important;
}
`;

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = () => {
    api
      .get("/training/history?limit=50")
      .then(setEntries)
      .catch((err) => setError(err.message || "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Refetch sessions when user returns to the tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchHistory();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Aggregate stats
  const latestSessions = entries.map((entry) => entry.latest_session);
  const completed = latestSessions.filter((s) => s.status === "completed");
  const avgScore = completed.length > 0
    ? Math.round(completed.reduce((sum, s) => sum + (s.score_total ?? 0), 0) / completed.length)
    : null;
  const storyCount = entries.filter((entry) => entry.kind === "story").length;

  // P2-19: Group sessions by date
  const groupedEntries = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;

    const groups: { label: string; entries: HistoryEntry[] }[] = [
      { label: "Сегодня", entries: [] },
      { label: "На этой неделе", entries: [] },
      { label: "Ранее", entries: [] },
    ];

    for (const entry of entries) {
      const t = new Date(entry.sort_at).getTime();
      if (t >= todayStart) groups[0].entries.push(entry);
      else if (t >= weekStart) groups[1].entries.push(entry);
      else groups[2].entries.push(entry);
    }

    return groups.filter((g) => g.entries.length > 0);
  }, [entries]);

  return (
    <AuthLayout>
      <style dangerouslySetInnerHTML={{ __html: PREMIUM_STYLES }} />
      <div className="relative panel-grid-bg min-h-screen">
        {/* Ambient gradient orbs */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-200px",
            left: "-200px",
            width: 800,
            height: 800,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(168,85,247,0.45) 0%, transparent 70%)",
            opacity: 0.03,
            pointerEvents: "none",
            filter: "blur(80px)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "-150px",
            width: 650,
            height: 650,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)",
            opacity: 0.025,
            pointerEvents: "none",
            filter: "blur(80px)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)",
            opacity: 0.02,
            pointerEvents: "none",
            filter: "blur(80px)",
          }}
        />
        {/* Noise texture overlay */}
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
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--magenta-muted)",
                boxShadow: "0 0 0 1px color-mix(in srgb, var(--magenta) 20%, transparent), 0 0 20px rgba(236,72,153,0.15), 0 0 40px rgba(236,72,153,0.05)",
              }}
            >
              <History size={22} style={{ color: "var(--magenta)" }} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                История
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                Все ваши прошлые сессии
              </p>
            </div>
          </motion.div>

          {/* Было / Стало comparison — detailed metrics */}
          {!loading && completed.length >= 2 && (() => {
            const sorted = [...completed].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const firstScore = first.score_total ?? 0;
            const lastScore = last.score_total ?? 0;
            const diff = Math.round(lastScore - firstScore);
            const isPositive = diff > 0;

            const metrics = [
              { label: "Общий балл", first: first.score_total, last: last.score_total, max: 100, color: "var(--accent)" },
              { label: "Скрипт", first: first.score_script_adherence, last: last.score_script_adherence, max: 30, color: "var(--info)" },
              { label: "Возражения", first: first.score_objection_handling, last: last.score_objection_handling, max: 25, color: "var(--magenta)" },
              { label: "Коммуникация", first: first.score_communication, last: last.score_communication, max: 20, color: "#8B5CF6" },
              { label: "Результат", first: first.score_result, last: last.score_result, max: 10, color: "var(--success)" },
            ];

            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-6 rounded-2xl overflow-hidden"
                style={{
                  background: isPositive ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)",
                  border: `1px solid ${isPositive ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}`,
                  boxShadow: isPositive
                    ? "0 0 20px rgba(34,197,94,0.08), inset 0 1px 0 rgba(34,197,94,0.06)"
                    : "0 0 20px rgba(239,68,68,0.08), inset 0 1px 0 rgba(239,68,68,0.06)",
                }}
              >
                {/* Header */}
                <div className="p-4 pb-3 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: isPositive ? "var(--success)" : "var(--danger)",
                        boxShadow: isPositive ? "0 0 6px rgba(34,197,94,0.6)" : "0 0 6px rgba(239,68,68,0.6)",
                        animation: "pulse 2s ease-in-out infinite", flexShrink: 0,
                      }}
                    />
                    {isPositive
                      ? <TrendUp size={18} weight="bold" style={{ color: "var(--success)" }} />
                      : <TrendDown size={18} weight="bold" style={{ color: "var(--danger)" }} />
                    }
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: isPositive ? "var(--success)" : "var(--danger)" }}>
                      Было / Стало
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-center">
                      <div className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Первая</div>
                      <div className="text-lg font-bold" style={{ color: "var(--text-secondary)" }}>{Math.round(firstScore)}</div>
                    </div>
                    <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                    <div className="text-center">
                      <div className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Последняя</div>
                      <div className="text-lg font-bold" style={{ color: scoreColor(lastScore) }}>{Math.round(lastScore)}</div>
                    </div>
                  </div>
                  <div
                    className="text-sm font-bold px-3 py-1 rounded-lg"
                    style={{
                      background: isPositive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: isPositive ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {isPositive ? "+" : ""}{diff} баллов
                  </div>
                </div>

                {/* Detailed metric bars */}
                <div className="px-4 pb-4 space-y-2.5">
                  {metrics.map((m) => {
                    const fVal = m.first ?? 0;
                    const lVal = m.last ?? 0;
                    const mDiff = lVal - fVal;
                    const fPct = m.max > 0 ? (fVal / m.max) * 100 : 0;
                    const lPct = m.max > 0 ? (lVal / m.max) * 100 : 0;
                    const mPositive = mDiff > 0;
                    return (
                      <div key={m.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                              {Math.round(fVal)} → {Math.round(lVal)}
                            </span>
                            {mDiff !== 0 && (
                              <span className="text-[10px] font-bold" style={{ color: mPositive ? "var(--success)" : "var(--danger)" }}>
                                {mPositive ? "+" : ""}{Math.round(mDiff)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="absolute inset-y-0 left-0 rounded-full opacity-40"
                            style={{ width: `${fPct}%`, background: m.color }}
                          />
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${lPct}%`, background: m.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })()}

          {/* Summary stats */}
          {!loading && entries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"
            >
              {[
                { label: "Всего", value: entries.length, icon: ChartBar, color: "var(--accent)" },
                { label: "Историй", value: storyCount, icon: Stack, color: "var(--magenta)" },
                { label: "Завершено", value: completed.length, icon: CheckCircle, color: "var(--success)" },
                { label: "Ср. балл", value: avgScore !== null ? avgScore : "—", icon: Sparkle, color: "var(--warning)", hero: true },
              ].map((item) => {
                const Icon = item.icon;
                const isHero = "hero" in item && item.hero;
                return (
                  <div
                    key={item.label}
                    className="glass-panel p-4 text-center"
                    style={{
                      ...(isHero ? { borderBottom: `2px solid ${item.color}` } : {}),
                      boxShadow: `0 0 15px color-mix(in srgb, ${item.color} 8%, transparent), 0 0 30px color-mix(in srgb, ${item.color} 3%, transparent)`,
                    }}
                  >
                    <Icon size={isHero ? 18 : 14} weight="duotone" className="mx-auto mb-1" style={{ color: item.color }} />
                    <div className={`font-display font-bold ${isHero ? "text-2xl" : "text-xl"}`} style={{ color: isHero ? item.color : "var(--text-primary)" }}>{item.value}</div>
                    <div className="font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{item.label}</div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {loading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="glass-panel p-5 flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-[var(--input-bg)]" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <div className="h-3 w-16 rounded-full bg-[var(--input-bg)]" />
                      <div className="h-3 w-24 rounded bg-[var(--input-bg)]" />
                    </div>
                    <div className="h-2.5 w-20 rounded bg-[var(--input-bg)]" />
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="flex-1 h-1 rounded-full bg-[var(--input-bg)]" />
                      ))}
                    </div>
                  </div>
                  <div className="h-8 w-12 rounded bg-[var(--input-bg)]" />
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
          ) : (
            <div className="mt-6 space-y-6">
              {groupedEntries.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--accent)" }}>{group.label}</span>
                    <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
                    <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{group.entries.length}</span>
                  </div>
                  <div className="space-y-3">
                    {group.entries.map((entry, i) => {
                      const session = entry.latest_session;
                      const st = statusConfig(session.status);
                      const Icon = st.icon;
                      const canViewResults = session.status === "completed" && session.score_total !== null;
                      const story = entry.story;
                      // 2026-04-18 routing fix: card click ALWAYS goes to session
                      // debrief (/results). Story (portfolio arc) opens via a
                      // dedicated secondary button below — so users can't
                      // accidentally land in the portfolio when they wanted
                      // the session score breakdown.
                      const targetHref = `/results/${session.id}`;
                      const canOpenEntry = canViewResults;

                      return (
                        <motion.div
                          key={story?.id || session.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`glass-panel history-session-card p-5 flex items-center gap-4 transition-all ${canOpenEntry ? "cursor-pointer" : ""}`}
                          style={{ boxShadow: `inset 3px 0 0 ${scoreColor(entry.avg_score ?? session.score_total)}` }}
                          whileHover={canOpenEntry ? { y: -2, boxShadow: "var(--shadow-md)" } : undefined}
                          onClick={() => canOpenEntry && router.push(targetHref)}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${st.color} 8%, transparent)` }}>
                            {story ? <Sparkle size={18} weight="duotone" style={{ color: "var(--accent)" }} /> : <Icon size={18} weight="duotone" style={{ color: st.color }} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs uppercase tracking-wide px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: `color-mix(in srgb, ${story ? "var(--accent)" : st.color} 8%, transparent)`, color: story ? "var(--accent)" : st.color }}>
                                {story ? "AI Story" : st.label}
                              </span>
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(session.started_at)}</span>
                            </div>
                            <div className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {story ? story.story_name : "Одиночная тренировка"}
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                              <span className="flex items-center gap-1"><Clock size={12} weight="duotone" />{formatDuration(session.duration_seconds)}</span>
                              {story && (
                                <span>{story.completed_calls}/{story.total_calls_planned} звонков</span>
                              )}
                            </div>
                            {story && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  Статус: {story.game_status}
                                </span>
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  Факторов: {story.active_factors.length}
                                </span>
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  Последствий: {story.consequences.length}
                                </span>
                                {/* 2026-04-18 UX: dedicated entry to AI-Portfolio arc.
                                    Stops event bubbling so card click stays on /results. */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/results/${story.id}`);
                                  }}
                                  className="ml-auto text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                                  style={{
                                    background: "var(--accent-muted)",
                                    color: "var(--accent)",
                                    border: "1px solid var(--accent-glow)",
                                  }}
                                  aria-label="Открыть арку клиента в AI-Портфеле"
                                >
                                  Открыть арку →
                                </button>
                              </div>
                            )}
                            {canViewResults && <MiniScoreBars session={session} />}
                          </div>

                          <div className="text-right shrink-0">
                            {(entry.avg_score ?? session.score_total) !== null ? (
                              <div className="font-display text-2xl font-bold" style={{ color: scoreColor(entry.avg_score ?? session.score_total) }}>
                                {Math.round((entry.avg_score ?? session.score_total) as number)}
                                <span className="text-xs font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>/100</span>
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </div>

                          {canOpenEntry && <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />}
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
