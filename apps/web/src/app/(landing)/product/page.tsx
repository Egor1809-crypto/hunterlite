"use client";

import { motion } from "framer-motion";
import {
  Users,
  Phone,
  BarChart3,
  BookOpen,
  Shield,
  Brain,
  Target,
  MessageSquare,
  Scale,
  Mic,
  ArrowRight,
} from "lucide-react";
import { useLandingAuth } from "@/components/landing/LandingAuthContext";

/* ── Scoring parameters ──────────────────────────────────────────── */
const SCORING_PARAMS = [
  { name: "Работа с возражениями", icon: Shield, description: "Как вы реагируете, когда клиент говорит 'не буду платить' или 'у меня нет денег'" },
  { name: "Юридическая точность", icon: Scale, description: "Соответствие аргументов закону 127-ФЗ о банкротстве" },
  { name: "Эмпатия и тон", icon: MessageSquare, description: "Насколько вы понимаете состояние клиента и подбираете нужный тон" },
  { name: "Логика диалога", icon: Brain, description: "Последовательность аргументации и структура разговора" },
  { name: "Следование скрипту", icon: Target, description: "Прохождение всех этапов разговора без пропусков" },
  { name: "Баланс речи", icon: Mic, description: "Соотношение: сколько говорите вы и сколько слушаете клиента" },
] as const;

/* ── Core capabilities ───────────────────────────────────────────── */
const CAPABILITIES = [
  {
    icon: Users,
    title: "100+ архетипов AI-клиентов",
    description: "Скептики, манипуляторы, паникеры, агрессоры, молчуны -- все типы должников, которых встречает арбитражный управляющий на практике.",
  },
  {
    icon: Phone,
    title: "Голосовые переговоры",
    description: "Тренируйтесь вести переговоры голосом. AI-клиент слышит вашу интонацию, реагирует на паузы и перебивает -- как настоящий собеседник.",
  },
  {
    icon: BarChart3,
    title: "10-слойная система оценки",
    description: "Детальный разбор каждой сессии: от юридической точности до эмоционального интеллекта. Конкретные рекомендации по улучшению.",
  },
  {
    icon: BookOpen,
    title: "Арена знаний по 127-ФЗ",
    description: "Блиц-тесты по закону о банкротстве. Вопросы адаптируются к вашему уровню и фокусируются на слабых местах.",
  },
] as const;

/* ═══════════════════════════ PAGE ═════════════════════════════════ */
export default function ProductPage() {
  const { openRegister } = useLandingAuth();

  return (
    <div className="min-h-screen bg-white" style={{ paddingTop: "80px" }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-cyan-50 text-[#0891B2] border border-cyan-100 mb-6">
            О продукте
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
            Как работает LegalHunter
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 leading-relaxed">
            AI-тренажер, который моделирует реальные переговорные ситуации из практики арбитражных управляющих.
            60+ сценариев, 100+ типов клиентов, детальная аналитика каждого разговора.
          </p>
        </motion.div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-14"
          >
            Возможности платформы
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {CAPABILITIES.map(({ icon: Icon, title, description }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-white rounded-2xl border border-gray-100 p-7 sm:p-8"
              >
                <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center mb-5">
                  <Icon size={20} className="text-[#F97316]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-base text-gray-500 leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scoring system ───────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Система оценки
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl">
              Не субъективные ощущения, а конкретные данные. Каждый звонок анализируется по 10 параметрам.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SCORING_PARAMS.map(({ name, icon: Icon, description }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex gap-4 p-5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-[#0891B2]" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">{name}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm text-gray-400 mt-8 text-center"
          >
            + 4 дополнительных параметра: ловушки, ошибки, результат звонка, общий балл
          </motion.p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-t border-gray-100 py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Попробуйте бесплатно
            </h2>
            <p className="text-lg text-gray-500 max-w-lg mx-auto mb-8">
              Начните с нескольких тренировочных сессий и оцените качество AI-клиентов и системы оценки.
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
    </div>
  );
}
