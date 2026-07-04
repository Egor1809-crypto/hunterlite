"use client";

import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";

/**
 * LandingFooter — «кейноут»-финал лендинга.
 *
 * Композиция: верхние ~2/3 — кинематографичное ФОТО зала-презентации (в стиле
 * кейноута) с большим экраном «Начни своё обучение сейчас!»; нижняя ~1/3 —
 * воздушная панель с данными футера (бренд, разделы, юр-документы, контакты).
 *
 * Тема: фото ВСЕГДА тёмное (драматичный финал и в светлой, и в тёмной теме);
 * под тему адаптируется только панель данных (var(--bg-secondary) / var(--text-*)),
 * а стык фото→панель — градиент в цвет панели, поэтому переход бесшовный.
 *
 * ► ЧТОБЫ ПОСТАВИТЬ РЕАЛЬНОЕ ФОТО: положи файл в apps/web/public (напр.
 *   `/footer-hall.jpg`) и укажи путь в HALL_IMAGE ниже. Пока строка пустая —
 *   показывается аккуратный SVG-плейсхолдер (зал + экран с CTA).
 */
const HALL_IMAGE = ""; // напр. "/footer-hall.jpg"

const PRODUCT_LINKS = [
  { href: "/product", label: "Возможности" },
  { href: "/product", label: "AI-клиенты" },
  { href: "/product", label: "Система оценки" },
  { href: "/product", label: "Арена знаний" },
];
const COMPANY_LINKS = [
  { href: "/product", label: "О платформе" },
  { href: "/pricing", label: "Контакты" },
];
const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Политика обработки ПДн" },
  { href: "/legal/cookies", label: "Cookie" },
  { href: "/legal/consent", label: "Согласие на ПДн" },
  { href: "/legal/terms", label: "Пользовательское соглашение" },
  { href: "/legal/offer", label: "Оферта" },
];

