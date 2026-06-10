"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Crosshair,
  History,
  BookOpen,
  Settings,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Briefcase,
  GraduationCap,
  Award,
  Library,
  Trophy,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { TrophyMark } from "@/components/ui/TrophyMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { sanitizeText } from "@/lib/sanitize";

/* ── Sidebar width tokens ─────────────────────────────────── */
const SIDEBAR_EXPANDED = 260;
const SIDEBAR_COLLAPSED = 68;
const STORAGE_KEY = "lh-sidebar-collapsed";
const ENERGY_STORAGE_KEY = "hunterlite_daily_energy";
const DAILY_ENERGY = 25;

/* ── Navigation items ─────────────────────────────────────── */
type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

function buildNavForRole(): NavItem[] {
  return [
    { href: "/home", label: "Центр", icon: Home },
    { href: "/training", label: "Обучение", icon: Crosshair },
    { href: "/cases", label: "Кейсы", icon: Briefcase },
    { href: "/exam", label: "Экзамен", icon: GraduationCap },
    { href: "/certificate", label: "Сертификат", icon: Award },
    { href: "/championship", label: "Чемпионат", icon: Trophy },
    { href: "/history", label: "История", icon: History },
    { href: "/knowledge", label: "База знаний", icon: BookOpen },
    { href: "/courses", label: "Курсы", icon: Library },
  ];
}

