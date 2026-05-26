"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Users,
  Phone,
  BarChart3,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { useLandingAuth } from "@/components/landing/LandingAuthContext";

/* ── CountUp animation ───────────────────────────────────────────── */
function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  const animate = useCallback(() => {
    const duration = 1600;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          animate();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ── Features data ───────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Users,
    title: "AI-клиенты",
    subtitle: "100+ архетипов",
    description:
      "Скептики, манипуляторы, паникеры, агрессоры -- все типы должников, которых встречает арбитражный управляющий. Каждый AI-клиент ведет себя как настоящий.",
    color: "#F97316",
  },
  {
    icon: Phone,
    title: "Голосовые звонки",
    subtitle: "Реалистичная практика",
    description:
      "Тренируйтесь вести переговоры голосом в режиме реального времени. AI-клиент слышит интонацию, реагирует на паузы и перебивает -- как в жизни.",
    color: "#0891B2",
  },
  {
    icon: BarChart3,
    title: "10-слойная оценка",
    subtitle: "Детальный скоринг",
    description:
      "После каждой сессии -- разбор по 10 параметрам: работа с возражениями, юридическая точность по 127-ФЗ, эмпатия, логика диалога и многое другое.",
    color: "#F97316",
  },
  {
    icon: BookOpen,
    title: "Арена знаний",
    subtitle: "Квиз по 127-ФЗ",
    description:
      "Проверяйте и углубляйте знание закона о банкротстве в формате блиц-тестов. Вопросы адаптируются к вашему уровню.",
    color: "#0891B2",
  },
] as const;

/* ── Steps data ──────────────────────────────────────────────────── */
const STEPS = [
  {
    number: "01",
    title: "Выберите сценарий",
    description: "Холодный звонок, работа с возражениями, переговоры в кризисной ситуации -- 60+ реальных ситуаций из практики арбитражных управляющих.",
  },
  {
    number: "02",
    title: "Проведите переговоры",
    description: "Общайтесь с AI-клиентом текстом или голосом. Он реагирует на ваши аргументы, давит, торгуется, паникует -- как настоящий должник.",
  },
  {
    number: "03",
    title: "Получите разбор",
    description: "Детальный анализ по 10 параметрам: что сработало, где вы потеряли клиента и как улучшить результат в следующий раз.",
  },
] as const;

/* ── Stats data ──────────────────────────────────────────────────── */
const STATS = [
  { target: 100, suffix: "+", label: "Архетипов клиентов" },
  { target: 60, suffix: "+", label: "Сценариев" },
  { target: 10, suffix: "", label: "Параметров оценки" },
] as const;

/* ═══════════════════════════ PAGE ═════════════════════════════════ */
export default function Home() {
  const { openRegister } = useLandingAuth();

  return (
    <>
      {/* ═══ HERO ═══════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-white">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[60%] h-[80%] rounded-full opacity-[0.04]"
            style={{ background: "radial-gradient(circle at 70% 30%, #F97316, transparent 60%)" }}
          />
          <div className="absolute bottom-0 left-0 w-[40%] h-[60%] rounded-full opacity-[0.03]"
            style={{ background: "radial-gradient(circle at 30% 70%, #0891B2, transparent 60%)" }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 w-full pt-24 pb-16 sm:pt-32 sm:pb-24">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-[#F97316] border border-orange-100 mb-6">
                AI-тренажер для арбитражных управляющих
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-gray-900 mb-6"
            >
              Тренируйте навыки
              <br />
              переговоров с{" "}
              <span className="text-[#F97316]">AI-клиентами</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-2xl mb-8"
            >
              Практикуйтесь на реальных сценариях банкротства: работа с возражениями, переговоры с должниками, кризисные ситуации.
              Получайте детальный разбор каждого звонка.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8"
            >
              <button
                onClick={openRegister}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] transition-colors shadow-lg shadow-orange-200"
              >
                Начать бесплатно <ArrowRight size={18} />
              </button>
              <span className="text-sm text-gray-400">
                Без кредитной карты
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap items-center gap-x-6 gap-y-2"
            >
              {["100+ типов клиентов", "Голосовой режим", "10 параметров оценки"].map((t) => (
                <span key={t} className="flex items-center gap-2 text-sm text-gray-500">
                  <CheckCircle2 size={15} className="text-[#0891B2] flex-shrink-0" />{t}
                </span>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══════════════════════════════════════════════ */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-12 sm:py-16">
          <div className="grid grid-cols-3 gap-8">
            {STATS.map(({ target, suffix, label }) => (
              <div key={label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-[#F97316]">
                  <CountUp target={target} suffix={suffix} />
                </div>
                <div className="text-sm text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══════════════════════════════════════════════ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Все инструменты для подготовки
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              От реалистичных переговоров до глубокой аналитики -- все, что нужно для роста навыков вашей команды
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {FEATURES.map(({ icon: Icon, title, subtitle, description, color }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group rounded-2xl border border-gray-100 bg-white p-7 sm:p-8 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: color === "#F97316" ? "#FFF7ED" : "#ECFEFF" }}
                >
                  <Icon size={22} style={{ color }} />
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{subtitle}</span>
                </div>
                <p className="text-base text-gray-500 leading-relaxed">
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-20 sm:py-28 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Как это работает
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Три простых шага от выбора сценария до детального разбора
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {STEPS.map(({ number, title, description }, i) => (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative"
              >
                <div className="text-5xl font-bold text-[#F97316]/10 mb-4">{number}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
                <p className="text-base text-gray-500 leading-relaxed">{description}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 right-0 translate-x-1/2">
                    <ArrowRight size={20} className="text-gray-200" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ══════════════════════════════════════════════ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center rounded-2xl bg-gradient-to-br from-orange-50 to-cyan-50 border border-orange-100/50 py-16 sm:py-20 px-6 sm:px-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Готовы попробовать?
            </h2>
            <p className="text-lg text-gray-500 max-w-lg mx-auto mb-8">
              Начните тренировать навыки переговоров уже сегодня.
              Первые сессии -- бесплатно.
            </p>
            <button
              onClick={openRegister}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] transition-colors shadow-lg shadow-orange-200"
            >
              Начать бесплатно <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      </section>
    </>
  );
}
