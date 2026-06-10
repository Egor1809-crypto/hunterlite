"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, X as XIcon } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";

interface LandingNavbarProps {
  onLogin: () => void;
  onRegister: () => void;
}

export function LandingNavbar({ onLogin, onRegister }: LandingNavbarProps) {
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
        className="relative z-10 flex items-center justify-between h-20 w-full mx-auto px-8 sm:px-12 lg:px-16"
      >
        {/* Left: spacer for centering */}
        <div className="flex items-center gap-3 w-[180px]">
          <button
            onClick={onLogin}
            className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Войти
          </button>
        </div>

        {/* Center: Logo */}
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <BrandLogo size="lg" />
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-3 w-[180px]">
          <motion.button
            onClick={onRegister}
            className="hidden sm:flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-transform"
            style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
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
            <div className="flex gap-3">
              <button
                onClick={() => { setMobileMenuOpen(false); onLogin(); }}
                className="flex-1 py-3 rounded-lg text-sm font-medium border border-gray-200 text-gray-600"
              >
                Войти
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); onRegister(); }}
                className="flex-1 py-3 rounded-full text-sm font-bold"
                style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
              >
                Начать
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
