"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleGauge,
  FolderOpen,
  LibraryBig,
  ListChecks,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import { api, ApiError } from "@/lib/api";
import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationStore } from "@/stores/useNotificationStore";

type LearningPathProgress = {
  overall_percent: number;
  progress: Record<string, number>;
  streak: {
    current: number;
    best: number;
    today_completed: boolean;
  };
  stats: {
    total_sessions: number;
    total_hours: number;
    average_score: number;
    best_score: number;
    this_week_sessions: number;
    certificates_earned: number;
  };
};

type Recommendation = {
  type: string;
  title: string;
  description: string;
  action_url: string;
  action_label: string;
};

type WaitingClient = {
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
};

const stages = [
  { key: "knowledge", title: "Знания", href: "/knowledge", icon: LibraryBig },
  { key: "tests", title: "Тесты", href: "/training", icon: ListChecks },
  { key: "cases", title: "Кейсы", href: "/cases", icon: FolderOpen },
  { key: "exams", title: "Экзамены", href: "/exam", icon: BadgeCheck },
  { key: "practice", title: "Практика", href: "/training", icon: MessageCircle },
];

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 17) return "Добрый день";
  if (h >= 17 && h < 22) return "Добрый вечер";
  return "Доброй ночи";
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [learningPath, setLearningPath] = useState<LearningPathProgress | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [waitingClient, setWaitingClient] = useState<WaitingClient | null>(null);

  const fetchData = useCallback(() => {
    if (!user) return;
    setLoading(true);

    api.get<LearningPathProgress>("/learning-path/progress")
      .then(setLearningPath)
      .catch((err) => logger.error("Failed to load learning path:", err))
      .finally(() => setLoading(false));

    api.get<{ client: WaitingClient | null }>("/home/waiting-client")
      .then((data) => setWaitingClient(data.client))
      .catch(() => {});

    api.get<{ recommendations: Recommendation[] }>("/learning-path/recommendations")
      .then((data) => setRecommendations(data.recommendations || []))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchData]);

  const quickStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      if (waitingClient) {
        const session = await api.post("/home/start", {});
        if (session?.id) {
          router.push(`/training/${session.id}`);
          return;
        }
      }

      const scenariosData = await api.get("/scenarios/");
      const scenarios: { id: string }[] = Array.isArray(scenariosData) ? scenariosData : [];
      if (!scenarios.length) {
        useNotificationStore.getState().addToast({
          title: "Нет активных сценариев",
          body: "Сначала заполните базу сценариев.",
          type: "error",
        });
        return;
      }

      const scenarioId = scenarios[Math.floor(Math.random() * scenarios.length)].id;
      const session = await api.post("/training/sessions", {
        scenario_id: scenarioId,
        mode: "chat",
        runtime_type: "training_simulation",
      });
      if (!session?.id) throw new Error("Invalid session response");
      router.push(`/training/${session.id}`);
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
    } finally {
      setStarting(false);
    }
  };

  const firstName = user?.full_name?.split(" ")[0] || "Пользователь";
  const progress = learningPath?.progress || {};
  const stats = learningPath?.stats;
  const overallPercent = learningPath?.overall_percent ?? 0;
  const activeStageIndex = stages.findIndex((stage) => (progress[stage.key] ?? 0) < 100);
  const activeStage = activeStageIndex === -1 ? stages.length - 1 : activeStageIndex;
  const primaryRecommendation = recommendations[0];

  return (
    <AuthLayout>
      <main className="min-h-screen bg-[var(--bg-primary)] px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1180px]">
          <motion.header
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid gap-6 lg:grid-cols-[1fr_320px]"
          >
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-logo-hunter)]">
                {getTimeGreeting()}
              </p>
              <h1 className="max-w-3xl text-[clamp(3.5rem,8vw,7.5rem)] font-semibold leading-[0.84] tracking-[-0.075em] text-[var(--text-primary)]">
                {firstName}
              </h1>
              <p className="mt-5 max-w-2xl text-xl leading-snug text-[var(--brand-logo-hunter)]">
                Кабинет профессионального роста: обучение, практика, кейсы и аттестация в одной траектории.
              </p>
            </div>

            <div className="rounded-[28px] border border-[var(--border-color)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-md)]">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Общий прогресс</p>
              <div className="mt-8 flex items-end gap-3">
                <span className="text-6xl font-semibold leading-none tracking-[-0.08em] text-[var(--brand-logo-hunter)]">
                  {loading ? "..." : `${overallPercent}%`}
                </span>
                <span className="pb-2 text-sm text-[var(--text-muted)]">программы</span>
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                <div
                  className="h-full rounded-full bg-[var(--brand-logo-hunter)]"
                  style={{ width: `${Math.min(100, Math.max(0, overallPercent))}%` }}
                />
              </div>
            </div>
          </motion.header>

          <section className="mb-8 rounded-[32px] border border-[var(--border-color)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)] sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand-logo-hunter)]">
                  Путь к квалификации
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                  5 шагов до уверенной практики
                </h2>
              </div>
              <span className="hidden rounded-full border border-[var(--border-color)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] sm:inline-flex">
                {activeStage + 1}/5 шаг
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                const value = progress[stage.key] ?? 0;
                const isActive = index === activeStage;
                const done = value >= 100;
                return (
                  <Link
                    key={stage.key}
                    href={stage.href}
                    className="rounded-[24px] border p-5 no-underline transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                    style={{
                      borderColor: isActive ? "var(--brand-logo-hunter)" : "var(--border-color)",
                      background: isActive ? "color-mix(in srgb, var(--brand-logo-hunter) 9%, var(--surface-card))" : "var(--surface-card)",
                    }}
                  >
                    <div className="mb-7 flex items-center justify-between">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                        style={{
                          borderColor: done ? "var(--success)" : "var(--border-color)",
                          color: done ? "var(--success)" : "var(--brand-logo-hunter)",
                          background: "var(--bg-secondary)",
                        }}
                      >
                          {done ? <CheckCircle2 size={20} strokeWidth={1.75} /> : <Icon size={20} strokeWidth={1.75} />}
                      </span>
                      <span className="text-sm font-semibold text-[var(--text-muted)]">{value}%</span>
                    </div>
                    <h3 className="text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{stage.title}</h3>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                      <div className="h-full rounded-full bg-[var(--brand-logo-hunter)]" style={{ width: `${value}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mb-8 grid gap-4 lg:grid-cols-3">
            <ActionCard
              title={waitingClient ? "Входящий клиент" : "Тренировочный клиент"}
              text={waitingClient ? `${waitingClient.full_name}, ${waitingClient.city}. Долг ${(waitingClient.total_debt / 1000).toFixed(0)} тыс. ₽` : "Запустите короткую консультацию с AI-клиентом."}
              icon={<MessageCircle size={22} strokeWidth={1.75} />}
              action={starting ? "Запускаем..." : "Начать"}
              onClick={quickStart}
              disabled={starting}
            />
            <ActionCard
              title="Тест по теме"
              text="Проверьте знания в спокойном формате без лишнего визуального шума."
              icon={<ListChecks size={22} strokeWidth={1.75} />}
              href="/training"
              action="Открыть тесты"
            />
            <ActionCard
              title="Разбор кейса"
              text="Практическое дело с решениями, последствиями и экспертным отчётом."
              icon={<FolderOpen size={22} strokeWidth={1.75} />}
              href="/cases"
              action="К кейсам"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Сессий" value={stats?.total_sessions ?? 0} icon={<CircleGauge size={18} strokeWidth={1.75} />} />
              <MetricCard label="Средний балл" value={stats?.average_score ?? 0} icon={<ListChecks size={18} strokeWidth={1.75} />} />
              <MetricCard label="Лучший результат" value={stats?.best_score ?? 0} icon={<Award size={18} strokeWidth={1.75} />} />
              <MetricCard label="За неделю" value={stats?.this_week_sessions ?? 0} icon={<CalendarDays size={18} strokeWidth={1.75} />} />
            </div>

            <aside className="rounded-[28px] border border-[var(--border-color)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-logo-hunter)] text-white">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              </div>
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand-logo-hunter)]">
                Следующий шаг
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                {primaryRecommendation?.title || "Продолжить обучение"}
              </h2>
              <p className="mt-4 text-base leading-snug text-[var(--text-secondary)]">
                {primaryRecommendation?.description || "Закрепите материал через тест или короткий практический кейс."}
              </p>
              <Link
                href={primaryRecommendation?.action_url || "/training"}
                className="mt-8 inline-flex w-full items-center justify-between rounded-full bg-[var(--text-primary)] px-5 py-4 text-sm font-semibold text-white no-underline transition hover:bg-[var(--brand-logo-hunter)]"
              >
                {primaryRecommendation?.action_label || "Перейти"}
                <ArrowRight size={18} />
              </Link>
            </aside>
          </section>
        </div>
      </main>
    </AuthLayout>
  );
}

