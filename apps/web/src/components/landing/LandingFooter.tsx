"use client";

import Link from "next/link";
import { Mail, Shield } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";

export function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-[color:var(--border-color)] bg-[color:var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 md:px-10 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand column */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 transition-opacity hover:opacity-80">
              <BrandLogo size="sm" />
            </Link>
            <p className="text-sm leading-relaxed text-[color:var(--text-secondary)] max-w-[260px] mb-4">
              AI-тренажер переговоров для арбитражных управляющих.
              Практика на реальных сценариях банкротства.
            </p>
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-[color:var(--primary)]" />
              <span className="text-xs text-[color:var(--text-muted)]">
                152-ФЗ / 127-ФЗ
              </span>
            </div>
          </div>

          {/* Product column */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-[color:var(--text-primary)] mb-4">
              Продукт
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: "/product", label: "Возможности" },
                { href: "/product", label: "AI-клиенты" },
                { href: "/product", label: "Система оценки" },
                { href: "/product", label: "Арена знаний" },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--primary)] transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-[color:var(--text-primary)] mb-4">
              Компания
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: "/product", label: "О платформе" },
                { href: "/pricing", label: "Контакты" },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--primary)] transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact column */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-[color:var(--text-primary)] mb-4">
              Связаться
            </h4>
            <a
              href="mailto:hello@legalhunter.ru"
              className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--primary)] transition-colors"
            >
              <Mail size={14} className="opacity-60" />
              hello@legalhunter.ru
            </a>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://t.me/legalhunter"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[color:var(--bg-tertiary)] flex items-center justify-center text-[color:var(--text-muted)] hover:text-[color:var(--primary)] transition-colors"
                aria-label="Telegram"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-[color:var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[color:var(--text-muted)]">
            &copy; {new Date().getFullYear()} LegalHunter. Все права защищены.
          </p>
          <p className="text-xs text-[color:var(--text-muted)]">
            Тренажер для арбитражных управляющих
          </p>
        </div>
      </div>
    </footer>
  );
}
