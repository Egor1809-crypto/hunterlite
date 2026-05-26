"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair,
  User,
  LogOut,
  Menu,
  X,
  History,
  Home,
  Settings,
  Crown,
  ChevronDown,
  Swords,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { sanitizeText } from "@/lib/sanitize";
import { useAuth } from "@/hooks/useAuth";
import { useGamificationStore } from "@/stores/useGamificationStore";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Scale } from "lucide-react";
import type { UserRole } from "@/types";

type OpenPanel = "none" | "user" | "notifications" | "mobile";

type NavGroup = "main" | "manage";

type NavItem = { href: string; label: string; icon: typeof Home; group: NavGroup };

/**
 * Phase C (2026-04-20) — role-aware navigation.
 *
 * Replaces the flat ``NAV_ITEMS`` with a factory keyed by role so each
 * persona sees the menu that fits their job, not a superset. This is the
 * owner's feedback distilled: "а главная панель навигации остаётся такая
 * как есть для всех ролей? Это только для админа и РОП!"
 *
 * Product decisions locked by owner (2026-04-20):
 *   • manager  — Центр / Тренировка / Арена / История / Лидерборд / Клиенты
 *   • rop      — + «Команда» (≡ /dashboard) left of Тренировка
 *   • methodologist — РЕТАЯН 2026-04-26. Existing tokens may still claim
 *                      this role until they refresh; the branch below
 *                      treats them as ROP. New users cannot be created
 *                      with this role (apps/api/app/api/users.py:786
 *                      allowlist is {manager, rop}).
 *   • admin    — всё от ROP + Аудит / Промпты / Система
 *
 * Leaderboard остаётся глобальной страницей в top-nav (не ныряет в /pvp).
 * Mistake Book живёт внутри /pvp как карточка (Phase C: moved out of nav).
 */
