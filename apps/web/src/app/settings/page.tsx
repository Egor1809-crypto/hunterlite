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
  Save, Loader2, Check, Lock, ArrowRight, AlertCircle, CheckCircle, ChevronDown, type LucideIcon,
} from "lucide-react";
import {
  User as UserIcon, Palette, PaperPlaneTilt,
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
import { TelegramConnectCard } from "@/components/profile/TelegramConnectCard";
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
  disabled = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  accent?: string; // kept for call-site compatibility; no longer drives colour
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      className="rounded-lg text-sm font-medium transition-colors"
      style={{
        padding: "8px 14px",
        fontSize: 14,
        background: active ? "var(--primary)" : "transparent",
        border: `1px solid ${active ? "var(--primary)" : "var(--border-color)"}`,
        color: active ? "#fff" : "var(--text-secondary)",
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
  title,
  icon: Icon,
  description,
  mt,
}: {
  children: ReactNode;
  accent?: string; // kept for call-site compatibility; no longer drives colour
  title: string;
  icon: LucideIcon | React.ComponentType<{ size?: number; weight?: "duotone" | "regular" | "fill" | "bold"; style?: React.CSSProperties }>;
  description?: string;
  mt?: number;
}) {
  return (
    <section className="relative" style={{ marginTop: mt ?? 48 }}>
      {/* Section header — single accent mark + scale heading, no box */}
      <div className="flex items-center gap-2.5 border-t pt-5" style={{ borderColor: "var(--border-color)" }}>
        <Icon size={15} style={{ color: "var(--text-muted)" }} />
        <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
      </div>

      <div className="mt-4">
        {description && (
          <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
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

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullName, setFullName] = useState<string>("");
  const [fullNameSaving, setFullNameSaving] = useState(false);
  const [fullNameSaved, setFullNameSaved] = useState(false);
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
  }, [user]);

  // fetchProgress removed — gamification display cleaned up

  const triggerAutosave = useCallback(async () => {
    if (!mountedRef.current || !user) return;
    setSaving(true);
    try {
      const trimmedRoleTitle = roleTitle.trim();
      const trimmedContact = primaryContact.trim();
      const prefs: Record<string, unknown> = {};
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
  }, [gender, roleTitle, primaryContact, specialization, user]);

  useEffect(() => {
    if (!mountedRef.current || !user) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const timeout = setTimeout(() => { triggerAutosave(); }, 1500);
    saveTimeoutRef.current = timeout;
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [gender, roleTitle, primaryContact, specialization, triggerAutosave, user]);

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

  return (
    <AuthLayout>
      <div className="relative panel-grid-bg min-h-screen">
        <div className="app-page max-w-4xl mx-auto">
          <BackButton href="/home" label="На главную" />

          {/* Page title — editorial header */}
          <div className="pt-2 pb-2">
            <div aria-hidden className="mb-4 h-0.5 w-8" style={{ background: "var(--primary)" }} />
            <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
              LegalHunter
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Настройки
            </h1>
            <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
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
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
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
            </div>
          </SettingsSection>

          {/* ═══ SECTION 3: БЕЗОПАСНОСТЬ ═══ */}
          <SettingsSection
            title="Безопасность"
            icon={Lock}
            description="Смена пароля"
          >
            <SettingsCard>
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
            </SettingsCard>
          </SettingsSection>

          {/* ═══ SECTION 4: TELEGRAM ═══ */}
          <SettingsSection
            title="Telegram"
            icon={PaperPlaneTilt}
            description="Подключение Telegram-бота"
          >
            <TelegramConnectCard />
          </SettingsSection>

          {/* Spacer */}
          <div className="h-12" />
        </div>
      </div>
    </AuthLayout>
  );
}