function HallPlaceholder() {
  // Плейсхолдер «зала»: тёмный градиент, светящийся экран с CTA, силуэты
  // аудитории (плотные ряды, кто-то стоит). Заменяется реальным фото (HALL_IMAGE).
  return (
    <svg
      viewBox="0 0 1600 620"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="lh-hall-glow" cx="50%" cy="26%" r="62%">
          <stop offset="0%" stopColor="#2A2340" />
          <stop offset="55%" stopColor="#120E1E" />
          <stop offset="100%" stopColor="#08060F" />
        </radialGradient>
        <linearGradient id="lh-hall-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3EEFF" />
          <stop offset="100%" stopColor="#CBB8F0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="620" fill="url(#lh-hall-glow)" />
      <rect x="500" y="70" width="600" height="210" rx="16" fill="url(#lh-hall-screen)" />
      <rect x="500" y="70" width="600" height="210" rx="16" fill="none" stroke="#7C3AED" strokeOpacity="0.35" />
      <text x="800" y="158" textAnchor="middle" fontFamily="var(--font-display), Georgia, serif" fontSize="46" fontStyle="italic" fill="#2A1E52">Начни своё обучение</text>
      <text x="800" y="220" textAnchor="middle" fontFamily="var(--font-display), Georgia, serif" fontSize="46" fontStyle="italic" fill="#7C3AED">сейчас</text>
      <g fill="#0C0A16">
        <g opacity="0.85">
          {[230, 300, 370, 1230, 1300, 1370, 1440].map((x, i) => (
            <circle key={`r1-${i}`} cx={x} cy={372} r={13} />
          ))}
        </g>
        <g>
          {[190, 275, 360, 445, 1155, 1240, 1325, 1410, 730, 820, 910].map((x, i) => (
            <circle key={`r2-${i}`} cx={x} cy={444} r={18} />
          ))}
        </g>
        <g>
          {[150, 250, 350, 450, 560, 1040, 1150, 1250, 1350, 1450, 800].map((x, i) => (
            <circle key={`r3-${i}`} cx={x} cy={534} r={24} />
          ))}
        </g>
        <g>
          <rect x="628" y="300" width="30" height="150" rx="15" /><circle cx="643" cy="300" r="20" />
          <rect x="940" y="300" width="30" height="150" rx="15" /><circle cx="955" cy="300" r="20" />
        </g>
      </g>
    </svg>
  );
}

export function LandingFooter() {
  return (
    <footer className="relative z-10">
      {/* ── PHOTO BAND (top ~2/3) — тёмное в обеих темах ─────────────────── */}
      <div
        className="relative flex flex-col items-center justify-end overflow-hidden"
        style={{
          minHeight: "62vh",
          background: HALL_IMAGE
            ? `#08060F url("${HALL_IMAGE}") center/cover no-repeat`
            : "#08060F",
        }}
      >
        {!HALL_IMAGE && <HallPlaceholder />}

        {/* бренд-вордмарк тихо в углу */}
        <Link
          href="/"
          className="absolute left-6 top-6 z-20 text-lg tracking-wide text-[#EDEAF2] transition-opacity hover:opacity-80 sm:left-10 sm:top-8"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Legal<span style={{ color: "#B79CF0" }}>Hunter</span>
        </Link>

        {/* функциональный CTA поверх фото */}
        <Link
          href="/register"
          className="relative z-20 mb-[10vh] inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium text-white transition-transform hover:scale-[1.02]"
          style={{ background: "var(--primary)" }}
        >
          Начать обучение
          <ArrowRight size={18} />
        </Link>

        {/* стык фото → панель данных: градиент в цвет панели (адаптивно) */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40"
          style={{ background: "linear-gradient(to bottom, transparent, var(--bg-secondary))" }}
        />
      </div>

      {/* ── DATA BAND (bottom ~1/3) — панель под тему ────────────────────── */}
      <div style={{ background: "var(--bg-secondary)" }}>
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-12 sm:px-10 md:px-14">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-4 md:gap-10">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="mb-4 text-2xl tracking-wide" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
                Legal<span style={{ color: "var(--primary)" }}>Hunter</span>
              </div>
              <p className="max-w-[280px] text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Профессиональная среда для арбитражных управляющих. Практика на реальных
                сценариях банкротства физических лиц.
              </p>
              <div className="mt-5 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                152-ФЗ · 127-ФЗ
              </div>
            </div>

            {/* Продукт */}
            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Продукт</h4>
              <ul className="space-y-3">
                {PRODUCT_LINKS.map(({ href, label }, i) => (
                  <li key={`${label}-${i}`}>
                    <Link href={href} className="text-sm transition-colors hover:text-[color:var(--primary)]" style={{ color: "var(--text-secondary)" }}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Компания */}
            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Компания</h4>
              <ul className="space-y-3">
                {COMPANY_LINKS.map(({ href, label }, i) => (
                  <li key={`${label}-${i}`}>
                    <Link href={href} className="text-sm transition-colors hover:text-[color:var(--primary)]" style={{ color: "var(--text-secondary)" }}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Связаться */}
            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Связаться</h4>
              <a href="mailto:hello@legalhunter.ru" className="flex items-center gap-2 text-sm transition-colors hover:text-[color:var(--primary)]" style={{ color: "var(--text-secondary)" }}>
                <Mail size={15} className="opacity-60" />
                hello@legalhunter.ru
              </a>
              <a href="https://t.me/BFLHUNTER_bot" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm transition-colors hover:text-[color:var(--primary)]" style={{ color: "var(--text-secondary)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="opacity-70"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                Telegram
              </a>
            </div>
          </div>

          {/* Legal links */}
          <div className="mt-14 border-t pt-8" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
              {LEGAL_LINKS.map(({ href, label }) => (
                <Link key={href} href={href} className="transition-colors hover:text-[color:var(--primary)]" style={{ color: "var(--text-muted)" }}>{label}</Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                &copy; {new Date().getFullYear()} LegalHunter · ООО «АСПБ», ИНН 6452098049. Все права защищены.
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Тренажёр для арбитражных управляющих</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