/* ── Component ────────────────────────────────────────────── */
export interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [energy, setEnergy] = useState(DAILY_ENERGY);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const navItems = buildNavForRole();
  const displayName = sanitizeText(user?.full_name || "Пользователь");
  const roleLabel =
    user?.role === "admin"
      ? "Администратор"
      : user?.role === "rop" || user?.role === "methodologist"
        ? "РОП"
        : "Менеджер";

  /* Close user menu on route change */
  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  useEffect(() => {
    const key = user?.id ? `${ENERGY_STORAGE_KEY}:${user.id}` : ENERGY_STORAGE_KEY;
    const readEnergy = () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const raw = localStorage.getItem(key);
        if (!raw) {
          setEnergy(DAILY_ENERGY);
          return;
        }
        const parsed = JSON.parse(raw) as { date?: string; remaining?: number };
        setEnergy(parsed.date === today ? Math.max(0, Math.min(DAILY_ENERGY, Number(parsed.remaining ?? DAILY_ENERGY))) : DAILY_ENERGY);
      } catch {
        setEnergy(DAILY_ENERGY);
      }
    };

    readEnergy();
    window.addEventListener("storage", readEnergy);
    window.addEventListener("hunterlite:energy", readEnergy);
    return () => {
      window.removeEventListener("storage", readEnergy);
      window.removeEventListener("hunterlite:energy", readEnergy);
    };
  }, [user?.id]);

  return (
    <aside
      className="fixed top-0 left-0 z-40 flex h-screen flex-col overflow-hidden border-r select-none"
	      style={{
	        background: "var(--surface-card)",
	        borderColor: "var(--border-color)",
	        width: sidebarWidth,
	        transition: "width 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
          boxShadow: "var(--shadow-sm)",
	      }}
    >
      {/* ── Logo ──────────────────────────────────────── */}
      <div
	        className={`flex h-20 items-center relative ${collapsed ? "justify-center px-0" : "gap-2.5 px-4"}`}
	        style={{ borderBottom: "1px solid var(--border-color)" }}
	      >
        <Link
          href="/home"
          className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5 overflow-hidden"}`}
          prefetch
        >
          {collapsed ? <BrandLogo compact size="md" /> : <BrandLogo size="lg" />}
        </Link>

        {/* Collapse control — only when expanded */}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border-color)",
              background: "var(--surface-card)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-secondary)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface-card)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
            aria-label="Свернуть панель"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* ── Expand button when collapsed ─────────────── */}
	      {collapsed && (
        <div className="flex justify-center py-2">
          <button
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border-color)",
              background: "var(--surface-card)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-secondary)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface-card)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
            aria-label="Развернуть панель"
          >
            <PanelLeft size={16} />
          </button>
        </div>
	      )}

        {!collapsed && (
          <div className="px-4 pt-3">
            <div
              className="rounded-2xl border px-3 py-3"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border-color)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
                  >
                    <Zap size={16} />
                  </span>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      Энергия
                    </div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {energy}/{DAILY_ENERGY}
                    </div>
                  </div>
                </div>
                <div className="h-2 w-16 overflow-hidden rounded-full" style={{ background: "var(--bg-tertiary)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, (energy / DAILY_ENERGY) * 100))}%`,
                      background: "var(--primary)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      {/* ── Navigation ────────────────────────────────── */}
	      <nav className="flex-1 overflow-y-auto px-3 py-4">
	        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
	                className="group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors duration-150 overflow-hidden"
	                style={{
	                  color: active ? "var(--primary)" : "var(--text-secondary)",
	                  background: active
                      ? "var(--primary-muted)"
                      : "transparent",
                    border: active ? "1px solid color-mix(in srgb, var(--primary) 18%, var(--border-color))" : "1px solid transparent",
                    boxShadow: "none",
	                  // Иконка всегда у левого края (flex-start) — при сворачивании она
	                  // НЕ ездит и не вылезает за границы рейла; label просто исчезает справа.
	                  justifyContent: "flex-start",
	                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "var(--bg-tertiary)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
                title={collapsed ? item.label : undefined}
              >
                {/* Active indicator bar */}
                {active && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                    style={{ background: "var(--primary)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon
                  size={20}
                  className="shrink-0"
                  style={{ opacity: active ? 1 : 0.7 }}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Championship promo (над выбором темы — зеркалит лендинг) ── */}
      <div className="px-3 pb-1 pt-2">
        <Link
          href="/championship"
          className={`group flex items-center no-underline transition-transform hover:scale-[1.03] ${collapsed ? "justify-center rounded-xl p-2.5" : "gap-3 rounded-2xl p-3.5"}`}
          style={{ background: "var(--primary)", boxShadow: "var(--shadow-md)" }}
          title="Чемпионат сезона — розыгрыш призов Apple"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "#fff" }}
          >
            <TrophyMark size={22} />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-[14.5px] font-bold leading-tight" style={{ color: "#fff" }}>
                Чемпионат
              </span>
              <span className="block text-[11.5px] leading-tight" style={{ color: "rgba(255,255,255,0.85)" }}>
                Призы Apple
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* ── Theme control ─────────────────────────────── */}
      <div
        className="border-t px-3 py-3"
        style={{ borderColor: "var(--border-color)" }}
      >
        {collapsed ? (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        ) : (
          <div
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-2"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Тема
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Светлая / тёмная
              </div>
            </div>
            <ThemeToggle />
          </div>
        )}
      </div>

      {/* ── User section (bottom) ─────────────────────── */}
      <div
        className="relative border-t px-3 py-3"
        style={{ borderColor: "var(--border-color)" }}
      >
        <button
          onClick={() => setUserMenuOpen((p) => !p)}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors"
          style={{
            justifyContent: collapsed ? "center" : "flex-start",
            background: userMenuOpen ? "var(--bg-secondary)" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (!userMenuOpen)
              e.currentTarget.style.background = "var(--bg-secondary)";
          }}
          onMouseLeave={(e) => {
            if (!userMenuOpen)
              e.currentTarget.style.background = "transparent";
          }}
          aria-label="Меню пользователя"
          aria-expanded={userMenuOpen}
        >
          <UserAvatar
            avatarUrl={user?.avatar_url}
            fullName={displayName}
            size={32}
          />
          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <div
                className="truncate text-sm font-semibold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {displayName}
              </div>
              <div
                className="truncate text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {roleLabel}
              </div>
            </div>
          )}
          {!collapsed && (
            <motion.span
              animate={{ rotate: userMenuOpen ? 180 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronDown
                size={14}
                style={{ color: "var(--text-muted)" }}
              />
            </motion.span>
          )}
        </button>

        {/* User dropdown menu */}
        <AnimatePresence>
          {userMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden rounded-xl border"
              style={{
                // fixed (а не absolute) — чтобы меню НЕ обрезалось overflow-hidden
                // рейла. Раньше при закрытии оно клиппилось и мелькала
                // «полузакрытая панель». Теперь exit-анимация проигрывается целиком.
                position: "fixed",
                bottom: 76,
                left: 12,
                width: collapsed ? 208 : sidebarWidth - 24,
                background: "var(--surface-card)",
                borderColor: "var(--border-color)",
                boxShadow: "var(--shadow-lg)",
                zIndex: 50,
              }}
            >
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-secondary)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  <Settings size={16} />
                  Настройки
                </button>
                <div
                  className="my-1 h-px"
                  style={{ background: "var(--border-color)" }}
                />
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors"
                  style={{ color: "var(--danger)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--danger-muted)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <LogOut size={16} />
                  Выйти
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

export { SIDEBAR_EXPANDED, SIDEBAR_COLLAPSED, STORAGE_KEY };
