"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Loader2, X, Phone, Clock, BookOpen,
} from "lucide-react";
import {
  Lightning, TrendUp, Target, Crosshair,
  ClipboardText,
} from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import AuthLayout from "@/components/layout/AuthLayout";
import { useTrainingStore } from "@/stores/useTrainingStore";
import type { DashboardManager } from "@/types";
import { scoreColor } from "@/lib/utils";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { logger } from "@/lib/logger";


// ── Time-of-day greeting ──────────────────────────────────────────────
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 17) return "Добрый день";
  if (h >= 17 && h < 22) return "Добрый вечер";
  return "Доброй ночи";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  return `${m} мин`;
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardManager | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [waitingClient, setWaitingClient] = useState<{
    full_name: string;
    age: number;
    city: string;
    archetype_code: string;
    difficulty: number;
    trust_level: number;
    total_debt: number;
    scenario_id: string;
    lead_source: string;
    gender: string;
  } | null>(null);
  const [waitingClientLoaded, setWaitingClientLoaded] = useState(false);

  const fetchDashboard = () => {
    if (!user) return;
    api
      .get("/dashboard/manager")
      .then((data: DashboardManager) => setDashboard(data))
      .catch((err) => { logger.error("Failed to load dashboard:", err); })
      .finally(() => setLoading(false));
    api.get<{ client: typeof waitingClient }>("/home/waiting-client")
      .then((data) => setWaitingClient(data.client))
      .catch(() => { /* optional -- fallback to old quickStart */ })
      .finally(() => setWaitingClientLoaded(true));
  };

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  // Refetch when user returns to tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchDashboard();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchDashboard();
      }
    }, 60_000);
    return () => clearInterval(intervalId);
  }, [user]);

  const recommendations = dashboard?.recommendations ?? [];
  const recentSessions = dashboard?.recent_sessions ?? [];
  const stats = dashboard?.stats ?? null;
  const firstName = user?.full_name?.split(" ")[0] || "Пользователь";

  const quickStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      // Prefer the waiting client (new /home/start flow)
      if (waitingClient) {
        try {
          const session = await api.post("/home/start", {});
          if (session?.id) {
            router.push(`/training/${session.id}`);
            setTimeout(() => setStarting(false), 1000);
            return;
          }
        } catch (err: unknown) {
          const status = (err as { status?: number })?.status;
          if (status === 409) {
            logger.log("Waiting client expired, refetching preview");
            try {
              const { client } = await api.get<{ client: typeof waitingClient }>("/home/waiting-client");
              setWaitingClient(client);
            } catch { /* preview refetch failed, leave as-is */ }
            setStarting(false);
            return;
          }
          throw err;
        }
      }
      // Fallback: old random scenario flow
      let scenarioId: string;
      if (recommendations.length > 0) {
        const rec = recommendations[Math.floor(Math.random() * recommendations.length)];
        scenarioId = rec.scenario_id;
      } else {
        const scenariosData = await api.get("/scenarios/");
        const scenarios: { id: string }[] = Array.isArray(scenariosData) ? scenariosData : [];
        if (!scenarios.length) { setStarting(false); return; }
        scenarioId = scenarios[Math.floor(Math.random() * scenarios.length)].id;
      }
      const session = await api.post("/training/sessions", {
        scenario_id: scenarioId,
        mode: "chat",
        runtime_type: "training_simulation",
      });
      if (!session?.id) throw new Error("Invalid session response");
      router.push(`/training/${session.id}`);
      setTimeout(() => setStarting(false), 1000);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.detail?.code === "profile_incomplete"
      ) {
        router.push("/home");
        return;
      }
      useNotificationStore.getState().addToast({
        title: "Ошибка запуска",
        body: "Не удалось начать тренировку. Попробуйте ещё раз.",
        type: "error",
      });
      logger.error("Quick start failed:", err);
      setStarting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <div className="app-page">

          {/* ── WELCOME SECTION ─────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <p className="t-label mb-1">{getTimeGreeting()}</p>
            <h1 className="t-page-title">{firstName}</h1>
            <p className="t-lead mt-1">Менеджер</p>
          </motion.section>

          {/* ── INCOMING CALL CARD ──────────────────────────────────── */}
          {waitingClient && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="lh-card p-5 sm:p-6 mb-6"
              style={{ borderLeft: "3px solid var(--success)" }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className="relative flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: "var(--success-muted)" }}
                >
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                    style={{ background: "var(--success)" }}
                  />
                  <motion.span
                    className="relative inline-flex items-center justify-center"
                    animate={{ rotate: [0, -14, 14, -14, 14, -8, 8, 0] }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      repeatDelay: 1.3,
                      ease: "easeInOut",
                    }}
                  >
                    <Phone size={14} strokeWidth={2.5} style={{ color: "var(--success)" }} />
                  </motion.span>
                </span>
                <span className="t-label">Входящий звонок</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="t-card-title truncate">{waitingClient.full_name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="badge badge-accent">{waitingClient.city}</span>
                    <span className="badge" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                      Долг: {(waitingClient.total_debt / 1000).toFixed(0)}K
                    </span>
                    <span className="badge" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                      {"★".repeat(Math.min(waitingClient.difficulty, 5))}{"☆".repeat(Math.max(0, 5 - waitingClient.difficulty))}
                    </span>
                  </div>
                </div>

                <button
                  onClick={quickStart}
                  disabled={starting}
                  className="lh-btn-primary shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--success) 0%, #15803d 100%)",
                    boxShadow: "0 2px 8px var(--success-muted)",
                  }}
                >
                  {starting
                    ? <Loader2 size={16} className="animate-spin" />
                    : <><Crosshair weight="duotone" size={16} /><span>Ответить</span></>
                  }
                </button>
              </div>
            </motion.section>
          )}

          {/* ── QUICK ACTIONS ──────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
          >
            {/* Start training -- primary CTA */}
            {waitingClientLoaded && !waitingClient && (
              <button
                onClick={quickStart}
                disabled={starting}
                className="lh-card glass-panel-interactive p-5 flex items-center gap-4 text-left"
                style={{ borderLeft: "3px solid var(--primary)" }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-muted)" }}
                >
                  {starting
                    ? <Loader2 size={20} className="animate-spin" style={{ color: "var(--primary)" }} />
                    : <Lightning weight="duotone" size={20} style={{ color: "var(--primary)" }} />
                  }
                </div>
                <div className="min-w-0">
                  <div className="t-card-title" style={{ fontSize: "var(--fs-md)" }}>Начать тренировку</div>
                  <div className="t-caption mt-0.5">Быстрый старт с рекомендуемым сценарием</div>
                </div>
                <ArrowRight size={18} className="ml-auto shrink-0" style={{ color: "var(--text-muted)" }} />
              </button>
            )}

            {/* History */}
            <Link
              href="/history"
              className="lh-card glass-panel-interactive p-5 flex items-center gap-4 no-underline"
              style={{ borderLeft: "3px solid var(--ocean)" }}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--ocean-muted)" }}
              >
                <Clock size={20} style={{ color: "var(--ocean)" }} />
              </div>
              <div className="min-w-0">
                <div className="t-card-title" style={{ fontSize: "var(--fs-md)", color: "var(--text-primary)" }}>История сессий</div>
                <div className="t-caption mt-0.5">Просмотр прошлых тренировок</div>
              </div>
              <ArrowRight size={18} className="ml-auto shrink-0" style={{ color: "var(--text-muted)" }} />
            </Link>

            {/* Training catalog */}
            <Link
              href="/training"
              className="lh-card glass-panel-interactive p-5 flex items-center gap-4 no-underline"
              style={{ borderLeft: "3px solid var(--info)" }}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--info-muted)" }}
              >
                <BookOpen size={20} style={{ color: "var(--info)" }} />
              </div>
              <div className="min-w-0">
                <div className="t-card-title" style={{ fontSize: "var(--fs-md)", color: "var(--text-primary)" }}>База знаний</div>
                <div className="t-caption mt-0.5">Все доступные сценарии</div>
              </div>
              <ArrowRight size={18} className="ml-auto shrink-0" style={{ color: "var(--text-muted)" }} />
            </Link>
          </motion.section>

          {/* ── STATS ROW ──────────────────────────────────────────── */}
          {!loading && stats && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            >
              <StatCard
                label="Сессий"
                value={stats.completed_sessions ?? 0}
                icon={<Target weight="duotone" size={20} style={{ color: "var(--primary)" }} />}
                accentColor="var(--primary)"
              />
              <StatCard
                label="Ср. балл"
                value={stats.avg_score != null ? Math.round(stats.avg_score) : 0}
                icon={<TrendUp weight="duotone" size={20} style={{ color: scoreColor(stats.avg_score ?? null) }} />}
                accentColor={scoreColor(stats.avg_score ?? null)}
              />
              <StatCard
                label="Лучший"
                value={stats.best_score != null ? Math.round(stats.best_score) : 0}
                icon={<Target weight="duotone" size={20} style={{ color: scoreColor(stats.best_score ?? null) }} />}
                accentColor={scoreColor(stats.best_score ?? null)}
              />
              <StatCard
                label="За неделю"
                value={stats.sessions_this_week ?? 0}
                icon={<Clock size={20} style={{ color: "var(--ocean)" }} />}
                accentColor="var(--ocean)"
              />
            </motion.section>
          )}

          {/* ── RECENT SESSIONS ────────────────────────────────────── */}
          {!loading && recentSessions.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="t-section-title" style={{ fontSize: "var(--fs-lg)" }}>Последние сессии</h2>
                <Link
                  href="/history"
                  className="t-label flex items-center gap-1 no-underline"
                  style={{ color: "var(--ocean)" }}
                >
                  Все <ArrowRight size={14} />
                </Link>
              </div>
              <div className="space-y-3">
                {recentSessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      if (session.status === "completed" && session.score_total !== null) {
                        router.push(`/results/${session.id}`);
                      }
                    }}
                    className="lh-card glass-panel-interactive p-4 flex items-center gap-4"
                    style={{ cursor: session.status === "completed" ? "pointer" : "default" }}
                  >
                    {/* Score circle */}
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: session.score_total != null
                          ? `color-mix(in srgb, ${scoreColor(session.score_total)} 10%, transparent)`
                          : "var(--bg-secondary)",
                        border: `2px solid ${session.score_total != null ? scoreColor(session.score_total) : "var(--border-color)"}`,
                      }}
                    >
                      <span
                        className="text-sm font-bold t-data"
                        style={{ color: session.score_total != null ? scoreColor(session.score_total) : "var(--text-muted)" }}
                      >
                        {session.score_total != null ? Math.round(session.score_total) : "--"}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {session.status === "completed" ? "Завершена" : session.status === "in_progress" ? "В процессе" : session.status}
                      </div>
                      <div className="t-caption mt-0.5 flex items-center gap-3">
                        {session.started_at && <span>{formatDate(session.started_at)}</span>}
                        {session.duration_seconds != null && session.duration_seconds > 0 && (
                          <span>{formatDuration(session.duration_seconds)}</span>
                        )}
                      </div>
                    </div>

                    {session.status === "completed" && (
                      <ArrowRight size={16} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* ── RECOMMENDED SCENARIOS ──────────────────────────────── */}
          {!loading && recommendations.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="t-section-title" style={{ fontSize: "var(--fs-lg)" }}>Рекомендуемые сценарии</h2>
                <Link
                  href="/training"
                  className="t-label flex items-center gap-1 no-underline"
                  style={{ color: "var(--ocean)" }}
                >
                  Все сценарии <ArrowRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.slice(0, 3).map((rec, i) => {
                  const diffColor =
                    rec.difficulty >= 7
                      ? "var(--danger)"
                      : rec.difficulty >= 4
                      ? "var(--warning)"
                      : "var(--success)";
                  return (
                    <motion.div
                      key={rec.scenario_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.06, duration: 0.3 }}
                      className="lh-card glass-panel-interactive p-5 group"
                      onClick={async () => {
                        try {
                          const session = await api.post(
                            "/training/sessions",
                            {
                              scenario_id: rec.scenario_id,
                              mode: "chat",
                              runtime_type: "training_simulation",
                            },
                          );
                          router.push(`/training/${session.id}`);
                        } catch (err) {
                          logger.error("Failed to start training session:", err);
                          if (
                            err instanceof ApiError &&
                            err.status === 409 &&
                            err.detail?.code === "profile_incomplete"
                          ) {
                            router.push("/home");
                            return;
                          }
                          useNotificationStore.getState().addToast({
                            title: "Ошибка",
                            body: "Не удалось начать тренировку",
                            type: "error",
                          });
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="badge badge-accent">{rec.archetype}</span>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, j) => (
                            <div
                              key={j}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                background:
                                  j < Math.ceil(rec.difficulty / 2)
                                    ? diffColor
                                    : "var(--bg-tertiary)",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div
                        className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[var(--primary)] transition-colors"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {rec.title}
                      </div>
                      {rec.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {rec.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: "var(--bg-secondary)",
                                color: "var(--text-muted)",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-medium" style={{ color: "var(--primary)" }}>Начать</span>
                        <ArrowRight size={12} style={{ color: "var(--primary)" }} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* ── ASSIGNED TRAININGS ─────────────────────────────────── */}
          <AssignedBadge />

          {/* ── LOADING STATE ──────────────────────────────────────── */}
          {loading && (
            <div className="space-y-4 stagger-cascade">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="lh-card p-5 space-y-3">
                    <div className="h-9 w-9 rounded-xl skeleton-shimmer" />
                    <div className="h-8 w-16 rounded-lg skeleton-shimmer" />
                    <div className="h-3 w-12 rounded skeleton-shimmer" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="lh-card p-5 space-y-3">
                    <div className="h-4 w-20 rounded-full skeleton-shimmer" />
                    <div className="h-5 w-3/4 rounded-lg skeleton-shimmer" />
                    <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}


/* ─── Stat Card ───────────────────────────────────────────────────────── */

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentColor: string;
}

function StatCard({ label, value, icon, accentColor }: StatCardProps) {
  return (
    <div
      className="lh-card p-5"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}
        >
          {icon}
        </div>
      </div>
      <div
        className="text-2xl font-bold t-data"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
      <div className="t-label mt-1">{label}</div>
    </div>
  );
}


/* ─── Assigned Trainings Badge ─────────────────────────────────────────── */

function AssignedBadge() {
  const router = useRouter();
  const { assigned, assignedLoading, fetchAssigned } = useTrainingStore();

  useEffect(() => {
    fetchAssigned();
  }, [fetchAssigned]);

  if (assignedLoading || assigned.length === 0) return null;

  const now = new Date();
  const overdueCount = assigned.filter((a) => a.deadline && new Date(a.deadline) < now).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 lh-card glass-panel-interactive p-4 flex items-center gap-4"
      style={{
        borderLeft: overdueCount > 0 ? "3px solid var(--danger)" : "3px solid var(--primary)",
      }}
      onClick={() => router.push("/training?tab=assigned")}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: overdueCount > 0 ? "var(--danger-muted)" : "var(--primary-muted)" }}
      >
        <ClipboardText weight="duotone" size={18} style={{ color: overdueCount > 0 ? "var(--danger)" : "var(--primary)" }} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Назначенные тренировки
        </div>
        <div className="t-caption mt-0.5">
          {assigned.length} {assigned.length === 1 ? "сценарий" : assigned.length < 5 ? "сценария" : "сценариев"}
          {overdueCount > 0 && (
            <span style={{ color: "var(--danger)", fontWeight: 600 }}>
              {" "} · {overdueCount} просрочено!
            </span>
          )}
        </div>
      </div>
      <span
        className="min-w-[24px] h-6 flex items-center justify-center rounded-full text-xs font-bold text-white px-1.5"
        style={{ background: overdueCount > 0 ? "var(--danger)" : "var(--primary)" }}
      >
        {assigned.length}
      </span>
      <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
    </motion.div>
  );
}
