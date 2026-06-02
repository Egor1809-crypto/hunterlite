"use client";

/**
 * /profile — «★ ПРОФИЛЬ ОХОТНИКА ★» (аркадный редизайн 2026-05-08).
 *
 * Что изменилось vs прошлой версии:
 *   - убран скучный H1 «ПРОФИЛЬ» — теперь пиксельный сяющий лого
 *     (тот же effect что на /leaderboard «ЗАЛ СЛАВЫ», но в фиолет-
 *     зелёном градиенте чтобы отличался)
 *   - подзаголовок-метрики «УР. 15 · 123 008 XP · СЕЗОН I»
 *   - добавлен ActivityHeatmap — GitHub-style daily heatmap за
 *     180 дней + streak counters (источник: новый GET /users/me/activity)
 *   - все блоки обёрнуты в пиксельные `<ProfileSection>` с акцентной
 *     рамкой по теме секции (цвет HUD-блока) — единый ритм
 *   - смена пароля — accordion-блок «ПЕРЕВЫПУСТИТЬ КЛЮЧ» внизу,
 *     не доминирует
 *
 * НЕ ТРОГАЛ:
 *   - HunterCard (там и так пиксель), ProgressGraph, OfficeShelf,
 *     DealPortfolio — оставлены как есть, обёрнуты в новые секции
 *   - все API-вызовы, типы, payload'ы
 */

