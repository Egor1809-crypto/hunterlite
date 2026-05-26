"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Crosshair,
  Swords,
  History,
  BookOpen,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Scale,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { sanitizeText } from "@/lib/sanitize";
import type { UserRole } from "@/types";

/* ── Sidebar width tokens ─────────────────────────────────── */
const SIDEBAR_EXPANDED = 260;
const SIDEBAR_COLLAPSED = 68;
const STORAGE_KEY = "lh-sidebar-collapsed";

/* ── Navigation items ─────────────────────────────────────── */
type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

function buildNavForRole(_role: UserRole | undefined): NavItem[] {
  return [
    { href: "/home", label: "Центр", icon: Home },
    { href: "/training", label: "Тренировка", icon: Crosshair },
    { href: "/pvp", label: "Арена", icon: Swords },
    { href: "/history", label: "История", icon: History },
    { href: "/knowledge", label: "Знания", icon: BookOpen },
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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const userRole = user?.role as UserRole | undefined;
  const navItems = buildNavForRole(userRole);
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

  return (
    <aside
      className="fixed top-0 left-0 z-40 flex h-screen flex-col border-r select-none overflow-hidden"
      style={{
        background: "var(--surface-card)",
        borderColor: "var(--border-color)",
        width: sidebarWidth,
        transition: "width 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}
    >
      {/* ── Logo ──────────────────────────────────────── */}
      <div
        className="flex h-16 items-center gap-2.5 border-b px-4"
        style={{ borderColor: "var(--border-color)" }}
      >
        <Link
          href="/home"
          className="flex items-center gap-2.5 overflow-hidden"
          prefetch
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
            }}
          >
            <Scale size={18} className="text-white" />
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="logo-text"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap text-base font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                LegalHunter
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Collapse toggle — only when expanded */}
        <AnimatePresence>
          {!collapsed && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-secondary)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
              aria-label="Свернуть панель"
            >
              <PanelLeftClose size={16} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Expand button when collapsed ─────────────── */}
      {collapsed && (
        <div className="flex justify-center py-2">
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-secondary)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
            aria-label="Развернуть панель"
          >
            <PanelLeft size={16} />
          </button>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 overflow-hidden"
                style={{
                  color: active ? "var(--primary)" : "var(--text-secondary)",
                  background: active ? "var(--primary-muted)" : "transparent",
                  justifyContent: collapsed ? "center" : "flex-start",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "var(--bg-secondary)";
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
                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.span
                      key={`nav-label-${item.href}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.12 }}
                      className="truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </div>
      </nav>

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
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                key="user-info"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="min-w-0 flex-1 text-left"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
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
              className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border"
              style={{
                background: "var(--surface-card)",
                borderColor: "var(--border-color)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
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
                  <User size={16} />
                  Профиль
                </button>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
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
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
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