function ActionCard({
  title,
  text,
  icon,
  action,
  href,
  onClick,
  disabled,
}: {
  title: string;
  text: string;
  icon: ReactNode;
  action: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--brand-logo-hunter)]">
          {icon}
        </span>
        <ArrowRight size={18} className="text-[var(--text-muted)]" />
      </div>
      <h3 className="mt-8 text-3xl font-semibold tracking-[-0.055em] text-[var(--text-primary)]">{title}</h3>
      <p className="mt-3 min-h-[48px] text-base leading-snug text-[var(--text-secondary)]">{text}</p>
      <div className="mt-8 text-sm font-semibold text-[var(--brand-logo-hunter)]">{action}</div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-[28px] border border-[var(--border-color)] bg-[var(--surface-card)] p-6 no-underline shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[var(--brand-logo-hunter)] hover:shadow-[var(--shadow-md)]"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[28px] border border-[var(--border-color)] bg-[var(--surface-card)] p-6 text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[var(--brand-logo-hunter)] hover:shadow-[var(--shadow-md)] disabled:cursor-wait disabled:opacity-70"
    >
      {content}
    </button>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-[var(--border-color)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--bg-secondary)] text-[var(--brand-logo-hunter)]">
          {icon}
        </span>
        <span className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</span>
      </div>
      <div className="mt-8 text-5xl font-semibold tracking-[-0.07em] text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