import { useEffect, useState, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import AuthLayout from "@/components/layout/AuthLayout";
import { BackButton } from "@/components/ui/BackButton";
import { HunterCard } from "@/components/profile/HunterCard";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

const ProgressGraph = dynamic(
  () => import("@/components/profile/ProgressGraph").then((m) => m.ProgressGraph),
  { loading: () => <Skeleton height={240} width="100%" rounded="12px" />, ssr: false },
);
import { AchievementWall } from "@/components/profile/AchievementWall";
import { TelegramConnectCard } from "@/components/profile/TelegramConnectCard";
import type { TrainingStats, GamificationProgress, ProgressPoint } from "@/types";
import { logger } from "@/lib/logger";

function ProfilePageContent() {
  const searchParams = useSearchParams();
  const viewUserId = searchParams.get("user");
  const { user, loading: authLoading } = useAuth();
  const [viewedUser, setViewedUser] = useState<{ id: string; full_name: string; role: string; avatar_url?: string | null } | null>(null);
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [, setStatsLoading] = useState(true);
  const [progress, setProgress] = useState<GamificationProgress | null>(null);
  const [progressData, setProgressData] = useState<ProgressPoint[]>([]);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const isViewingOther = !!viewUserId && viewUserId !== user?.id;
  const targetUserId = isViewingOther ? viewUserId : user?.id;

  useEffect(() => {
    if (!isViewingOther || !viewUserId) { setViewedUser(null); return; }
    api.get(`/users/${viewUserId}/profile`)
      .then((data: { id: string; full_name: string; role: string; avatar_url?: string | null }) => setViewedUser(data))
      .catch(() => setViewedUser(null));
  }, [viewUserId, isViewingOther]);

  useEffect(() => {
    if (!targetUserId) return;
    setStatsLoading(true);
    api
      .get(`/users/${targetUserId}/stats`)
      .then(setStats)
      .catch((err) => { logger.error("Failed to load user stats:", err); setStats(null); })
      .finally(() => setStatsLoading(false));

    if (!isViewingOther) {
      api
        .get("/gamification/me/progress")
        .then(setProgress)
        .catch((err) => { logger.error("Failed to load gamification progress:", err); setProgress(null); });

      api
        .get("/analytics/me/snapshot")
        .then((data: { progress?: ProgressPoint[] }) => setProgressData(data.progress ?? []))
        .catch((err) => { logger.error("Failed to load progress data:", err); });
    } else {
      api
        .get(`/users/${targetUserId}/progress`)
        .then((data: { progress?: ProgressPoint[] }) => setProgressData(data.progress ?? []))
        .catch(() => setProgressData([]));
    }
  }, [targetUserId, isViewingOther]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) { setPasswordError("Пароли не совпадают"); return; }
    if (newPassword.length < 8) { setPasswordError("Пароль должен быть не менее 8 символов"); return; }

    setPasswordLoading(true);
    try {
      await api.put("/users/me/password", { old_password: oldPassword, new_password: newPassword });
      setPasswordSuccess("Пароль успешно изменён");
      setTimeout(() => setPasswordSuccess(""), 4000);
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="panel-grid-bg min-h-screen">
        <div className="app-page max-w-4xl">
          <BackButton href={isViewingOther ? "/dashboard" : "/home"} label={isViewingOther ? "Панель РОП" : "На главную"} />

          <div className="pt-2 pb-5">
            <h1 className="t-page-title">
              {isViewingOther && viewedUser ? "Профиль" : "Профиль"}
            </h1>
            {progress && !isViewingOther && (
              <p className="t-caption mt-2">
                Ур. {progress.level} · {(progress.total_xp ?? 0).toLocaleString("ru-RU")} XP
              </p>
            )}
          </div>

          {/* Hero — HunterCard */}
          <ProfileSection>
            {isViewingOther && !viewedUser ? (
              <Skeleton height={160} width="100%" rounded="12px" />
            ) : (
              <HunterCard
                user={{
                  full_name: isViewingOther && viewedUser ? viewedUser.full_name : user?.full_name || "",
                  email: isViewingOther ? "" : user?.email || "",
                  role: isViewingOther && viewedUser ? viewedUser.role : user?.role || "",
                }}
                stats={stats ? { completed_sessions: stats.completed_sessions, avg_score: stats.average_score ?? stats.avg_score ?? null, best_score: stats.best_score } : null}
                gamification={progress}
                teamName={user?.team ?? undefined}
              />
            )}
          </ProfileSection>

          {/* XPDailyProgress removed */}

          {/*
            Активность по дням (heatmap) — только своему профилю.
            Endpoint /users/me/activity возвращает данные для viewer'а,
            чужой профиль показывать не имеет смысла.
          */}
          {!isViewingOther && (
            <ProfileSection title="Активность" mt={6}>
              <ActivityHeatmap days={180} accent="var(--primary)" />
            </ProfileSection>
          )}

          {/* Telegram-бот — только для своего профиля */}
          {!isViewingOther && (
            <ProfileSection title="Telegram" mt={6}>
              <TelegramConnectCard />
            </ProfileSection>
          )}

          {/* Прогресс по неделям */}
          <ProfileSection title="Прогресс" mt={6}>
            <ProgressGraph data={progressData} />
          </ProfileSection>

          {/* Достижения + полки + сделки */}
          <ProfileSection title="Достижения" mt={6}>
            <AchievementWall achievements={progress?.achievements ?? []} />
            {/* OfficeShelf + DealPortfolio removed */}
          </ProfileSection>

          {/*
            Смена пароля — accordion. Пользователь делает это редко,
            нет смысла держать форму всегда раскрытой и тянуть на себя
            визуальный фокус. Кнопка-плашка раскрывает форму по клику.
          */}
          {!isViewingOther && (
            <ProfileSection title="Безопасность" mt={6}>
              <button
                type="button"
                onClick={() => setPasswordOpen((v) => !v)}
                className="w-full flex items-center justify-between text-sm font-medium px-4 py-3 rounded-md transition-colors"
                style={{
                  background: passwordOpen ? "var(--primary-muted)" : "var(--surface-card-hover)",
                  border: "1px solid var(--border-color)",
                  color: passwordOpen ? "var(--primary)" : "var(--text-secondary)",
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Lock size={14} />
                  Сменить пароль
                </span>
                <motion.span
                  animate={{ rotate: passwordOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={14} />
                </motion.span>
              </button>

              {passwordOpen && (
                <motion.form
                  onSubmit={handlePasswordChange}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden mt-4 space-y-3"
                >
                  {passwordError && (
                    <div
                      className="flex items-center gap-2 rounded-md p-3 text-sm"
                      style={{
                        background: "var(--danger-muted, rgba(239,68,68,0.08))",
                        border: "1px solid var(--danger)",
                        color: "var(--danger)",
                      }}
                    >
                      <AlertCircle size={14} />
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div
                      className="flex items-center gap-2 rounded-md p-3 text-sm"
                      style={{
                        background: "var(--success-muted, rgba(34,197,94,0.08))",
                        border: "1px solid var(--success)",
                        color: "var(--success)",
                      }}
                    >
                      <CheckCircle size={14} />
                      {passwordSuccess}
                    </div>
                  )}
                  {[
                    { id: "oldPwd", label: "Текущий пароль", value: oldPassword, setter: setOldPassword },
                    { id: "newPwd", label: "Новый пароль", value: newPassword, setter: setNewPassword, placeholder: "Минимум 8 символов" },
                    { id: "confPwd", label: "Подтвердите пароль", value: confirmPassword, setter: setConfirmPassword },
                  ].map((f) => (
                    <div key={f.id}>
                      <label
                        htmlFor={f.id}
                        className="block text-sm font-medium mb-1.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {f.label}
                      </label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                        <input
                          id={f.id}
                          type="password"
                          value={f.value}
                          onChange={(e) => f.setter(e.target.value)}
                          required
                          minLength={f.id === "oldPwd" ? undefined : 8}
                          className="vh-input pl-10"
                          placeholder={f.placeholder}
                          style={{ fontSize: 14 }}
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="submit"
                    disabled={passwordLoading}
                    loading={passwordLoading}
                    iconRight={<ArrowRight size={16} />}
                  >
                    Изменить пароль
                  </Button>
                </motion.form>
              )}
            </ProfileSection>
          )}

          <div className="mt-12 mb-8" />
        </div>
      </div>
    </AuthLayout>
  );
}

function ProfileSection({
  children,
  title,
  mt,
}: {
  children: ReactNode;
  title?: string;
  mt?: number;
}) {
  return (
    <section
      className="glass-panel relative"
      style={{ marginTop: mt ? `${mt * 4}px` : 24 }}
    >
      {title && (
        <h2 className="t-section-title mb-4">{title}</h2>
      )}
      <div>{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        </AuthLayout>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}
