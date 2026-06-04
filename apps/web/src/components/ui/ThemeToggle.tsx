"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-9" />;
  }

  // resolvedTheme reflects the *actual* applied theme even when the user's
  // choice is "system" (auto) — so the toggle always flips to the opposite of
  // what's on screen, never gets stuck on a stale "system" value.
  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <motion.button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-color)",
        color: "var(--text-secondary)",
      }}
      whileHover={{ y: -1, borderColor: "var(--border-hover)" }}
      whileTap={{ y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </motion.button>
  );
}
