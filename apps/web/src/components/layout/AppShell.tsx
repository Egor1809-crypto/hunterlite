"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import AppSidebar, {
  SIDEBAR_EXPANDED,
  SIDEBAR_COLLAPSED,
  STORAGE_KEY,
} from "./AppSidebar";
import { Scale } from "lucide-react";

/**
 * AppShell — sidebar + main content layout.
 *
 * Desktop (md+): persistent fixed sidebar (collapsible) + main area offset
 * by sidebar width via CSS margin-left.
 * Mobile (<md): hamburger → overlay drawer, no margin.
 *
 * Collapse state is persisted to localStorage.
 * Children are rendered exactly once to prevent double-mounting.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  /* Restore collapse state + detect viewport */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      /* localStorage unavailable */
    }
    setIsDesktop(window.innerWidth >= 768);
    setMounted(true);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* localStorage unavailable */
      }
      return next;
    });
  }, []);

  /* Track desktop/mobile for margin-left and close mobile drawer on resize */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      if (e.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  /* Prevent layout flash before hydration */
  if (!mounted) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <main className="min-w-0">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* ── Desktop sidebar (fixed) ───────────────────── */}
      {isDesktop && (
        <AppSidebar collapsed={collapsed} onToggle={toggleCollapse} />
      )}

      {/* ── Mobile overlay sidebar ──────────────────────── */}
      <AnimatePresence>
        {!isDesktop && mobileOpen && (
          <motion.div key="mobile-sidebar-layer" className="contents">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50"
              style={{
                background: "var(--overlay-bg)",
                backdropFilter: "blur(4px)",
              }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -SIDEBAR_EXPANDED }}
              animate={{ x: 0 }}
              exit={{ x: -SIDEBAR_EXPANDED }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed top-0 left-0 z-50"
            >
              <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile top bar ──────────────────────────────── */}
      {!isDesktop && (
        <div
          className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4"
          style={{
            background: "var(--surface-card)",
            borderColor: "var(--border-color)",
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{
                background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
              }}
            >
              <Scale size={14} className="text-white" />
            </div>
            <span
              className="text-sm font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              LegalHunter
            </span>
          </div>
        </div>
      )}

      {/* ── Main content — single render, responsive margin ── */}
      <main
        className="min-w-0 min-h-screen relative z-[1]"
        style={{
          marginLeft: isDesktop ? sidebarWidth : 0,
          transition: "margin-left 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
