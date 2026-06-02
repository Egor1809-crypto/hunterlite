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
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

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
        // Был мёртвый push("/home") (текущая страница — no-op). Ведём в настройки,
        // где профиль реально дозаполняется, и объясняем причину.
        useNotificationStore.getState().addToast({
          title: "Профиль не заполнен",
          body: "Завершите настройку профиля в разделе «Настройки», чтобы начать тренировку.",
          type: "error",
        });
        router.push("/settings");
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
      <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12" style={{ background: "var(--bg-primary)" }}>
        <div className="mx-auto max-w-[1180px]">
          {/* ── Masthead ── */}
          <motion.header
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="mb-12 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end"
          >
            <div>
              <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
                {getTimeGreeting()}
              </p>
              <h1 className="max-w-3xl font-semibold leading-[0.86] tracking-[-0.07em]" style={{ color: "var(--text-primary)", fontSize: "clamp(3.25rem, 7vw, 6rem)" }}>
                {firstName}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-snug" style={{ color: "var(--text-secondary)" }}>
                Обучение, практика, кейсы и аттестация — в одной траектории.
              </p>
            </div>

            <Card accentTop className="lg:self-stretch">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                Общий прогресс
              </p>
              <div className="mt-6 flex items-end gap-2">
                <span className="font-mono text-[56px] font-semibold leading-none tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {loading ? "—" : overallPercent}
                </span>
                <span className="pb-2 text-sm" style={{ color: "var(--text-muted)" }}>% программы</span>
              </div>
              <div className="mt-5 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--border-color)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--primary)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, overallPercent))}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </Card>
          </motion.header>

          {/* ── Путь к квалификации ── */}
          <section className="mb-12">
            <SectionHeader
              code="01 · ПУТЬ"
              title="Пять шагов до уверенной практики"
              right={
                <span className="hidden font-mono text-[12px] font-semibold tabular-nums sm:inline-flex" style={{ color: "var(--text-muted)" }}>
                  ШАГ {activeStage + 1}/5
                </span>
              }
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                const value = progress[stage.key] ?? 0;
                const isActive = index === activeStage;
                const done = value >= 100;
                return (
                  <Link key={stage.key} href={stage.href} className="block no-underline">
                    <Card
                      variant="interactive"
                      accentTop={isActive}
                      style={{
                        borderColor: isActive ? "var(--primary)" : "var(--border-color)",
                        background: isActive ? "var(--primary-muted)" : "var(--surface-card)",
                        height: "100%",
                      }}
                    >
                      <div className="mb-7 flex items-center justify-between">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{
                            border: `1px solid ${done ? "var(--success)" : "var(--border-color)"}`,
                            color: done ? "var(--success)" : "var(--primary)",
                            background: "var(--bg-secondary)",
                          }}
                        >
                          {done ? <CheckCircle2 size={18} strokeWidth={1.75} /> : <Icon size={18} strokeWidth={1.75} />}
                        </span>
                        <span className="font-mono text-[12px] font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>{value}%</span>
                      </div>
                      <h3 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>{stage.title}</h3>
                      <div className="mt-4 h-1 overflow-hidden rounded-full" style={{ background: "var(--border-color)" }}>
                        <div className="h-full rounded-full" style={{ width: `${value}%`, background: "var(--primary)" }} />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ── Действия ── */}
          <section className="mb-12 grid gap-4 lg:grid-cols-3">
            <ActionCard
              title={waitingClient ? "Входящий клиент" : "Тренировочный клиент"}
              text={waitingClient ? `${waitingClient.full_name}, ${waitingClient.city}. Долг ${(waitingClient.total_debt / 1000).toFixed(0)} тыс. ₽` : "Короткая консультация с AI-клиентом."}
              icon={<MessageCircle size={22} strokeWidth={1.75} />}
              action={starting ? "Запускаем…" : "Начать"}
              onClick={quickStart}
              disabled={starting}
            />
            <ActionCard
              title="Тест по теме"
              text="Спокойная проверка знаний — без лишнего визуального шума."
              icon={<ListChecks size={22} strokeWidth={1.75} />}
              href="/training"
              action="Открыть тесты"
            />
            <ActionCard
              title="Разбор кейса"
              text="Дело с решениями, последствиями и экспертным отчётом."
              icon={<FolderOpen size={22} strokeWidth={1.75} />}
              href="/cases"
              action="К кейсам"
            />
          </section>

          {/* ── Метрики + Следующий шаг ── */}
          <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Сессий" value={stats?.total_sessions ?? 0} loading={loading} icon={<CircleGauge size={18} strokeWidth={1.75} />} />
              <MetricCard label="Средний балл" value={stats?.average_score ?? 0} suffix="%" loading={loading} icon={<ListChecks size={18} strokeWidth={1.75} />} />
              <MetricCard label="Лучший результат" value={stats?.best_score ?? 0} suffix="%" loading={loading} icon={<Award size={18} strokeWidth={1.75} />} />
              <MetricCard label="За неделю" value={stats?.this_week_sessions ?? 0} loading={loading} icon={<CalendarDays size={18} strokeWidth={1.75} />} />
            </div>

            <Card accentTop className="flex flex-col">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ background: "var(--primary)" }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              </div>
              <p className="mt-7 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                Следующий шаг
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {primaryRecommendation?.title || "Продолжить обучение"}
              </h2>
              <p className="mt-3 flex-1 text-[15px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                {primaryRecommendation?.description || "Закрепите материал тестом или коротким кейсом."}
              </p>
              <Button
                href={primaryRecommendation?.action_url || "/training"}
                variant="primary"
                fluid
                iconRight={<ArrowRight size={16} />}
                className="mt-7"
              >
                {primaryRecommendation?.action_label || "Перейти"}
              </Button>
            </Card>
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
  const inner = (
    <>
      <div className="flex items-start justify-between gap-4">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--primary)" }}
        >
          {icon}
        </span>
        <ArrowRight size={18} style={{ color: "var(--text-muted)" }} />
      </div>
      <h3 className="mt-7 text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="mt-2 text-[15px] leading-snug" style={{ color: "var(--text-secondary)" }}>{text}</p>
      <div className="mt-6 text-sm font-semibold" style={{ color: "var(--primary)" }}>{action}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        <Card variant="interactive" style={{ height: "100%" }}>{inner}</Card>
      </Link>
    );
  }

  return (
    <Card
      variant="interactive"
      onClick={onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{ height: "100%", opacity: disabled ? 0.7 : 1, cursor: disabled ? "wait" : "pointer" }}
    >
      {inner}
    </Card>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  loading,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  loading?: boolean;
  icon: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--bg-secondary)", color: "var(--primary)" }}
        >
          {icon}
        </span>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div className="mt-7 font-mono text-[44px] font-semibold leading-none tabular-nums" style={{ color: "var(--text-primary)" }}>
        {loading ? <Skeleton width={64} height={40} rounded="8px" /> : <>{value}{suffix ?? ""}</>}
      </div>
    </Card>
  );
}