function buildNavForRole(_role: UserRole | undefined): NavItem[] {
  return [
    { href: "/home", label: "Центр", icon: Home, group: "main" },
    { href: "/training", label: "Тренировка", icon: Crosshair, group: "main" },
    { href: "/pvp", label: "Арена", icon: Swords, group: "main" },
    { href: "/history", label: "История", icon: History, group: "main" },
    { href: "/knowledge", label: "Знания", icon: Crown, group: "main" },
  ];
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [openPanel, setOpenPanel] = useState<OpenPanel>("none");
  const shellRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const userRole = user?.role as UserRole | undefined;
  const navItems = buildNavForRole(userRole);
  const { level, currentXP, nextLevelXP, streak, fetchProgress } = useGamificationStore();

  useEffect(() => {
    if (user) fetchProgress();
  }, [user, fetchProgress]);

  useEffect(() => {
    setOpenPanel("none");
  }, [pathname]);

  // Close panels on outside click (scroll close moved to scroll-shrink listener to reduce listeners)
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (shellRef.current && !shellRef.current.contains(target)) {
        setOpenPanel("none");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const displayName = sanitizeText(user?.full_name || "Пользователь");
  const roleLabel =
    user?.role === "admin"
      ? "Администратор"
      : user?.role === "rop" || user?.role === "methodologist"
        ? "РОП"  // legacy methodologist tokens display as ROP (role retired 2026-04-26)
        : "Менеджер";
  const userMenuOpen = openPanel === "user";
  const notificationOpen = openPanel === "notifications";
  const mobileOpen = openPanel === "mobile";

  // Single scroll listener: shrink header (hysteresis to prevent jitter)
  const scrolledRef = useRef(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          const y = window.scrollY;
          // Hysteresis: activate at 60px, deactivate at 20px
          if (!scrolledRef.current && y > 60) {
            scrolledRef.current = true;
            setScrolled(true);
          } else if (scrolledRef.current && y < 20) {
            scrolledRef.current = false;
            setScrolled(false);
          }
          ticking = false;
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        padding: "0.5rem 0",
        transition: "transform 0.25s ease",
      }}
    >
      <div
        ref={shellRef}
        className="app-shell overflow-visible rounded-[30px] border header-inner"
        style={{
          background: "var(--header-bg)",
          borderColor: "var(--header-border)",
          boxShadow: scrolled ? "var(--header-shadow)" : "none",
          backdropFilter: "blur(28px) saturate(1.4)",
          WebkitBackdropFilter: "blur(28px) saturate(1.4)",
          padding: "0.5rem",
          minHeight: "56px",
          transition: "box-shadow 0.25s ease",
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_minmax(260px,1fr)]">
          <div className="relative z-20 flex min-w-0 items-center gap-3">
            <div className="relative">
              <motion.button
                onClick={() => setOpenPanel(userMenuOpen ? "none" : "user")}
                className="flex h-11 max-w-full items-center gap-2 rounded-[20px] border px-3 transition-colors duration-200"
                style={{
                  borderColor: userMenuOpen ? "var(--accent)" : "var(--header-btn-border)",
                  background: userMenuOpen ? "var(--accent-muted)" : "var(--header-btn-bg)",
                  boxShadow: userMenuOpen ? "0 0 0 1px var(--accent-muted)" : undefined,
                }}
                whileTap={{ scale: 0.98 }}
                aria-label="Меню пользователя"
                aria-expanded={userMenuOpen}
              >
                <UserAvatar avatarUrl={user?.avatar_url} fullName={displayName} size={30} />
                <div className="hidden min-w-0 text-left sm:block">
                  <div className="truncate text-sm font-semibold leading-tight" style={{ color: "var(--header-text)" }}>{displayName}</div>
                  <div className="font-medium text-[12px] uppercase leading-none tracking-wide" style={{ color: "var(--header-text-muted)" }}>
                    {roleLabel}
                  </div>
                </div>
                <motion.span animate={{ rotate: userMenuOpen ? 180 : 0 }} className="hidden sm:block">
                  <ChevronDown size={16} style={{ color: "var(--header-text-muted)" }} />
                </motion.span>
              </motion.button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 10, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 top-full z-[80] mt-2 w-[310px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[24px] border"
                    style={{
                      background: "var(--header-bg)",
                      borderColor: "var(--header-border)",
                      boxShadow: "var(--header-shadow)",
                      backdropFilter: "blur(28px) saturate(1.4)",
                      WebkitBackdropFilter: "blur(28px) saturate(1.4)",
                    }}
                  >
                    <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--header-border)" }}>
                      <div className="flex items-center gap-3">
                        <UserAvatar avatarUrl={user?.avatar_url} fullName={displayName} size={42} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold" style={{ color: "var(--header-text)" }}>{displayName}</div>
                          <div className="mt-0.5 text-xs" style={{ color: "var(--header-text-muted)" }}>{roleLabel}</div>
                        </div>
                      </div>
                    </div>

                    <div className="px-3 py-3">
                      <motion.button
                        onClick={() => { setOpenPanel("none"); router.push("/profile"); }}
                        className="flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-sm"
                        style={{ color: "var(--header-text)" }}
                        whileHover={{ background: "var(--header-btn-bg)" }}
                      >
                        <User size={16} />
                        Профиль
                      </motion.button>
                      <motion.button
                        onClick={() => { setOpenPanel("none"); router.push("/settings"); }}
                        className="mt-1 flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-sm"
                        style={{ color: "var(--header-text)" }}
                        whileHover={{ background: "var(--header-btn-bg)" }}
                      >
                        <Settings size={16} />
                        Настройки
                      </motion.button>
                    </div>

                    <div className="px-3 pb-3">
                      <motion.button
                        onClick={() => { setOpenPanel("none"); logout(); }}
                        className="flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-sm"
                        style={{ color: "var(--danger)", background: "color-mix(in srgb, var(--danger) 8%, transparent)" }}
                        whileHover={{ background: "color-mix(in srgb, var(--danger) 14%, transparent)" }}
                      >
                        <LogOut size={16} />
                        Выйти
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-self-center">
            <Link
              href="/home"
              prefetch={true}
              className="group rounded-[20px] px-3 py-1.5 transition-opacity duration-200 hover:opacity-85"
              aria-label="X HUNTER — Главная"
            >
              <span className="font-display font-bold text-lg tracking-wide flex items-center gap-2" style={{ color: "var(--accent)" }}>
                <Scale size={20} />
                LegalHunter
              </span>
            </Link>
          </div>

          <div className="relative z-20 flex items-center justify-end gap-2 sm:gap-3">
            {/* XPBar + StreakCounter removed */}


            <div
              className="flex h-11 items-center gap-1 rounded-[20px] border px-2"
              style={{ borderColor: "var(--header-btn-border)", background: "var(--header-btn-bg)" }}
            >
              <ThemeToggle />
              <NotificationBell
                open={notificationOpen}
                onOpenChange={(next) => setOpenPanel(next ? "notifications" : "none")}
              />
            </div>

            <motion.button
              className="lg:hidden flex h-11 w-11 items-center justify-center rounded-[20px] border"
              onClick={() => setOpenPanel(mobileOpen ? "none" : "mobile")}
              style={{ borderColor: "var(--header-btn-border)", color: "var(--header-text)", background: "var(--header-btn-bg)" }}
              whileTap={{ scale: 0.94 }}
              aria-label="Меню навигации"
              aria-expanded={mobileOpen}
            >
              <AnimatePresence mode="wait">
                {mobileOpen ? (
                  <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                    <X size={20} />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                    <Menu size={20} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        <div className="mt-2 hidden lg:flex items-center justify-center">
          <nav
            className="flex max-w-full items-center justify-center gap-1 rounded-[20px] border p-1 overflow-visible"
            style={{
              borderColor: "var(--header-btn-border)",
              background: "var(--header-btn-bg)",
            }}
          >
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const prevItem = navItems[idx - 1];
              const showDivider = prevItem && prevItem.group === "main" && item.group === "manage";
              return (
                <React.Fragment key={item.href}>
                  {showDivider && (
                    <div role="separator" className="mx-2 h-6 w-px" style={{ background: "var(--border-color)" }} />
                  )}
                <Link href={item.href} prefetch aria-current={active ? "page" : undefined}>
                  <div
                    className="relative flex h-9 items-center gap-2 rounded-[14px] px-4 whitespace-nowrap transition-colors duration-200"
                    style={{
                      color: active ? "var(--header-text-active)" : "var(--header-text-muted)",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.color = "var(--header-text-active)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.color = "var(--header-text-muted)";
                    }}
                  >
                    {active && (
                      <>
                        <div
                          className="absolute inset-0 rounded-[14px]"
                          style={{
                            background: "var(--header-nav-active-bg)",
                            boxShadow: "var(--header-nav-active-shadow)",
                          }}
                        />
                        <div
                          className="absolute left-1/2 -translate-x-1/2"
                          style={{
                            bottom: -3,
                            width: "60%",
                            height: 2,
                            background: "repeating-linear-gradient(to right, var(--accent) 0px, var(--accent) 4px, transparent 4px, transparent 6px)",
                            boxShadow: "0 2px 12px var(--accent-glow)",
                          }}
                        />
                      </>
                    )}
                    <span className="relative z-10 flex items-center opacity-80"><Icon size={16} /></span>
                    <span className="relative z-10 font-medium text-[17px] uppercase leading-none tracking-[0.04em]" style={{ paddingTop: 2 }}>
                      {item.label}
                    </span>
                  </div>
                </Link>
                </React.Fragment>
              );
            })}
          </nav>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[28] lg:hidden"
              style={{ background: "var(--overlay-bg)", backdropFilter: "blur(4px)" }}
              onClick={() => setOpenPanel("none")}
            />
            <motion.nav
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="app-shell mx-auto mt-3 overflow-hidden rounded-[24px] border lg:hidden relative z-[29]"
              style={{
                background: "var(--header-bg)",
                borderColor: "var(--header-border)",
                boxShadow: "var(--header-shadow)",
                backdropFilter: "blur(28px) saturate(1.4)",
                WebkitBackdropFilter: "blur(28px) saturate(1.4)",
              }}
            >
              <div className="px-4 pb-4 pt-3">
                {/* XPBar removed */}
                {/* Main navigation */}
                <div className="grid grid-cols-2 gap-1.5">
                  {navItems.filter(i => i.group === "main").map((item, index) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.025 }}
                      >
                        <Link
                          href={item.href}
                          prefetch={true}
                          onClick={() => setOpenPanel("none")}
                          aria-current={active ? "page" : undefined}
                          className="flex h-11 items-center gap-2.5 rounded-[14px] px-4 text-sm font-medium transition-all duration-200"
                          style={{
                            color: active ? "var(--header-text-active)" : "var(--header-text-muted)",
                            background: active ? "var(--accent-muted)" : "transparent",
                            border: active ? `1px solid var(--border-hover)` : "1px solid transparent",
                          }}
                        >
                          <Icon size={16} style={{ opacity: active ? 1 : 0.6 }} />
                          {item.label}
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
                {/* Management section (role-filtered) */}
                {navItems.filter(i => i.group === "manage").length > 0 && (
                  <>
                    <div className="my-2 mx-2 h-px" style={{ background: "var(--border-color)" }} />
                    <div className="px-1 pb-1">
                      <div className="mb-1.5 px-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        Управление
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {navItems.filter(i => i.group === "manage").map((item, index) => {
                          const Icon = item.icon;
                          const active = isActive(item.href);
                          return (
                            <motion.div
                              key={item.href}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: (index + 5) * 0.025 }}
                            >
                              <Link
                                href={item.href}
                                prefetch={true}
                                onClick={() => setOpenPanel("none")}
                                aria-current={active ? "page" : undefined}
                                className="flex h-11 items-center gap-2.5 rounded-[14px] px-4 text-sm font-medium transition-all duration-200"
                                style={{
                                  color: active ? "var(--header-text-active)" : "var(--header-text-muted)",
                                  background: active ? "var(--accent-muted)" : "transparent",
                                  border: active ? `1px solid var(--border-hover)` : "1px solid transparent",
                                }}
                              >
                                <Icon size={16} style={{ opacity: active ? 1 : 0.6 }} />
                                {item.label}
                              </Link>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
