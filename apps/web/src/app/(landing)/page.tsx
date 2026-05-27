"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Phone,
  MessageSquare,
  BarChart3,
  Zap,
  Shield,
  Target,
  BookOpen,
  CheckCircle2,
  Play,
  Award,
  AlertTriangle,
  Briefcase,
  GraduationCap,
  TrendingUp,
  Clock,
} from "lucide-react";
import { useLandingAuth } from "@/components/landing/LandingAuthContext";

/* ── CountUp ────────────────────────────────────────────────────── */
function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  const animate = useCallback(() => {
    const duration = 1800;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          animate();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [animate]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

/* ── Marquee strip ──────────────────────────────────────────────── */
function MarqueeStrip() {
  const items = [
    "Переговоры с должниками",
    "Работа с возражениями",
    "Интерактивные кейсы",
    "Арбитражное управление",
    "127-ФЗ о банкротстве",
    "AI-аналитика звонков",
    "Сертификация",
    "24 ак. часа ПК",
  ];
  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden py-5" style={{ background: "#2563EB" }}>
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((text, i) => (
          <span
            key={i}
            className="flex items-center gap-8 text-sm font-semibold uppercase tracking-[0.15em]"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            {text}
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.4)" }}
            />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ── Services data ──────────────────────────────────────────────── */
const SERVICES = [
  {
    num: "1",
    icon: MessageSquare,
    title: "AI-тренировки",
    subtitle: "60+ сценариев из практики",
    description:
      "Общайтесь с AI-должниками голосом или текстом. Скептики, манипуляторы, паникёры — каждый с уникальной историей. Ваши решения определяют исход.",
    color: "#2563EB",
    features: ["Адаптивное поведение AI", "Голосовые и текстовые тренировки", "Детальный разбор после сессии"],
  },
  {
    num: "2",
    icon: Briefcase,
    title: "Интерактивные кейсы",
    subtitle: "Реальные ситуации",
    description:
      "Разбирайте настоящие дела из арбитражной практики. Ветвящиеся сценарии, где каждое решение ведёт к разным последствиям.",
    color: "#8B5CF6",
    features: ["Кейсы из реальной практики", "Ветвление решений", "Анализ последствий"],
  },
  {
    num: "3",
    icon: GraduationCap,
    title: "Экзамены и сертификация",
    subtitle: "24 ак. часа ПК",
    description:
      "Пройдите модули аттестации, сдайте экзамены под AI-прокторингом и получите сертификат повышения квалификации.",
    color: "#F59E0B",
    features: ["AI-прокторинг", "Электронный сертификат с QR", "Засчитывается как ПК"],
  },
] as const;

/* ═══════════════════════════ PAGE ═══════════════════════════════ */
export default function Home() {
  const { openRegister } = useLandingAuth();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  return (
    <>
      {/* ═══ HERO ═════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col justify-center overflow-hidden"
        style={{ background: "#09090B" }}
      >
        {/* Subtle noise texture via CSS */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Blue accent line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent, #2563EB, transparent)" }}
        />

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-10 w-full"
        >
          <div className="pt-32 pb-24 sm:pt-40 sm:pb-32">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-10"
            >
              <span
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: "#2563EB" }}
              >
                <span
                  className="w-8 h-[2px]"
                  style={{ background: "#2563EB" }}
                />
                Учебная платформа для арбитражных управляющих
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-[clamp(2.5rem,7vw,5.5rem)] font-black leading-[0.95] tracking-[-0.03em] mb-8"
              style={{ color: "#FAFAFA" }}
            >
              Обучение,
              <br />
              которое
              <br />
              <span style={{ color: "#2563EB" }}>сертифицирует</span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-lg sm:text-xl leading-relaxed max-w-lg mb-12"
              style={{ color: "#71717A" }}
            >
              AI-тренировки, интерактивные кейсы, экзамены с&nbsp;сертификацией.
              24 ак.&nbsp;часа повышения квалификации для&nbsp;арбитражных
              управляющих — онлайн, в&nbsp;своём темпе.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="flex flex-wrap items-center gap-4"
            >
              <button
                onClick={openRegister}
                className="group inline-flex items-center gap-3 px-8 py-4 text-[15px] font-bold text-white transition-all duration-200 rounded-lg"
                style={{ background: "#2563EB" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1D4ED8";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 8px 32px rgba(37,99,235,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#2563EB";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Начать обучение
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>

              <button
                className="group inline-flex items-center gap-2.5 px-6 py-4 text-[15px] font-semibold transition-all duration-200 rounded-lg"
                style={{
                  color: "#A1A1AA",
                  border: "1px solid #27272A",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#3F3F46";
                  e.currentTarget.style.color = "#FAFAFA";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#27272A";
                  e.currentTarget.style.color = "#A1A1AA";
                }}
              >
                <Play size={14} fill="currentColor" />
                Смотреть демо
              </button>
            </motion.div>
          </div>

          {/* Stats strip — bottom of hero */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-wrap gap-x-16 gap-y-6 pb-16 border-t pt-10"
            style={{ borderColor: "#18181B" }}
          >
            {[
              { target: 24, suffix: "", label: "ак. часов в программе" },
              { target: 60, suffix: "+", label: "сценариев" },
              { target: 5, suffix: "", label: "экзаменов" },
              { target: 100, suffix: "%", label: "онлайн-формат" },
            ].map(({ target, suffix, label }) => (
              <div key={label} className="flex items-baseline gap-3">
                <span
                  className="text-3xl sm:text-4xl font-black tabular-nums"
                  style={{ color: "#FAFAFA" }}
                >
                  <CountUp target={target} suffix={suffix} />
                </span>
                <span
                  className="text-sm uppercase tracking-wider"
                  style={{ color: "#52525B" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>

      </section>

      {/* ═══ MARQUEE ═════════════════════════════════════════════ */}
      <MarqueeStrip />

      {/* ═══ PROBLEM (Fear trigger) ════════════════════════════════ */}
      <section className="py-24 sm:py-32" style={{ background: "#09090B" }}>
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] mb-4"
              style={{ color: "#EF4444" }}
            >
              <AlertTriangle size={14} />
              Знаете ли вы
            </span>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1]"
              style={{ color: "#FAFAFA" }}
            >
              24 ак.&nbsp;часа в год — <span style={{ color: "#EF4444" }}>обязанность</span>,
              <br />не выбор
            </h2>
            <p
              className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mt-6"
              style={{ color: "#71717A" }}
            >
              Каждый арбитражный управляющий обязан ежегодно проходить повышение
              квалификации. Без подтверждения — риск приостановки статуса СРО.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Clock,
                stat: "24 ч/год",
                title: "Обязательный минимум",
                text: "Закон требует не менее 24 академических часов повышения квалификации ежегодно.",
                color: "#EF4444",
              },
              {
                icon: TrendingUp,
                stat: "15-20K",
                title: "Управляющих в России",
                text: "И все нуждаются в актуальном обучении. Ни один конкурент не предлагает AI-формат.",
                color: "#F59E0B",
              },
              {
                icon: Award,
                stat: "0",
                title: "Альтернатив с AI",
                text: "Никто в России не даёт интерактивное обучение с AI-клиентами и сертификацией.",
                color: "#2563EB",
              },
            ].map(({ icon: Icon, stat, title, text, color }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-2xl p-8 text-center"
                style={{ background: "#18181B", border: "1px solid #27272A" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: `${color}15` }}
                >
                  <Icon size={22} style={{ color }} />
                </div>
                <div
                  className="text-3xl font-black mb-2"
                  style={{ color }}
                >
                  {stat}
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: "#FAFAFA" }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#71717A" }}>
                  {text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SERVICES ════════════════════════════════════════════ */}
      <section className="py-28 sm:py-36" style={{ background: "#FAFAFA" }}>
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10">
          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-20">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span
                className="text-xs font-bold uppercase tracking-[0.2em] mb-4 block"
                style={{ color: "#2563EB" }}
              >
                Платформа
              </span>
              <h2
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.05]"
                style={{ color: "#09090B" }}
              >
                Полный цикл
                <br />
                обучения и аттестации
              </h2>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-base leading-relaxed max-w-sm"
              style={{ color: "#71717A" }}
            >
              Тренировки, кейсы и&nbsp;экзамены — единая экосистема,
              где каждый час засчитывается в&nbsp;повышение квалификации.
            </motion.p>
          </div>

          {/* Service cards — stacked full-width */}
          <div className="flex flex-col gap-4">
            {SERVICES.map(({ num, icon: Icon, title, subtitle, description, color, features }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group relative grid grid-cols-1 md:grid-cols-[80px_1fr_1fr] gap-6 md:gap-10 rounded-2xl p-8 sm:p-10 transition-all duration-300"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E4E4E7",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.boxShadow = `0 1px 3px rgba(0,0,0,0.04), 0 16px 48px ${color}12`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#E4E4E7";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Number */}
                <div
                  className="text-5xl md:text-6xl font-black leading-none"
                  style={{ color: "#E4E4E7" }}
                >
                  {num}
                </div>

                {/* Title + description */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}10` }}
                    >
                      <Icon size={20} style={{ color }} />
                    </div>
                    <div>
                      <h3
                        className="text-xl font-bold"
                        style={{ color: "#09090B" }}
                      >
                        {title}
                      </h3>
                      <span className="text-sm" style={{ color: "#A1A1AA" }}>
                        {subtitle}
                      </span>
                    </div>
                  </div>
                  <p
                    className="text-base leading-relaxed mt-4"
                    style={{ color: "#52525B" }}
                  >
                    {description}
                  </p>
                </div>

                {/* Features list */}
                <div className="flex flex-col justify-center gap-3">
                  {features.map((f) => (
                    <div
                      key={f}
                      className="flex items-center gap-2.5 text-sm"
                      style={{ color: "#3F3F46" }}
                    >
                      <CheckCircle2
                        size={16}
                        style={{ color, flexShrink: 0 }}
                      />
                      {f}
                    </div>
                  ))}
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-semibold mt-2 transition-all group-hover:gap-2.5"
                    style={{ color }}
                  >
                    Подробнее <ArrowUpRight size={14} />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY US — Dark ════════════════════════════════════════ */}
      <section className="py-28 sm:py-36" style={{ background: "#09090B" }}>
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <span
              className="text-xs font-bold uppercase tracking-[0.2em] mb-4 block"
              style={{ color: "#2563EB" }}
            >
              Преимущества
            </span>
            <h2
              className="text-4xl sm:text-5xl font-black tracking-tight"
              style={{ color: "#FAFAFA" }}
            >
              Создан для результата
            </h2>
          </motion.div>

          {/* Bento grid — 2x2 with featured card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: Award,
                title: "Реальный сертификат",
                description: "Электронный сертификат с QR-кодом верификации. Засчитывается как повышение квалификации по 127-ФЗ.",
                accent: "#F59E0B",
              },
              {
                icon: Shield,
                title: "AI-прокторинг",
                description: "Экзамены проходят под контролем AI-наблюдателя. Гарантия честности и объективности оценки.",
                accent: "#2563EB",
              },
              {
                icon: Target,
                title: "Измеримый прогресс",
                description: "Карта компетенций обновляется после каждой сессии. Видите свой рост в реальном времени.",
                accent: "#8B5CF6",
              },
              {
                icon: Zap,
                title: "В своём темпе",
                description: "Учитесь когда удобно — без расписания, без поездок. Весь курс доступен онлайн 24/7.",
                accent: "#10B981",
              },
            ].map(({ icon: Icon, title, description, accent }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="group rounded-2xl p-8 sm:p-10 transition-all duration-300"
                style={{
                  background: "#18181B",
                  border: "1px solid #27272A",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${accent}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#27272A";
                }}
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center mb-6"
                  style={{ background: `${accent}15` }}
                >
                  <Icon size={20} style={{ color: accent }} />
                </div>
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ color: "#FAFAFA" }}
                >
                  {title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#71717A" }}
                >
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ════════════════════════════════════════ */}
      <section className="py-28 sm:py-36" style={{ background: "#FAFAFA" }}>
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-20"
          >
            <span
              className="text-xs font-bold uppercase tracking-[0.2em] mb-4 block"
              style={{ color: "#2563EB" }}
            >
              Как это работает
            </span>
            <h2
              className="text-4xl sm:text-5xl font-black tracking-tight"
              style={{ color: "#09090B" }}
            >
              Три шага
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-20">
            {[
              {
                step: "1",
                title: "Тренируйтесь",
                text: "AI-тренировки с реалистичными должниками, интерактивные кейсы из арбитражной практики. Каждая сессия — ак. час в копилку.",
              },
              {
                step: "2",
                title: "Сдайте экзамены",
                text: "5 модулей аттестации под AI-прокторингом. Вопросы из реальной практики, не из учебника.",
              },
              {
                step: "3",
                title: "Получите сертификат",
                text: "Электронный сертификат с QR-верификацией. 24 ак. часа повышения квалификации — без поездок и очных семинаров.",
              },
            ].map(({ step, title, text }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="relative"
              >
                {/* Step number — large decorative */}
                <div
                  className="text-[6rem] sm:text-[7rem] font-black leading-none mb-2 select-none"
                  style={{ color: "#E4E4E7" }}
                >
                  {step}
                </div>
                {/* Colored top line */}
                <div
                  className="w-12 h-1 rounded-full mb-5"
                  style={{ background: i === 1 ? "#8B5CF6" : "#2563EB" }}
                />
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ color: "#09090B" }}
                >
                  {title}
                </h3>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: "#71717A" }}
                >
                  {text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA — Bold blue ════════════════════════════════════ */}
      <section
        className="relative py-28 sm:py-36 overflow-hidden"
        style={{ background: "#2563EB" }}
      >
        {/* Subtle pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto px-6 sm:px-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-[1.05]"
              style={{ color: "#FFFFFF" }}
            >
              Начните набирать часы ПК
            </h2>
            <p
              className="text-lg max-w-md mx-auto mb-10 leading-relaxed"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Первые модули бесплатно. Без обязательств,
              без кредитной карты. 24 ак. часа — ваша цель на год.
            </p>
            <button
              onClick={openRegister}
              className="group inline-flex items-center gap-3 px-9 py-4 rounded-lg text-[15px] font-bold transition-all duration-200"
              style={{
                background: "#FFFFFF",
                color: "#2563EB",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Начать обучение
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </motion.div>
        </div>
      </section>
    </>
  );
}
