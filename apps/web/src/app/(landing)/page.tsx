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
  Star,
  Users,
  Quote,
  QrCode,
  Linkedin,
  Check,
  Crown,
} from "lucide-react";
import { useLandingAuth } from "@/components/landing/LandingAuthContext";

/* ── Premium easing ────────────────────────────────────────────── */
const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const;

/* ── Noise SVG data URI ────────────────────────────────────────── */
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/* ── Ambient Glow Orb component ─────────────────────────────────── */
function GlowOrb({
  color = "rgba(37,99,235,0.06)",
  size = 700,
  top,
  left,
  right,
  bottom,
}: {
  color?: string;
  size?: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
}) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: "blur(80px)",
        top,
        left,
        right,
        bottom,
      }}
    />
  );
}

/* ── Corner bracket decorator ──────────────────────────────────── */
function CornerBrackets({ color }: { color: string }) {
  const bracketStyle = {
    position: "absolute" as const,
    width: 20,
    height: 20,
    borderColor: color,
    opacity: 0.5,
  };
  return (
    <>
      <div
        style={{
          ...bracketStyle,
          top: -1,
          left: -1,
          borderTop: "2px solid",
          borderLeft: "2px solid",
          borderColor: color,
          borderRadius: "2px 0 0 0",
          boxShadow: `0 0 8px ${color}40`,
        }}
      />
      <div
        style={{
          ...bracketStyle,
          bottom: -1,
          right: -1,
          borderBottom: "2px solid",
          borderRight: "2px solid",
          borderColor: color,
          borderRadius: "0 0 2px 0",
          boxShadow: `0 0 8px ${color}40`,
        }}
      />
    </>
  );
}

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
      {/* ── Fixed noise texture overlay (dark sections only) ──── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          backgroundImage: NOISE_SVG,
          opacity: 0.025,
          mixBlendMode: "overlay",
        }}
      />

      {/* ═══ HERO ═════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col justify-center overflow-hidden"
        style={{ background: "#09090B" }}
      >
        {/* Ambient glow orbs */}
        <GlowOrb color="rgba(37,99,235,0.06)" size={800} top="-20%" left="-10%" />
        <GlowOrb color="rgba(139,92,246,0.04)" size={600} top="30%" right="-15%" />

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
              transition={{ duration: 0.5, ease: PREMIUM_EASE }}
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

            {/* Headline with clip-path reveal */}
            <motion.h1
              initial={{ clipPath: "inset(100% 0 0 0)", opacity: 0 }}
              animate={{ clipPath: "inset(0%)", opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.1, ease: PREMIUM_EASE }}
              className="text-[clamp(2.5rem,7vw,5.5rem)] font-black leading-[0.95] tracking-[-0.03em] mb-8"
              style={{ color: "#FAFAFA" }}
            >
              Обучение,
              <br />
              которое
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #2563EB 0%, #8B5CF6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                сертифицирует
              </span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25, ease: PREMIUM_EASE }}
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
              transition={{ duration: 0.6, delay: 0.35, ease: PREMIUM_EASE }}
              className="flex flex-wrap items-center gap-4"
            >
              <button
                onClick={openRegister}
                className="group inline-flex items-center gap-3 px-8 py-4 text-[15px] font-bold text-white transition-all duration-200 rounded-lg"
                style={{ background: "#2563EB" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1D4ED8";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 0 24px rgba(37,99,235,0.4), 0 8px 32px rgba(37,99,235,0.3)";
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
              <div key={label} className="relative flex items-baseline gap-3">
                <span
                  className="text-3xl sm:text-4xl font-black tabular-nums relative"
                  style={{ color: "#FAFAFA" }}
                >
                  <CountUp target={target} suffix={suffix} />
                  {/* Blue glow underneath stat */}
                  <span
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-full h-4 rounded-full pointer-events-none"
                    style={{
                      background: "radial-gradient(ellipse, rgba(37,99,235,0.15) 0%, transparent 70%)",
                      filter: "blur(4px)",
                    }}
                  />
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
      <section className="relative py-24 sm:py-32 overflow-hidden" style={{ background: "#09090B" }}>
        {/* Ambient orbs */}
        <GlowOrb color="rgba(239,68,68,0.04)" size={600} top="-20%" right="-10%" />
        <GlowOrb color="rgba(37,99,235,0.04)" size={500} bottom="-15%" left="-5%" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
            whileInView={{ opacity: 1, clipPath: "inset(0)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: PREMIUM_EASE }}
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
                transition={{ delay: i * 0.1, duration: 0.5, ease: PREMIUM_EASE }}
                className="rounded-2xl p-8 text-center transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `rgba(37,99,235,0.3)`;
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(37,99,235,0.08), 0 8px 32px rgba(0,0,0,0.3)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
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

      {/* ═══ PAIN POINTS — "Знакомо?" ═══════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden" style={{ background: "#09090B" }}>
        <GlowOrb color="rgba(139,92,246,0.04)" size={600} top="10%" left="-10%" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-4"
              style={{ color: "#FAFAFA" }}
            >
              Знакомо?
            </h2>
            <p
              className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto"
              style={{ color: "#71717A" }}
            >
              Так выглядит повышение квалификации для большинства АУ
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              "Семинар на 8 часов, из которых полезных — 40 минут",
              "Лектор читает по слайдам то, что вы знали 5 лет назад",
              "Диплом есть, знаний — нет",
              "Каждый год одно и то же, но 24 часа набрать надо",
            ].map((pain, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: PREMIUM_EASE }}
                className="flex items-start gap-4 rounded-2xl p-6 transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(37,99,235,0.3)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(37,99,235,0.08), 0 8px 32px rgba(0,0,0,0.3)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(239,68,68,0.12)" }}
                >
                  <AlertTriangle size={18} style={{ color: "#EF4444" }} />
                </div>
                <p
                  className="text-[15px] leading-relaxed font-medium"
                  style={{ color: "#D4D4D8" }}
                >
                  {pain}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-center mt-12 text-base font-semibold"
            style={{ color: "#2563EB" }}
          >
            Мы создали платформу, где каждый час обучения — полезный
          </motion.p>
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
              transition={{ duration: 0.6, ease: PREMIUM_EASE }}
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

          {/* Service cards — stacked full-width with ChainGPT-style hover */}
          <div className="flex flex-col gap-4">
            {SERVICES.map(({ num, icon: Icon, title, subtitle, description, color, features }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: PREMIUM_EASE }}
                className="group relative grid grid-cols-1 md:grid-cols-[80px_1fr_1fr] gap-6 md:gap-10 rounded-2xl p-8 sm:p-10 transition-all duration-300"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E4E4E7",
                  borderTop: "2px solid #E4E4E7",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderTopColor = color;
                  e.currentTarget.style.borderImage = `linear-gradient(90deg, ${color}, transparent) 1`;
                  e.currentTarget.style.borderImageSlice = "1";
                  e.currentTarget.style.boxShadow = `0 4px 24px ${color}15, 0 1px 3px rgba(0,0,0,0.04)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderTopColor = "#E4E4E7";
                  e.currentTarget.style.borderImage = "none";
                  e.currentTarget.style.borderColor = "#E4E4E7";
                  e.currentTarget.style.borderTopWidth = "2px";
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
      <section className="relative py-28 sm:py-36 overflow-hidden" style={{ background: "#09090B" }}>
        {/* Ambient orbs */}
        <GlowOrb color="rgba(37,99,235,0.06)" size={700} top="-15%" right="-5%" />
        <GlowOrb color="rgba(139,92,246,0.04)" size={500} bottom="-10%" left="-8%" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
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

          {/* Bento grid — 2x2 with corner brackets */}
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
                transition={{ delay: i * 0.08, duration: 0.5, ease: PREMIUM_EASE }}
                className="group relative rounded-2xl p-8 sm:p-10 transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(37,99,235,0.3)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(37,99,235,0.08), 0 8px 32px rgba(0,0,0,0.3)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* Corner bracket decorators */}
                <CornerBrackets color={accent} />

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

      {/* ═══ CERTIFICATE SHOWCASE ═══════════════════════════════ */}
      <section className="relative py-28 sm:py-36 overflow-hidden" style={{ background: "#09090B" }}>
        <GlowOrb color="rgba(245,158,11,0.05)" size={600} top="20%" left="-10%" />
        <GlowOrb color="rgba(37,99,235,0.04)" size={500} bottom="-10%" right="-5%" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="text-center mb-16"
          >
            <span
              className="text-xs font-bold uppercase tracking-[0.2em] mb-4 block"
              style={{ color: "#F59E0B" }}
            >
              Документ
            </span>
            <h2
              className="text-4xl sm:text-5xl font-black tracking-tight"
              style={{ color: "#FAFAFA" }}
            >
              Сертификат, которому доверяют
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: PREMIUM_EASE }}
            className="max-w-lg mx-auto"
          >
            {/* Certificate card with gold-to-amber gradient border */}
            <div
              className="relative rounded-3xl p-[2px] overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #F59E0B, #D97706, #B45309, #F59E0B)",
              }}
            >
              {/* Shine animation overlay */}
              <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 60%)",
                  backgroundSize: "200% 100%",
                  animation: "certShine 4s ease-in-out infinite",
                }}
              />
              <style>{`
                @keyframes certShine {
                  0%, 100% { background-position: 200% 0; }
                  50% { background-position: -200% 0; }
                }
              `}</style>

              <div
                className="rounded-3xl px-10 py-12 text-center relative"
                style={{ background: "#18181B" }}
              >
                {/* Top decorative line */}
                <div
                  className="w-16 h-[2px] mx-auto mb-8"
                  style={{ background: "linear-gradient(90deg, transparent, #F59E0B, transparent)" }}
                />

                <Award size={40} style={{ color: "#F59E0B" }} className="mx-auto mb-6" />

                <h3
                  className="text-2xl sm:text-3xl font-black mb-2"
                  style={{ color: "#FAFAFA" }}
                >
                  Сертификат
                </h3>
                <p
                  className="text-lg font-semibold mb-8"
                  style={{ color: "#D4D4D8" }}
                >
                  повышения квалификации
                </p>

                {/* Placeholder name line */}
                <div
                  className="w-48 h-[1px] mx-auto mb-1"
                  style={{ background: "#3F3F46" }}
                />
                <p className="text-xs mb-8" style={{ color: "#52525B" }}>
                  Имя получателя
                </p>

                {/* QR code placeholder with glow */}
                <div className="flex justify-center mb-6">
                  <div
                    className="w-20 h-20 rounded-lg flex items-center justify-center relative"
                    style={{ background: "#27272A", border: "1px solid #3F3F46" }}
                  >
                    <QrCode size={40} style={{ color: "#52525B" }} />
                    {/* QR glow */}
                    <div
                      className="absolute inset-0 rounded-lg pointer-events-none"
                      style={{
                        boxShadow: "0 0 20px rgba(245,158,11,0.1), 0 0 40px rgba(245,158,11,0.05)",
                      }}
                    />
                  </div>
                </div>

                <p
                  className="text-sm font-semibold mb-6"
                  style={{ color: "#A1A1AA" }}
                >
                  24 ак. часа &bull; ФЗ-127 &bull; Верификация по QR
                </p>

                {/* Bottom decorative line */}
                <div
                  className="w-16 h-[2px] mx-auto mb-6"
                  style={{ background: "linear-gradient(90deg, transparent, #F59E0B, transparent)" }}
                />

                {/* LinkedIn badge */}
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
                  style={{ background: "#27272A", color: "#60A5FA" }}
                >
                  <Linkedin size={14} />
                  Добавьте в LinkedIn
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF ═══════════════════════════════════════ */}
      <section className="py-28 sm:py-36" style={{ background: "#FAFAFA" }}>
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="text-center mb-16"
          >
            <span
              className="text-xs font-bold uppercase tracking-[0.2em] mb-4 block"
              style={{ color: "#8B5CF6" }}
            >
              Отзывы
            </span>
            <h2
              className="text-4xl sm:text-5xl font-black tracking-tight mb-4"
              style={{ color: "#09090B" }}
            >
              Управляющие уже обучаются
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[
              {
                name: "Алексей Петров",
                role: "Арбитражный управляющий, СРО «Альянс»",
                quote:
                  "За 3 года перепробовал все семинары. Здесь впервые почувствовал, что реально учусь, а не отсиживаю часы. AI-должники ведут себя как настоящие.",
              },
              {
                name: "Мария Козлова",
                role: "Арбитражный управляющий, СРО «Стратегия»",
                quote:
                  "Сертификат получила за 2 недели в своём темпе. Коллеги до сих пор не верят, что можно без очных лекций. QR-код на сертификате — удобно для проверки.",
              },
              {
                name: "Дмитрий Волков",
                role: "Арбитражный управляющий, СРО «Содружество»",
                quote:
                  "Кейсы из реальной практики — это то, чего не хватало. Разбираешь ситуацию, принимаешь решения, видишь последствия. Лучше любого учебника.",
              },
            ].map(({ name, role, quote }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: PREMIUM_EASE }}
                className="relative rounded-2xl p-8 flex flex-col"
                style={{ background: "#FFFFFF", border: "1px solid #E4E4E7" }}
              >
                {/* Large decorative quote mark */}
                <div
                  className="absolute top-4 left-6 text-[5rem] font-serif leading-none select-none pointer-events-none"
                  style={{ color: "rgba(0,0,0,0.05)" }}
                >
                  &ldquo;
                </div>
                <Quote size={24} style={{ color: "#E4E4E7" }} className="mb-4 relative z-10" />
                <p
                  className="text-[15px] leading-relaxed flex-1 mb-6 relative z-10"
                  style={{ color: "#3F3F46" }}
                >
                  {quote}
                </p>
                <div className="flex items-center gap-3 relative z-10">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: "#2563EB", color: "#FFFFFF" }}
                  >
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#09090B" }}>
                      {name}
                    </p>
                    <p className="text-xs" style={{ color: "#A1A1AA" }}>
                      {role}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Counter */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-3"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "#2563EB10" }}
            >
              <Users size={22} style={{ color: "#2563EB" }} />
            </div>
            <span
              className="text-lg font-bold"
              style={{ color: "#09090B" }}
            >
              Более{" "}
              <span style={{ color: "#2563EB" }}>
                <CountUp target={200} suffix="+" />
              </span>{" "}
              управляющих уже обучаются
            </span>
          </motion.div>
        </div>
      </section>

      {/* ═══ PRICING ════════════════════════════════════════════ */}
      <section className="relative py-28 sm:py-36 overflow-hidden" style={{ background: "#09090B" }}>
        <GlowOrb color="rgba(37,99,235,0.06)" size={700} top="-10%" left="-5%" />
        <GlowOrb color="rgba(139,92,246,0.04)" size={500} bottom="-10%" right="-8%" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="text-center mb-16"
          >
            <span
              className="text-xs font-bold uppercase tracking-[0.2em] mb-4 block"
              style={{ color: "#2563EB" }}
            >
              Тарифы
            </span>
            <h2
              className="text-4xl sm:text-5xl font-black tracking-tight"
              style={{ color: "#FAFAFA" }}
            >
              Выберите свой план
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Plan: Практик */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: PREMIUM_EASE }}
              className="rounded-2xl p-8 sm:p-10 flex flex-col transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(37,99,235,0.3)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(37,99,235,0.08), 0 8px 32px rgba(0,0,0,0.3)";
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <h3 className="text-2xl font-black mb-1" style={{ color: "#FAFAFA" }}>
                Практик
              </h3>
              <p className="text-sm mb-6" style={{ color: "#71717A" }}>
                Для самостоятельного обучения
              </p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-black" style={{ color: "#FAFAFA" }}>
                  4 900
                </span>
                <span className="text-lg font-semibold" style={{ color: "#71717A" }}>
                  ₽/мес
                </span>
              </div>
              <div className="flex flex-col gap-3.5 mb-10 flex-1">
                {[
                  "AI-тренировки (60+ сценариев)",
                  "Блиц-тесты (8 категорий)",
                  "3 интерактивных кейса/мес",
                  "Базовая аналитика",
                  "Сертификат 12 ак. часов",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm" style={{ color: "#D4D4D8" }}>
                    <Check size={16} style={{ color: "#2563EB", flexShrink: 0 }} />
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={openRegister}
                className="w-full py-3.5 rounded-lg text-[15px] font-bold transition-all duration-200"
                style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#FAFAFA", background: "transparent" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2563EB";
                  e.currentTarget.style.background = "#2563EB15";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Начать обучение
              </button>
            </motion.div>

            {/* Plan: Команда — Featured with gradient border + animated glow */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.5, ease: PREMIUM_EASE }}
              className="relative"
            >
              {/* Animated glow pulse behind the card */}
              <div
                className="absolute -inset-[1px] rounded-2xl pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, #2563EB, #8B5CF6, #2563EB)",
                  backgroundSize: "200% 200%",
                  animation: "gradientShift 3s ease infinite",
                  opacity: 0.7,
                }}
              />
              <div
                className="absolute -inset-[2px] rounded-2xl pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, #2563EB, #8B5CF6, #2563EB)",
                  backgroundSize: "200% 200%",
                  animation: "gradientShift 3s ease infinite",
                  opacity: 0.3,
                  filter: "blur(12px)",
                }}
              />
              <style>{`
                @keyframes gradientShift {
                  0%, 100% { background-position: 0% 50%; }
                  50% { background-position: 100% 50%; }
                }
                @keyframes glowPulse {
                  0%, 100% { opacity: 0.3; }
                  50% { opacity: 0.6; }
                }
              `}</style>

              <div
                className="relative rounded-2xl p-8 sm:p-10 flex flex-col h-full"
                style={{
                  background: "#0F0F12",
                }}
              >
                {/* Popular badge with gradient */}
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold z-20"
                  style={{
                    background: "linear-gradient(135deg, #2563EB, #8B5CF6)",
                    color: "#FFFFFF",
                    boxShadow: "0 0 16px rgba(37,99,235,0.4)",
                  }}
                >
                  <Crown size={12} />
                  Популярный
                </div>

                <h3 className="text-2xl font-black mb-1" style={{ color: "#FAFAFA" }}>
                  Команда
                </h3>
                <p className="text-sm mb-6" style={{ color: "#71717A" }}>
                  Для СРО и групп (от 5 человек)
                </p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black" style={{ color: "#FAFAFA" }}>
                    3 900
                  </span>
                  <span className="text-lg font-semibold" style={{ color: "#71717A" }}>
                    ₽/мес
                  </span>
                </div>
                <p className="text-xs mb-8" style={{ color: "#52525B" }}>
                  за человека, от 5 человек
                </p>
                <div className="flex flex-col gap-3.5 mb-10 flex-1">
                  {[
                    "Всё из «Практик»",
                    "Полный доступ ко всем кейсам",
                    "8 модулей экзаменов",
                    "Расширенная аналитика для РОПа",
                    "Сертификат 24 ак. часа",
                    "Приоритетная поддержка",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-3 text-sm" style={{ color: "#D4D4D8" }}>
                      <Check size={16} style={{ color: "#2563EB", flexShrink: 0 }} />
                      {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={openRegister}
                  className="w-full py-3.5 rounded-lg text-[15px] font-bold text-white transition-all duration-200"
                  style={{ background: "#2563EB" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1D4ED8";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 0 24px rgba(37,99,235,0.4), 0 8px 32px rgba(37,99,235,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#2563EB";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  Подключить команду
                </button>
              </div>
            </motion.div>
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
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
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
                transition={{ delay: i * 0.12, duration: 0.5, ease: PREMIUM_EASE }}
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

      {/* ═══ FINAL CTA ════════════════════════════════════════ */}
      <section
        className="relative py-32 sm:py-40 overflow-hidden"
        style={{ background: "#2563EB" }}
      >
        {/* Subtle pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Glow effect */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{ background: "#60A5FA" }}
        />

        <div className="relative z-10 max-w-3xl mx-auto px-6 sm:px-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
          >
            <h2
              className="text-4xl sm:text-5xl lg:text-[3.75rem] font-black tracking-tight mb-6 leading-[1.05]"
              style={{ color: "#FFFFFF" }}
            >
              Ваши 24 часа
              <br />
              начинаются здесь
            </h2>
            <p
              className="text-lg sm:text-xl max-w-md mx-auto mb-12 leading-relaxed"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              Начните с бесплатного модуля. Без обязательств.
            </p>
            {/* CTA button with gradient border animation */}
            <div
              className="relative inline-block rounded-xl p-[2px]"
              style={{
                background: "linear-gradient(135deg, #FFFFFF, rgba(255,255,255,0.6), #FFFFFF)",
                backgroundSize: "200% 200%",
                animation: "gradientShift 3s ease infinite",
              }}
            >
              <button
                onClick={openRegister}
                className="group inline-flex items-center gap-3 px-12 py-5 rounded-[10px] text-lg font-bold transition-all duration-200"
                style={{
                  background: "#FFFFFF",
                  color: "#2563EB",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 0 24px rgba(255,255,255,0.3), 0 16px 48px rgba(0,0,0,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Начать бесплатно
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
