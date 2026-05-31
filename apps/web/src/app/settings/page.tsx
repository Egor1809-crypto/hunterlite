"use client";

/**
 * /settings — «⚙ НАСТРОЙКИ ⚙» (аркадный редизайн 2026-05-08).
 *
 * Что изменилось vs прошлой версии:
 *   - убран glass-panel header — заменён пиксельным сяющим лого
 *     «⚙ НАСТРОЙКИ ⚙» (тот же эффект что на /leaderboard и /profile,
 *     но с серебряно-голубым градиентом для UI-«пульта»).
 *   - autosave-индикатор теперь пиксельный плашка справа
 *   - рабочие секции: Игрок · Внешний вид
 *     + опциональная Воронка для CRM-ролей
 *   - каждая секция в `<SettingsSection accent={...}>` с цветной рамкой
 *     и заголовком-плашкой слева сверху (симметрично /profile)
 *   - все Toggle/Chip/input получили пиксельный стиль (2-3px borders,
 *     square corners, neon glow при active)
 *   - все шрифты ≥ 14px (text-sm font-medium для
 *     лейблов, font-medium 14-16px для текста)
 *
 * Убрано:
 *   - неработающие блоки звука, уведомлений, связок и тренировочных режимов
 *   - блок старого маскота удалён до подготовки нового помощника
 */

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Loader2, Check, type LucideIcon,
} from "lucide-react";
import {
  Kanban, User as UserIcon, Palette,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
// useGamificationStore removed — gamification display cleaned up
import { useAuthStore } from "@/stores/useAuthStore";
import AuthLayout from "@/components/layout/AuthLayout";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { toast } from "sonner";
import { PIPELINE_STATUSES, CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS } from "@/types";
import type { ClientStatus } from "@/types";
import { logger } from "@/lib/logger";

function invalidateUserCache() {
  useAuthStore.getState().invalidate();
  void useAuthStore.getState().fetchUser();
}

const roleLabels: Record<string, string> = {
  manager: "Менеджер",
  rop: "Руководитель ОП",
  methodologist: "РОП",  // legacy enum — retired 2026-04-26, displays as ROP for stale tokens
  admin: "Администратор",
};

const GENDERS = [
  { key: "male", label: "Мужской" },
  { key: "female", label: "Женский" },
  { key: "neutral", label: "Не указывать" },
] as const;

const ACCENT_COLORS = [
  { key: "violet", label: "Violet", color: "#8A2BE2" },
  { key: "blue", label: "Blue", color: "var(--info)" },
  { key: "emerald", label: "Emerald", color: "var(--success)" },
  { key: "amber", label: "Amber", color: "var(--warning)" },
  { key: "rose", label: "Rose", color: "#F43F5E" },
] as const;

const THEMES = [
  { key: "dark", label: "Тёмная" },
  { key: "light", label: "Светлая" },
  { key: "system", label: "Авто" },
] as const;

/* ═══ Pixel Chip ═════════════════════════════════════════════════════════ */

function PixelChip({
  active,
  label,
  onClick,
  accent = "var(--accent)",
  disabled = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  accent?: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      className="rounded-xl text-sm font-medium transition-all"
      style={{
        padding: "8px 14px",
        fontSize: 14,
        background: active ? accent : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? accent : "rgba(255,255,255,0.12)"}`,
        color: active ? "#0b0b14" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </motion.button>
  );
}

/* ═══ Pixel Input ════════════════════════════════════════════════════════ */

function PixelInput({
  value,
  onChange,
  placeholder,
  maxLength = 120,
  type = "text",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      className="w-full rounded-xl outline-none transition-colors vh-input"
      style={{
        padding: "10px 14px",
        fontSize: 14,
      }}
    />
  );
}

/* ═══ SettingsSection — пиксельная рамка для каждой секции ══════════════ */

function SettingsSection({
  children,
  accent,
  title,
  icon: Icon,
  description,
  mt,
}: {
  children: ReactNode;
  accent: string;
  title: string;
  icon: LucideIcon | React.ComponentType<{ size?: number; weight?: "duotone" | "regular" | "fill" | "bold"; style?: React.CSSProperties }>;
  description?: string;
  mt?: number;
}) {
  return (
    <section
      className="relative rounded-2xl"
      style={{
        marginTop: mt ?? 32,
        border: `1px solid ${accent}22`,
        background: "var(--surface-card, rgba(8,5,18,0.45))",
      }}
    >
      {/* Section header */}
      <div
        className="flex items-center gap-2 px-5 pt-5 pb-1"
      >
        <Icon size={16} weight="duotone" style={{ color: accent }} />
        <span className="text-sm font-semibold" style={{ color: accent }}>
          {title}
        </span>
      </div>

      <div className="p-4 md:p-5">
        {description && (
          <p
            className="mb-4 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

/* ═══ Internal pixel «card» внутри секций ═══════════════════════════════ */

function SettingsCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
      }}
    >
      {children}
    </div>
  );
}

function SettingsLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-sm font-medium mb-2.5"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </div>
  );
}

/* ═══ Main page ══════════════════════════════════════════════════════════ */

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const mountedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [gender, setGender] = useState<string>("");
  const [roleTitle, setRoleTitle] = useState<string>("");
  const [primaryContact, setPrimaryContact] = useState<string>("");
  const [specialization, setSpecialization] = useState<string>("");
  const [pipelineColumns, setPipelineColumns] = useState<string[]>(PIPELINE_STATUSES as string[]);
  const [accentColor, setAccentColor] = useState<string>("violet");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullName, setFullName] = useState<string>("");
  const [fullNameSaving, setFullNameSaving] = useState(false);
  const [fullNameSaved, setFullNameSaved] = useState(false);
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const showCRM = user?.role && ["admin", "rop", "manager"].includes(user.role);
  // gamification store removed — level/streak display cleaned up

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    mountedRef.current = true;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.avatar_url) setAvatarUrl(user.avatar_url);
    if (user.full_name) setFullName(user.full_name);
    const p = (user.preferences as Record<string, unknown>) || {};
    if (typeof p.gender === "string") setGender(p.gender);
    if (typeof p.role_title === "string") setRoleTitle(p.role_title);
    if (typeof p.primary_contact === "string") setPrimaryContact(p.primary_contact);
    if (typeof p.specialization === "string") setSpecialization(p.specialization);
    if (Array.isArray(p.pipeline_columns)) setPipelineColumns(p.pipeline_columns as string[]);
    if (typeof p.accent_color === "string") setAccentColor(p.accent_color);
  }, [user]);

  useEffect(() => {
    if (!mountedRef.current) return;
    const html = document.documentElement;
    ACCENT_COLORS.forEach((c) => html.classList.remove(`accent-${c.key}`));
    if (accentColor && accentColor !== "violet") {
      html.classList.add(`accent-${accentColor}`);
    }
  }, [accentColor]);

  // fetchProgress removed — gamification display cleaned up

  const triggerAutosave = useCallback(async () => {
    if (!mountedRef.current || !user) return;
    setSaving(true);
    try {
      const trimmedRoleTitle = roleTitle.trim();
      const trimmedContact = primaryContact.trim();
      const prefs: Record<string, unknown> = {
        pipeline_columns: pipelineColumns,
        accent_color: accentColor,
      };
      if (gender) prefs.gender = gender;
      if (trimmedRoleTitle.length >= 2) prefs.role_title = trimmedRoleTitle;
      if (trimmedContact.length >= 3) prefs.primary_contact = trimmedContact;
      if (specialization) prefs.specialization = specialization;
      await api.post("/users/me/preferences", prefs);
      useAuthStore.getState().updatePreferences(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      logger.error("Autosave failed:", e);
      const msg = e instanceof Error ? e.message : "Не удалось сохранить настройки";
      toast.error("Ошибка сохранения", { description: msg });
    }
    setSaving(false);
  }, [gender, roleTitle, primaryContact, specialization, pipelineColumns, accentColor, user]);

  useEffect(() => {
    if (!mountedRef.current || !user) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const timeout = setTimeout(() => { triggerAutosave(); }, 1500);
    saveTimeoutRef.current = timeout;
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [gender, roleTitle, primaryContact, specialization, pipelineColumns, accentColor, triggerAutosave, user]);

  const handleSaveName = async () => {
    const trimmed = fullName.trim();
    if (!trimmed || trimmed.length < 2) {
      setFullNameError("Имя должно содержать минимум 2 символа");
      return;
    }
    if (trimmed === user?.full_name) return;
    setFullNameSaving(true);
    setFullNameError(null);
    try {
      await api.patch("/users/me/profile", { full_name: trimmed });
      invalidateUserCache();
      setFullNameSaved(true);
      toast.success("Имя обновлено");
      setTimeout(() => setFullNameSaved(false), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка сохранения имени";
      setFullNameError(msg);
      toast.error("Не удалось сохранить имя", { description: msg });
    }
    setFullNameSaving(false);
  };

  return (
    <AuthLayout>
      <div className="relative panel-grid-bg min-h-screen">
        <div className="app-page max-w-4xl mx-auto">
          <BackButton href="/home" label="На главную" />

          {/* Page title */}
          <div className="pt-2 pb-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              Настройки
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Управление профилем и параметрами
            </p>
          </div>

          {/* Header-bar: avatar + role + level + autosave indicator */}
          <div
            className="flex items-center gap-4 mt-3 p-4 rounded-xl"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <AvatarUpload
              currentUrl={avatarUrl}
              userName={user?.full_name || ""}
              size={56}
              onUploaded={(url) => { setAvatarUrl(url); invalidateUserCache(); }}
              onDeleted={() => { setAvatarUrl(null); invalidateUserCache(); }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)", fontSize: 18 }}
              >
                {user?.full_name || "—"}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="rounded-xl px-2 py-0.5 text-sm font-medium"
                  style={{
                    background: "rgba(167,139,250,0.18)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)",
                    fontSize: 14,
                  }}
                >
                  {roleLabels[user?.role || ""] || user?.role || ""}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <AnimatePresence mode="wait">
                {saving ? (
                  <motion.div
                    key="saving"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-sm font-medium"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      color: "var(--text-muted)",
                      fontSize: 14,
                    }}
                  >
                    <Loader2 size={12} className="animate-spin" />
                    Сохранение
                  </motion.div>
                ) : saved ? (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-sm font-medium"
                    style={{
                      background: "rgba(74,222,128,0.18)",
                      border: "1px solid #4ade80",
                      color: "#4ade80",
                      fontSize: 14,
                    }}
                  >
                    <Check size={12} /> Сохранено
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* ═══ SECTION 1: ИГРОК ═══ */}
          <SettingsSection
            accent="#a78bfa"
            title="👤 ИГРОК"
            icon={UserIcon}
            description="Личные данные и контактная информация"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SettingsCard className="md:col-span-2">
                <SettingsLabel>Имя</SettingsLabel>
                <div className="flex gap-2 items-center">
                  <PixelInput
                    value={fullName}
                    onChange={(v) => { setFullName(v); setFullNameError(null); setFullNameSaved(false); }}
                    placeholder="Ваше имя"
                    maxLength={100}
                    disabled={fullNameSaving}
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={fullNameSaving || !fullName.trim() || fullName.trim() === user?.full_name}
                    size="sm"
                  >
                    {fullNameSaving ? <Loader2 size={14} className="animate-spin" /> : fullNameSaved ? <Check size={14} /> : <Save size={14} />}
                  </Button>
                </div>
                {fullNameError && (
                  <p className="text-sm font-medium mt-2" style={{ color: "var(--danger)", fontSize: 14 }}>
                    {fullNameError}
                  </p>
                )}
                <p className="text-sm font-medium mt-2" style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  Email: {user?.email}
                </p>
              </SettingsCard>

              <SettingsCard>
                <SettingsLabel>Пол</SettingsLabel>
                <div className="flex flex-wrap gap-2">
                  {GENDERS.map((g) => (
                    <PixelChip
                      key={g.key}
                      active={gender === g.key}
                      label={g.label}
                      onClick={() => setGender(g.key)}
                      accent="#a78bfa"
                    />
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard>
                <SettingsLabel>Должность</SettingsLabel>
                <PixelInput value={roleTitle} onChange={setRoleTitle} placeholder="Менеджер" />
              </SettingsCard>

              <SettingsCard>
                <SettingsLabel>Контакт</SettingsLabel>
                <PixelInput value={primaryContact} onChange={setPrimaryContact} placeholder="Telegram / Phone" />
              </SettingsCard>

              <SettingsCard>
                <SettingsLabel>Специализация</SettingsLabel>
                <PixelInput value={specialization} onChange={setSpecialization} placeholder="HR, Продажи..." />
              </SettingsCard>
            </div>
          </SettingsSection>

          {/* ═══ SECTION 2: ВНЕШНИЙ ВИД ═══ */}
          <SettingsSection
            accent="#fb923c"
            title="🎨 ВНЕШНИЙ ВИД"
            icon={Palette}
            description="Тема и цветовой акцент интерфейса"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SettingsCard>
                <SettingsLabel>Тема</SettingsLabel>
                {hydrated && (
                  <div className="flex gap-2 flex-wrap">
                    {THEMES.map((t) => (
                      <PixelChip
                        key={t.key}
                        active={theme === t.key}
                        label={t.label}
                        onClick={() => setTheme(t.key)}
                        accent="#fb923c"
                      />
                    ))}
                  </div>
                )}
              </SettingsCard>

              <SettingsCard>
                <SettingsLabel>Акцент</SettingsLabel>
                <div className="flex gap-2.5 flex-wrap">
                  {ACCENT_COLORS.map((c) => (
                    <motion.button
                      key={c.key}
                      type="button"
                      onClick={() => setAccentColor(c.key)}
                      className="rounded-xl transition-all"
                      style={{
                        width: 36,
                        height: 36,
                        background: c.color,
                        border: accentColor === c.key ? "3px solid #fff" : "2px solid rgba(255,255,255,0.2)",
                        boxShadow: accentColor === c.key ? `0 0 12px ${c.color}` : "none",
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title={c.label}
                    />
                  ))}
                </div>
              </SettingsCard>

            </div>
          </SettingsSection>

          {/* ═══ SECTION 3: ВОРОНКА (CRM only) ═══ */}
          {showCRM && (
            <SettingsSection
              accent="#ff3ec8"
              title="📋 ВОРОНКА"
              icon={Kanban}
              description="Колонки CRM-канбана"
            >
              <SettingsCard>
                <SettingsLabel>Активные этапы (минимум 2)</SettingsLabel>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STATUSES.map((status) => {
                    const on = pipelineColumns.includes(status);
                    const statusColor = CLIENT_STATUS_COLORS[status as ClientStatus] || "var(--text-muted)";
                    const disabled = on && pipelineColumns.length <= 2;
                    return (
                      <button
                        key={status}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          setPipelineColumns(on
                            ? pipelineColumns.filter((s) => s !== status)
                            : [...pipelineColumns, status]
                          );
                        }}
                        className="inline-flex items-center gap-2 rounded-xl text-sm font-medium transition-all"
                        style={{
                          padding: "8px 14px",
                          fontSize: 14,
                          background: on ? `${statusColor}1f` : "rgba(255,255,255,0.04)",
                          border: `2px solid ${on ? statusColor : "rgba(255,255,255,0.18)"}`,
                          color: on ? statusColor : "var(--text-secondary)",
                          opacity: on ? 1 : 0.7,
                          cursor: disabled ? "not-allowed" : "pointer",
                          boxShadow: on ? `0 0 8px ${statusColor}55` : "none",
                        }}
                      >
                        <span className="rounded-xl" style={{ width: 8, height: 8, background: statusColor }} />
                        {CLIENT_STATUS_LABELS[status as ClientStatus]}
                      </button>
                    );
                  })}
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          {/* Spacer */}
          <div className="h-12" />
        </div>
      </div>
    </AuthLayout>
  );
}
