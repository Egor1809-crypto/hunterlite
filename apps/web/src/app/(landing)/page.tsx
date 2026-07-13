"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Check, Send, Sun, Moon, Trophy, Infinity as InfinityIcon } from "lucide-react";
import { useLandingAuth } from "@/components/landing/LandingAuthContext";
import { CertificatePreview, CERT_TOKEN_PALETTE } from "@/components/certificate/CertificatePreview";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TrophyMark } from "@/components/ui/TrophyMark";

const stats = [
  { value: "18 000+", label: "квалифицированных юристов вышли из наших программ" },
  { value: "17 000+", label: "завершённых процедур в профессиональной практике" },
  { value: "11 лет", label: "опыта на рынке банкротства физических лиц" },
  { value: "800+", label: "партнёров доверяют нашей методологии" },
  { value: "80+", label: "специалистов в экспертной команде" },
  { value: "По всей России", label: "работаем удалённо и очно" },
];

// Все фото экспертов предварительно нормализованы (scripts: PIL) к единому
// холсту 1000×1250 (ровно 4:5 = рамка aspect-[4/5]) с одинаковой шириной лица
// (~360px) и головой на одной высоте (top ≈ 12%). Поэтому object-cover не
// кадрирует их, и все лица — одного размера и на одном уровне с равным отступом.
type Expert = { name: string; role: string; image: string };

const experts: Expert[] = [
  { name: "Василий Артин", role: "Генеральный директор", image: "/landing/experts/expert-01.webp" },
  { name: "Андрей Абукаев", role: "Арбитражный управляющий", image: "/landing/experts/expert-02.webp" },
  { name: "Елена Лященко", role: "Арбитражный управляющий", image: "/landing/experts/expert-03.webp" },
  { name: "Александр Герасимов", role: "Арбитражный управляющий", image: "/landing/experts/expert-04.webp" },
  { name: "Дмитрий Сизов", role: "Арбитражный управляющий", image: "/landing/experts/expert-05.webp" },
];

const products = [
  {
    title: "AI-тренировки",
    text: "Диалоги с AI-клиентами, которые ведут себя как реальные должники: спорят, сомневаются, давят и проверяют на прочность. Ошибиться можно здесь — не с живым человеком.",
  },
  {
    title: "Кейсы и практика",
    text: "Интерактивные дела по банкротству: решения, последствия, скрытые факты и разбор от практиков. Видно, как выбор юриста отражается на судьбе человека.",
  },
  {
    title: "Экзамен и сертификат",
    text: "Объективная проверка знаний, отчёт о результате и сертификат — подтверждение, что вам можно доверить дело.",
  },
];

const ecosystem = [
  { label: "Expertum · проверка и практика", href: "https://expertum.pro/" },
  "AI-ассистент юриста",
  "Анализ судебной практики",
  "Проверка контрагентов",
  "Генерация процессуальных документов",
  "Правовой поиск по 127-ФЗ",
  "Прогноз исхода дела",
  "Радар изменений в праве",
  "База знаний по банкротству",
  "AI-разбор кейсов",
  "Симуляция переговоров с должником",
  "Автоматизация документооборота",
  "Калькулятор процедур банкротства",
];

// Тарифы — ДВА плана. Содержимое правьте здесь.
const plans = [
  {
    name: "Старт",
    plan: "scout",
    tagline: "Старт в профессии",
    code: "PL—01",
    price: "0",
    period: "₽ / мес",
    cta: "Начать бесплатно",
    highlight: false,
    features: [
      { text: "Тесты по банкротству физлиц", strong: false },
      { text: "База знаний", strong: false },
      { text: "Маняша — AI-помощник", strong: false },
      { text: "Интерактивные кейсы", strong: false },
      { text: "Курс «Сопровождение процедуры банкротства» — бесплатно", strong: false },
      { text: "25 энергии в день", strong: false },
      { text: "Первые 3 дня — безлимитная энергия", strong: true },
    ],
  },
  {
    name: "Эксперт",
    plan: "hunter",
    tagline: "Полный профессиональный доступ",
    code: "PL—02",
    price: "120 000",
    period: "₽ · разовый доступ",
    cta: "Выбрать тариф",
    highlight: true,
    features: [
      { text: "Всё из тарифа «Старт»", strong: false },
      { text: "Безлимитная энергия", strong: true },
      { text: "AI-тренировки: чат с клиентом без лимита", strong: true },
      { text: "Оба полных курса включены в доступ", strong: false },
      { text: "Курс «Юридические аспекты» — полный курс", strong: false },
      { text: "Курс «Экспертный уровень БФЛ» — полный курс", strong: false },
      { text: "AI-помощник в базе знаний", strong: false },
    ],
  },
];

