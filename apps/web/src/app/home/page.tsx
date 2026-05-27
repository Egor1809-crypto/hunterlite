"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Loader2, Phone, Clock, BookOpen, BarChart3,
  MessageSquare, Trophy, Briefcase, GraduationCap, Award,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import AuthLayout from "@/components/layout/AuthLayout";
import type { DashboardManager } from "@/types";
import { scoreColor } from "@/lib/utils";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { logger } from "@/lib/logger";

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
      .catch(() => {})
      .finally(() => setWaitingClientLoaded(true));
  };

  useEffect(() => { fetchDashboard(); }, [user]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchDashboard();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchDashboard();
    }, 60_000);
    return () => clearInterval(id);
  }, [user]);

  const recommendations = dashboard?.recommendations ?? [];
  const recentSessions = dashboard?.recent_sessions ?? [];
  const stats = dashboard?.stats ?? null;
  const firstName = user?.full_name?.split(" ")[0] || "Пользователь";

  const quickStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
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
            try {
              const { client } = await api.get<{ client: typeof waitingClient }>("/home/waiting-client");
              setWaitingClient(client);
            } catch {}
            setStarting(false);
            return;
          }
          throw err;
        }
      }
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
      if (err instanceof ApiError && err.status === 409 && err.detail?.code === "profile_incomplete") {
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

  const statusLabel = (s: string) => {
    switch (s) {
      case "completed": return "Завершена";
      case "in_progress": return "В процессе";
      case "error": return "Прервана";
      case "cancelled": return "Отменена";
      default: return "Сессия";
    }
  };

  return (
    <AuthLayout>
      <div className="min-h-screen relative overflow-hidden" style={{ background: "var(--bg-primary)" }}>

        {/* ── Ambient background orbs ──────────────────────── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.04]"
            style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-[50%] -left-48 w-[450px] h-[450px] rounded-full opacity-[0.025]"
            style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 py-8 sm:py-12">

          {/* ── Hero welcome ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-10"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-muted)" }}>
              {getTimeGreeting()}
            </p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1] text-gradient-hero">
              {firstName}
            </h1>
            <div
              className="mt-3 h-[2px] w-16 rounded-full"
              style={{ background: "linear-gradient(90deg, #2563EB, transparent)" }}
            />
          </motion.div>

          {/* ── Incoming call card ────────────────────────────── */}
          {waitingClient && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-2xl p-6 sm:p-8 mb-8 overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, #059669 0%, #047857 50%, #065F46 100%)",
                boxShadow: "0 12px 40px rgba(5, 150, 105, 0.3), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              {/* Animated shimmer */}
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                  backgroundSize: "20px 20px",
                }}
              />
              <div
                className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)" }}
              />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-xl bg-white/20" />
                    <Phone size={18} strokeWidth={2.5} className="relative text-white" />
                  </span>
                  <span className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em]">
                    Входящий звонок
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white mb-3 tracking-tight">{waitingClient.full_name}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 text-white backdrop-blur-sm border border-white/10">
                        {waitingClient.city}
                      </span>
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white/70 border border-white/5">
                        Долг: {(waitingClient.total_debt / 1000).toFixed(0)}K ₽
                      </span>
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white/70 border border-white/5">
                        {"★".repeat(Math.min(waitingClient.difficulty, 5))}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={quickStart}
                    disabled={starting}
                    className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-sm font-black transition-all duration-300 shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.95)",
                      color: "#047857",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,1)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.25)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,1)"; }}
                  >
                    {starting
                      ? <Loader2 size={16} className="animate-spin" />
                      : <><Phone size={16} /> Ответить</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Stats row ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"
          >
            {!loading && stats ? (
              <>
                <StatCard label="Сессий" value={String(stats.completed_sessions ?? 0)} icon={<BarChart3 size={16} />} color="#2563EB" idx={0} />
                <StatCard label="Ср. балл" value={String(stats.avg_score != null ? Math.round(stats.avg_score) : 0)} icon={<Trophy size={16} />} color={scoreColor(stats.avg_score ?? null)} idx={1} />
                <StatCard label="Лучший" value={String(stats.best_score != null ? Math.round(stats.best_score) : 0)} icon={<Trophy size={16} />} color={scoreColor(stats.best_score ?? null)} idx={2} />
                <StatCard label="За неделю" value={String(stats.sessions_this_week ?? 0)} icon={<Clock size={16} />} color="#8B5CF6" idx={3} />
              </>
            ) : loading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}>
                    <div className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "var(--bg-tertiary)" }} />
                    <div className="h-3 w-12 rounded animate-pulse" style={{ background: "var(--bg-tertiary)" }} />
                  </div>
                ))}
              </>
            ) : null}
          </motion.div>

          {/* ── Navigation cards ──────────────────────────────── */}
          {/* ── CPD Progress Banner ────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(139,92,246,0.04) 100%)",
              border: "1px solid rgba(37,99,235,0.12)",
            }}
          >
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(37,99,235,0.12)", color: "#2563EB" }}
                >
                  <Award size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: "#2563EB" }}>
                    Повышение квалификации
                  </div>
                  <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>0</span> из 24 ак. часов набрано в этом году
                  </div>
                </div>
              </div>
              <div className="flex-1 max-w-[280px]">
                <div className="flex justify-between text-[10px] font-semibold mb-1">
                  <span style={{ color: "var(--text-muted)" }}>Прогресс</span>
                  <span style={{ color: "#2563EB" }}>0%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: "0%", background: "linear-gradient(90deg, #2563EB, #8B5CF6)" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Navigation cards ──────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10"
          >
            <NavCard
              href="/training"
              icon={<MessageSquare size={22} />}
              title="Обучение"
              subtitle="AI-тренировки"
              color="#2563EB"
              onClick={waitingClientLoaded && !waitingClient ? quickStart : undefined}
              loading={starting && !waitingClient}
              idx={0}
            />
            <NavCard
              href="/cases"
              icon={<Briefcase size={22} />}
              title="Кейсы"
              subtitle="Разбор ситуаций"
              color="#8B5CF6"
              idx={1}
            />
            <NavCard
              href="/exam"
              icon={<GraduationCap size={22} />}
              title="Экзамен"
              subtitle="Сертификация"
              color="#F59E0B"
              idx={2}
            />
            <NavCard
              href="/knowledge"
              icon={<BookOpen size={22} />}
              title="База знаний"
              subtitle="127-ФЗ справочник"
              color="#10B981"
              idx={3}
            />
          </motion.div>

          {/* ── Competency Radar + Daily Challenge ─────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10"
          >
            {/* Competency Spider */}
            <div
              className="rounded-2xl p-5 sm:p-6"
              style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                Карта компетенций
              </h3>
              <div className="flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full max-w-[220px]">
                  {/* Grid circles */}
                  {[20, 40, 60, 80].map((r) => (
                    <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.5" />
                  ))}
                  {/* Axis lines */}
                  {[0, 60, 120, 180, 240, 300].map((angle) => {
                    const rad = (angle * Math.PI) / 180;
                    const x2 = 100 + 80 * Math.cos(rad - Math.PI / 2);
                    const y2 = 100 + 80 * Math.sin(rad - Math.PI / 2);
                    return <line key={angle} x1="100" y1="100" x2={x2} y2={y2} stroke="var(--border-color)" strokeWidth="0.5" opacity="0.5" />;
                  })}
                  {/* Data polygon — placeholder scores */}
                  {(() => {
                    const scores = [45, 60, 35, 55, 40, 50]; // placeholder competency scores
                    const labels = ["Скрипт", "Возражения", "Коммуникация", "Закрытие", "Анализ", "Право"];
                    const points = scores.map((s, i) => {
                      const angle = (i * 60 * Math.PI) / 180 - Math.PI / 2;
                      const r = (s / 100) * 80;
                      return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`;
                    }).join(" ");
                    return (
                      <>
                        <polygon
                          points={points}
                          fill="rgba(37, 99, 235, 0.12)"
                          stroke="#2563EB"
                          strokeWidth="1.5"
                        />
                        {scores.map((s, i) => {
                          const angle = (i * 60 * Math.PI) / 180 - Math.PI / 2;
                          const r = (s / 100) * 80;
                          return (
                            <circle
                              key={i}
                              cx={100 + r * Math.cos(angle)}
                              cy={100 + r * Math.sin(angle)}
                              r="3"
                              fill="#2563EB"
                            />
                          );
                        })}
                        {labels.map((label, i) => {
                          const angle = (i * 60 * Math.PI) / 180 - Math.PI / 2;
                          const lx = 100 + 95 * Math.cos(angle);
                          const ly = 100 + 95 * Math.sin(angle);
                          return (
                            <text
                              key={i}
                              x={lx}
                              y={ly}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="var(--text-muted)"
                              fontSize="8"
                              fontWeight="600"
                            >
                              {label}
                            </text>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
              <p className="text-xs text-center mt-3" style={{ color: "var(--text-muted)" }}>
                Данные обновляются после каждой сессии
              </p>
            </div>

            {/* Daily Challenge */}
            <div
              className="rounded-2xl p-5 sm:p-6 flex flex-col"
              style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                Ежедневная разминка
              </h3>
              <div className="flex-1 flex flex-col gap-3">
                {[
                  {
                    title: "Быстрый тест",
                    desc: "5 вопросов по ФЗ-127 за 3 минуты",
                    color: "#2563EB",
                    href: "/exam",
                    time: "~3 мин",
                  },
                  {
                    title: "Мини-кейс",
                    desc: "Разберите одну ситуацию из практики",
                    color: "#8B5CF6",
                    href: "/cases",
                    time: "~10 мин",
                  },
                  {
                    title: "Тренировочный звонок",
                    desc: "Один звонок с AI-клиентом средней сложности",
                    color: "#10B981",
                    href: "/training",
                    time: "~15 мин",
                  },
                ].map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl p-3 transition-all duration-200 no-underline"
                    style={{ background: "var(--bg-tertiary)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `color-mix(in srgb, ${item.color} 8%, var(--bg-tertiary))`;
                      e.currentTarget.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--bg-tertiary)";
                      e.currentTarget.style.transform = "translateX(0)";
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)`, color: item.color }}
                    >
                      <ArrowRight size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {item.title}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {item.desc}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium shrink-0" style={{ color: "var(--text-muted)" }}>
                      {item.time}
                    </span>
                  </Link>
                ))}
              </div>
              <div
                className="mt-4 pt-3 text-center"
                style={{ borderTop: "1px solid var(--border-color)" }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Серия: 0 дней подряд
                </span>
              </div>
            </div>
          </motion.div>

          {/* ── Recent sessions ───────────────────────────────── */}
          {!loading && recentSessions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
              className="mb-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                  Последние сессии
                </h2>
                <Link
                  href="/history"
                  className="text-xs font-semibold flex items-center gap-1 no-underline transition-colors hover:opacity-80"
                  style={{ color: "#2563EB" }}
                >
                  Все <ArrowRight size={12} />
                </Link>
              </div>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}
              >
                {recentSessions.slice(0, 5).map((session, idx) => {
                  const sc = session.score_total != null ? scoreColor(session.score_total) : null;
                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        if (session.status === "completed" && session.score_total !== null) {
                          router.push(`/results/${session.id}`);
                        }
                      }}
                      className="flex items-center gap-4 px-5 py-4 transition-all duration-200"
                      style={{
                        borderBottom: idx < Math.min(recentSessions.length, 5) - 1 ? "1px solid var(--border-color)" : "none",
                        cursor: session.status === "completed" ? "pointer" : "default",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-card-hover)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black tabular-nums"
                        style={{
                          background: sc
                            ? `color-mix(in srgb, ${sc} 12%, transparent)`
                            : "var(--bg-tertiary)",
                          color: sc || "var(--text-muted)",
                          boxShadow: sc ? `0 0 0 1px color-mix(in srgb, ${sc} 20%, transparent)` : "none",
                        }}
                      >
                        {session.score_total != null ? Math.round(session.score_total) : "--"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {statusLabel(session.status)}
                        </div>
                        <div className="text-xs mt-0.5 flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
                          {session.started_at && <span>{formatDate(session.started_at)}</span>}
                          {session.duration_seconds != null && session.duration_seconds > 0 && (
                            <span>{formatDuration(session.duration_seconds)}</span>
                          )}
                        </div>
                      </div>

                      {session.status === "completed" && (
                        <ArrowRight size={14} className="shrink-0 transition-transform duration-200 group-hover:translate-x-1" style={{ color: "var(--text-muted)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Recommended scenarios ─────────────────────────── */}
          {!loading && recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                  Рекомендуемые сценарии
                </h2>
                <Link
                  href="/training"
                  className="text-xs font-semibold flex items-center gap-1 no-underline transition-colors hover:opacity-80"
                  style={{ color: "#2563EB" }}
                >
                  Все сценарии <ArrowRight size={12} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendations.slice(0, 3).map((rec, i) => {
                  const diffColor =
                    rec.difficulty >= 7 ? "var(--danger)"
                    : rec.difficulty >= 4 ? "var(--warning)"
                    : "var(--success)";
                  return (
                    <motion.div
                      key={rec.scenario_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18 + i * 0.06, duration: 0.3 }}
                      className="group rounded-xl p-5 transition-all duration-200 cursor-pointer"
                      style={{
                        background: "var(--surface-card)",
                        border: "1px solid var(--border-color)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-hover)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "var(--shadow-md)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-color)";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      onClick={async () => {
                        try {
                          const session = await api.post("/training/sessions", {
                            scenario_id: rec.scenario_id,
                            mode: "chat",
                            runtime_type: "training_simulation",
                          });
                          router.push(`/training/${session.id}`);
                        } catch (err) {
                          if (err instanceof ApiError && err.status === 409 && err.detail?.code === "profile_incomplete") {
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
                        <span
                          className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide"
                          style={{
                            background: "var(--primary-muted)",
                            color: "var(--primary)",
                          }}
                        >
                          {rec.archetype}
                        </span>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, j) => (
                            <div
                              key={j}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                background: j < Math.ceil(rec.difficulty / 2)
                                  ? diffColor : "var(--bg-tertiary)",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div
                        className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#2563EB] transition-colors"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {rec.title}
                      </div>
                      {rec.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {rec.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] px-2 py-0.5 rounded-md"
                              style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-bold" style={{ color: "#2563EB" }}>Начать</span>
                        <ArrowRight size={12} style={{ color: "#2563EB" }} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}


/* ── Stat Card ─────────────────────────────────────────────── */

function StatCard({ label, value, color, icon, idx }: { label: string; value: string; color: string; icon: React.ReactNode; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 + idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all duration-300"
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-color)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 30%, transparent)`;
        e.currentTarget.style.boxShadow = `0 4px 20px color-mix(in srgb, ${color} 8%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-color)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Subtle colored glow in corner */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${color} 15%, transparent) 0%, transparent 70%)` }}
      />

      <div className="relative z-10">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
          style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
        >
          {icon}
        </div>
        <div
          className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </div>
        <div className="text-[10px] font-bold mt-1 uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
          {label}
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${color}, transparent 80%)` }}
      />
    </motion.div>
  );
}


/* ── Nav Card ──────────────────────────────────────────────── */

function NavCard({
  href, icon, title, subtitle, color, onClick, loading: isLoading, idx,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  onClick?: () => void;
  loading?: boolean;
  idx: number;
}) {
  const Wrapper = onClick ? "button" : Link;
  const props = onClick
    ? { onClick, disabled: isLoading }
    : { href };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 + idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* @ts-expect-error -- dynamic wrapper element */}
      <Wrapper
        {...props}
        className="group flex flex-col rounded-2xl p-5 sm:p-6 transition-all duration-300 no-underline text-left relative overflow-hidden h-full"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border-color)",
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
          e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 40%, transparent)`;
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = `0 12px 32px color-mix(in srgb, ${color} 12%, transparent)`;
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
          e.currentTarget.style.borderColor = "var(--border-color)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Hover glow orb */}
        <div
          className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `radial-gradient(circle, color-mix(in srgb, ${color} 18%, transparent) 0%, transparent 70%)` }}
        />

        <div className="relative z-10">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
            style={{
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
              color,
              boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 15%, transparent)`,
            }}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : icon}
          </div>
          <div className="text-[15px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {title}
          </div>
          <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </div>

          <div className="mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-4px] group-hover:translate-x-0">
            <ArrowRight size={14} style={{ color }} />
          </div>
        </div>

        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `linear-gradient(90deg, ${color}, transparent 80%)` }}
        />
      </Wrapper>
    </motion.div>
  );
}
