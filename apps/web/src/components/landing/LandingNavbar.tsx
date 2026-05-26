"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, X as XIcon, Scale } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Главная" },
  { href: "/product", label: "Продукт" },
] as const;

interface LandingNavbarProps {
  onLogin: () => void;
  onRegister: () => void;
}

export function LandingNavbar({ onLogin, onRegister }: LandingNavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-[100]" role="banner">
      <div
        className="absolute inset-0 pointer-events-none transition-shadow duration-300"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(16px) saturate(1.4)",
          WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          boxShadow: scrolled ? "0 1px 8px rgba(0,0,0,0.06)" : "none",
        }}
      />

      <div
        className="relative z-10 flex items-center justify-between h-16 sm:h-[68px] w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-10"
      >
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="w-8 h-8 rounded-lg bg-[#F97316] flex items-center justify-center">
            <Scale size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            LegalHunter
          </span>
        </Link>

        {/* Center: Nav links (desktop) */}
        <nav
          className="hidden md:flex items-center gap-8"
          aria-label="Основная навигация"
        >
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium transition-colors duration-200"
                aria-current={isActive ? "page" : undefined}
                style={{
                  color: isActive ? "#F97316" : "#6B7280",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Войти
          </button>
          <motion.button
            onClick={onRegister}
            className="hidden sm:flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-transform bg-[#F97316] hover:bg-[#EA580C]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            Начать <ArrowRight size={14} />
          </motion.button>

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen
              ? <XIcon size={18} className="text-gray-700" />
              : <Menu size={18} className="text-gray-700" />
            }
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden relative z-10 px-5 pb-5 bg-white border-b border-gray-100"
          >
            <nav className="flex flex-col gap-1" aria-label="Мобильная навигация">
              {NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-medium py-3 px-4 rounded-lg transition-colors"
                    aria-current={isActive ? "page" : undefined}
                    style={{
                      color: isActive ? "#F97316" : "#6B7280",
                      background: isActive ? "#FFF7ED" : "transparent",
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
              <div className="h-px my-2 bg-gray-100" />
              <div className="flex gap-3">
                <button
                  onClick={() => { setMobileMenuOpen(false); onLogin(); }}
                  className="flex-1 py-3 rounded-lg text-sm font-medium border border-gray-200 text-gray-600"
                >
                  Войти
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); onRegister(); }}
                  className="flex-1 py-3 rounded-lg text-sm font-bold bg-[#F97316] text-white"
                >
                  Начать
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