const SECTIONS = [
  { id: "about", label: "О нас" },
  { id: "experts", label: "Эксперты" },
  { id: "products", label: "Продукты" },
  { id: "certificate", label: "Сертификат" },
  { id: "tariffs", label: "Тарифы" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono uppercase tabular-nums" style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}

/* Shared stagger reveal for section children */
const reveal = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay },
});

/* ── Theme picker panel (сегментированный «выбор темы») ───────────────────── */
function ThemePanel() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const opts = [
    { key: "light", label: "Светлая", Icon: Sun, active: mounted && !isDark },
    { key: "dark", label: "Тёмная", Icon: Moon, active: isDark },
  ] as const;

  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-2xl p-1"
      style={{ border: "1px solid var(--border-color)", background: "var(--surface-card)" }}
      role="group"
      aria-label="Выбор темы"
    >
      {opts.map(({ key, label, Icon, active }) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold transition-colors"
          style={{
            background: active ? "var(--primary)" : "transparent",
            color: active ? "var(--primary-contrast, #fff)" : "var(--text-secondary)",
          }}
          aria-pressed={active}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Sections ─────────────────────────────────────────────────────────────── */

function AboutSection({ openRegister }: { openRegister: () => void }) {
  return (
    <div className="py-2">
      <motion.div {...reveal(0)}>
        <Eyebrow>
          <span style={{ fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.04em" }}>
            Legal<span style={{ color: "var(--brand-logo-hunter)" }}>Hunter</span>
          </span>
          {" · Платформа №1 в России"}
        </Eyebrow>
      </motion.div>

      <motion.h1
        {...reveal(0.06)}
        className="mt-7 font-display font-bold"
        style={{ color: "var(--text-primary)", fontSize: "clamp(2.6rem, 7vw, 6rem)", lineHeight: 0.96, letterSpacing: "-0.05em" }}
      >
        Учим юристов
        <br />
        <span style={{ color: "var(--primary)" }}>помогать людям.</span>
      </motion.h1>

      <motion.p
        {...reveal(0.12)}
        className="mt-8 max-w-2xl leading-relaxed"
        style={{ color: "var(--text-muted)", fontSize: "clamp(1.05rem, 1.6vw, 1.375rem)" }}
      >
        Не курс, а профессиональная среда: практика, эксперты и технологии превращают знание
        закона в уверенные действия рядом с человеком в долговой яме.
      </motion.p>

      <motion.div {...reveal(0.18)} className="mt-10 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={openRegister} iconRight={<ArrowRight size={18} />}>
          Начать обучение
        </Button>
        <a
          href="https://t.me/BFLHUNTER_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2.5 rounded-full px-6 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5"
          style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)", background: "var(--surface-card)" }}
        >
          <Send size={16} style={{ color: "var(--primary)" }} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          Задать вопрос в Telegram
        </a>
      </motion.div>

      <motion.div
        {...reveal(0.24)}
        className="mt-16 grid gap-px overflow-hidden sm:grid-cols-2 xl:grid-cols-3"
        style={{ background: "var(--border-color)", border: "1px solid var(--border-color)", borderRadius: 20 }}
      >
        {stats.map((item) => (
          <div
            key={item.value}
            className="group p-7 transition-colors"
            style={{ background: "var(--bg-primary)" }}
          >
            <div
              className="font-mono font-semibold leading-none tabular-nums transition-transform group-hover:-translate-y-0.5"
              style={{ color: "var(--text-muted)", fontSize: "clamp(2rem, 3.4vw, 3.2rem)", letterSpacing: "-0.03em" }}
            >
              {item.value}
            </div>
            <p className="mt-3.5 text-[15px] leading-snug" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function ExpertsSection() {
  return (
    <div className="py-2">
      <motion.div {...reveal(0)} className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Eyebrow>02 · Эксперты</Eyebrow>
          <h2
            className="mt-4 max-w-4xl font-display font-semibold"
            style={{ color: "var(--text-primary)", fontSize: "clamp(2.2rem, 5.2vw, 4.5rem)", lineHeight: 0.96, letterSpacing: "-0.045em", hyphens: "none", WebkitHyphens: "none", wordBreak: "normal" }}
          >
            Практики, которые учат на реальных процедурах.
          </h2>
        </div>
        <p className="max-w-sm text-[17px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          Команда объединяет юристов, методологов и специалистов по сопровождению банкротства по всей России.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {experts.map((expert, i) => {
          const initials = expert.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
          return (
            <motion.div key={expert.name} {...reveal(0.06 + i * 0.05)} className="h-full">
              <Card padded={false} className="group flex h-full flex-col overflow-hidden transition-all hover:-translate-y-1">
                <div className="aspect-[4/5] shrink-0 overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
                  {expert.image ? (
                    <Image
                      src={expert.image}
                      alt={expert.name}
                      width={520}
                      height={650}
                      style={{ objectFit: "cover", objectPosition: "center top" }}
                      className="h-full w-full transition-transform duration-700 group-hover:scale-[1.06]"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ color: "var(--text-muted)" }}>
                      <span className="font-display text-5xl font-semibold tracking-tight">{initials}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em]">Фото скоро</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 p-5">
                  <h3 className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>{expert.name}</h3>
                  <p className="mt-1.5 text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>{expert.role}</p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ProductsSection() {
  return (
    <div className="py-2">
      <motion.div {...reveal(0)}>
        <Eyebrow>
          03 · Наши продукты &amp;{" "}
          <a
            href="https://tech-pravo.ru/"
            target="_blank"
            rel="noopener noreferrer"
            title="ТехнологИИ Права — tech-pravo.ru"
            className="underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
            style={{ color: "#22D3EE", textDecorationColor: "#22D3EE", fontWeight: 800 }}
          >
            Технолог<span style={{ color: "#EC4899" }}>ИИ</span> Права
          </a>
        </Eyebrow>
        <h2
          className="mt-4 max-w-3xl font-display font-semibold"
          style={{ color: "var(--text-primary)", fontSize: "clamp(2.2rem, 5.2vw, 4.5rem)", lineHeight: 0.96, letterSpacing: "-0.045em" }}
        >
          Обучение, практика, аттестация.
        </h2>
      </motion.div>

      <div className="mt-12 flex flex-col" style={{ borderTop: "1px solid var(--border-color)" }}>
        {products.map((product, index) => (
          <motion.article
            key={product.title}
            {...reveal(0.06 + index * 0.06)}
            className="group grid items-start gap-5 py-8 sm:grid-cols-[110px_1fr]"
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            <div
              className="font-mono font-semibold tabular-nums transition-colors"
              style={{ color: "var(--text-muted)", fontSize: "clamp(2.4rem, 4vw, 3.4rem)", letterSpacing: "-0.04em", lineHeight: 0.9 }}
            >
              {String(index + 1).padStart(2, "0")}
            </div>
            <div>
              <h3
                className="font-semibold tracking-tight transition-transform group-hover:translate-x-1"
                style={{ color: "var(--text-primary)", fontSize: "clamp(1.4rem, 2.4vw, 2rem)", letterSpacing: "-0.02em" }}
              >
                {product.title}
              </h3>
              <p className="mt-3 max-w-2xl text-[16px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{product.text}</p>
            </div>
          </motion.article>
        ))}
      </div>

      <motion.div {...reveal(0.28)} className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <Eyebrow>Экосистема AI &amp; право</Eyebrow>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] sm:block" style={{ color: "var(--text-muted)" }}>12 направлений в разработке</span>
        </div>
        <div
          className="group relative overflow-hidden py-7 w-screen left-1/2 -translate-x-1/2"
          style={{
            background: "var(--surface-card)",
            borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)",
            maskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
          }}
        >
          <div className="flex w-max animate-[ticker_42s_linear_infinite] gap-4 group-hover:[animation-play-state:paused]">
            {[...ecosystem, ...ecosystem].map((item, i) =>
              typeof item === "string" ? (
                <span
                  key={`${item}-${i}`}
                  className="inline-flex shrink-0 items-center gap-2.5 rounded-full px-6 py-3 text-[15px] font-medium"
                  style={{ border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-secondary)" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />
                  {item}
                </span>
              ) : (
                <a
                  key={`${item.label}-${i}`}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-2.5 rounded-full px-6 py-3 text-[15px] font-semibold transition-opacity hover:opacity-90"
                  style={{ border: "1px solid var(--primary)", background: "var(--primary)", color: "#fff" }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: "#fff" }} />
                  {item.label}
                </a>
              )
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CertificateSection({ openRegister }: { openRegister: () => void }) {
  return (
    <div className="mx-auto max-w-4xl py-2 text-center">
      <motion.div {...reveal(0)}>
        <Eyebrow>04 · Сертификат</Eyebrow>
        <h2
          className="mx-auto mt-5 font-display font-semibold"
          style={{ color: "var(--text-primary)", fontSize: "clamp(2.4rem, 5.8vw, 5rem)", lineHeight: 0.95, letterSpacing: "-0.045em" }}
        >
          Сертификат,
          <br />
          которому доверяют.
        </h2>
        <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Документ эксперта по банкротству физических лиц, заверенный практикующими юристами РФ.
          Его получают только те, кто прошёл курс и сдал экзамен.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="lg" onClick={openRegister} iconRight={<ArrowRight size={18} />}>Начать обучение</Button>
        </div>
      </motion.div>

      <motion.div {...reveal(0.12)} className="mt-12">
        <CertificatePreview
          variant="locked"
          revealed
          showOverlayText={false}
          palette={CERT_TOKEN_PALETTE}
        />
      </motion.div>

      <motion.p
        {...reveal(0.18)}
        className="mx-auto mt-8 max-w-2xl text-[17px] leading-relaxed"
        style={{ color: "var(--text-secondary)", hyphens: "none", WebkitHyphens: "none" }}
      >
        Пройдите курс экспертов по банкротству физических лиц — и получите сертификат.
      </motion.p>
    </div>
  );
}

function TariffsSection({ openRegister }: { openRegister: () => void }) {
  return (
    <div className="py-2">
      {/* ── КАРКАС: верхние слова сохранены ── */}
      <motion.div {...reveal(0)}>
        <Eyebrow>05 · Тарифы</Eyebrow>
        <h2
          className="mt-4 max-w-3xl font-display font-semibold"
          style={{ color: "var(--text-primary)", fontSize: "clamp(2.2rem, 5.4vw, 4.6rem)", lineHeight: 0.95, letterSpacing: "-0.045em" }}
        >
          Выберите свой тариф.
        </h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Начните бесплатно и переходите на полный доступ, когда будете готовы.
        </p>
      </motion.div>

      {/* ── Два больших редакторских плана (malvah × abstract) ── */}
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {plans.map((plan, i) => {
          const lead = plan.highlight;
          return (
            <motion.div key={plan.name} {...reveal(0.08 + i * 0.08)}>
              <div
                className="relative flex h-full flex-col overflow-hidden rounded-[24px] p-8 transition-all hover:-translate-y-1 sm:p-10"
                style={{
                  background: lead ? "var(--surface-card)" : "var(--bg-primary)",
                  border: `1px solid ${lead ? "var(--primary)" : "var(--border-color)"}`,
                  boxShadow: lead ? "var(--shadow-md)" : "none",
                }}
              >
                {lead && (
                  <span aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--primary)" }} />
                )}

                {/* tagline + code (abstract.com spec-эйбров) */}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.18em", color: lead ? "var(--primary)" : "var(--text-secondary)" }}>
                    {plan.tagline}
                  </span>
                  <div className="flex items-center gap-2">
                    {lead && (
                      <span className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>
                        Рекомендуем
                      </span>
                    )}
                    <span className="font-mono uppercase tabular-nums" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}>
                      {plan.code}
                    </span>
                  </div>
                </div>

                {/* name */}
                <h3
                  className="mt-7 font-display font-semibold"
                  style={{ color: "var(--text-primary)", fontSize: "clamp(2rem, 3.4vw, 3rem)", lineHeight: 0.96, letterSpacing: "-0.04em" }}
                >
                  {plan.name}
                </h3>

                {/* price */}
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="font-mono font-semibold leading-none tabular-nums" style={{ color: "var(--text-primary)", fontSize: "clamp(2.6rem, 5vw, 3.6rem)", letterSpacing: "-0.04em" }}>
                    {plan.price}
                  </span>
                  <span className="text-[15px]" style={{ color: "var(--text-muted)" }}>{plan.period}</span>
                </div>

                <Button
                  variant={lead ? "primary" : "secondary"}
                  size="lg"
                  onClick={openRegister}
                  iconRight={<ArrowRight size={18} />}
                  fluid
                  className="mt-7"
                >
                  {plan.cta}
                </Button>

                {/* features — хайрлайн-список, без коробок */}
                <ul className="mt-8 flex flex-1 flex-col gap-px pt-1">
                  {plan.features.map((f) => (
                    <li
                      key={f.text}
                      className="flex items-start gap-3 py-3.5"
                      style={{ borderTop: "1px solid var(--border-color)" }}
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: f.strong ? "var(--primary)" : "var(--primary-muted)",
                          color: f.strong ? "var(--primary-contrast, #fff)" : "var(--primary)",
                        }}
                      >
                        {f.strong ? <InfinityIcon size={12} /> : <Check size={12} strokeWidth={3} />}
                      </span>
                      <span
                        className="text-[15.5px] leading-snug"
                        style={{ color: f.strong ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: f.strong ? 600 : 400 }}
                      >
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.p {...reveal(0.26)} className="mt-6 font-mono text-[12px]" style={{ color: "var(--text-muted)", letterSpacing: "0.02em" }}>
        Онлайн-оплата скоро. Пока доступ к платному тарифу открывается после регистрации — свяжитесь с нами в Telegram.
      </motion.p>
    </div>
  );
}

export default function LandingPage() {
  const { openRegister, openLogin } = useLandingAuth();
  const [active, setActive] = useState<SectionId>("about");

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden lg:flex-row" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* ── Навигация по секциям ── */}
      <nav
        className="flex shrink-0 flex-col gap-5 border-b px-5 py-5 lg:h-screen lg:w-[280px] lg:border-b-0 lg:border-r lg:px-7 lg:py-9"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setActive("about")} className="text-left text-xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Legal<span style={{ color: "var(--brand-logo-hunter)" }}>Hunter</span>
          </button>
          <button onClick={openLogin} className="text-sm font-medium lg:hidden" style={{ color: "var(--text-secondary)" }}>Войти</button>
        </div>

        {/* section links — horizontal chips on mobile, vertical list on desktop */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 lg:mx-0 lg:flex-1 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-0">
          {SECTIONS.map((s, i) => {
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className="flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-left text-[15px] transition-all lg:rounded-xl"
                style={{
                  background: isActive ? "var(--primary-muted)" : "transparent",
                  color: isActive ? "var(--primary)" : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <span className="hidden font-mono text-[11px] tabular-nums opacity-70 lg:inline">{String(i + 1).padStart(2, "0")}</span>
                {s.label}
              </button>
            );
          })}

          {/* Отдельный таб чемпионата — навигация на /championship (не in-page скролл) */}
          <Link
            href="/championship"
            className="flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-left text-[15px] no-underline transition-all lg:rounded-xl"
            style={{
              background: "color-mix(in srgb, var(--primary) 15%, transparent)",
              color: "var(--primary)",
              fontWeight: 600,
            }}
          >
            <Trophy size={15} className="lg:hidden" />
            <span className="hidden font-mono text-[11px] tabular-nums opacity-70 lg:inline">★</span>
            Чемпионат
          </Link>
        </div>

        {/* CTA + theme — desktop only at bottom */}
        <div className="hidden flex-col gap-3 lg:flex">
          {/* Промо-панель чемпионата — над выбором темы, ведёт на /championship */}
          <Link
            href="/championship"
            className="group flex items-center gap-3.5 rounded-2xl p-4 no-underline transition-transform hover:scale-[1.03]"
            style={{ background: "color-mix(in srgb, var(--primary) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)" }}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{ background: "#fff" }}
            >
              <TrophyMark size={26} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                Чемпионат сезона
              </span>
              <span className="block text-[12px] leading-tight" style={{ color: "var(--text-secondary)" }}>
                Розыгрыш призов Apple
              </span>
            </span>
            <ArrowRight size={17} className="ml-auto transition-transform group-hover:translate-x-0.5" style={{ color: "var(--primary)" }} />
          </Link>

          {/* панель выбора темы над «Войти» */}
          <ThemePanel />
          <Button variant="secondary" onClick={openLogin} fluid>Войти</Button>
          <Button variant="primary" onClick={openRegister} fluid iconRight={<ArrowRight size={16} />}>Начать</Button>
        </div>
      </nav>

      {/* ── Активная секция — на весь экран, со скроллом внутри при необходимости ── */}
      <div className="h-full flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
          <div className="mx-auto w-full max-w-[1200px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {active === "about" && <AboutSection openRegister={openRegister} />}
                {active === "experts" && <ExpertsSection />}
                {active === "products" && <ProductsSection />}
                {active === "certificate" && <CertificateSection openRegister={openRegister} />}
                {active === "tariffs" && <TariffsSection openRegister={openRegister} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
