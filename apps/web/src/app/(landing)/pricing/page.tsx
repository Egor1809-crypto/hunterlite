"use client";

import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5" style={{ paddingTop: "80px" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full text-center py-20"
      >
        <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-6">
          <Mail size={24} className="text-[#F97316]" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
          Тарифы
        </h1>

        <p className="text-lg text-gray-500 leading-relaxed mb-8">
          Для получения информации о тарифах и условиях подключения свяжитесь с нами.
          Мы подберем оптимальное решение для вашей команды.
        </p>

        <a
          href="mailto:hello@legalhunter.ru"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] transition-colors shadow-lg shadow-orange-200 mb-6"
        >
          <Mail size={18} />
          hello@legalhunter.ru
        </a>

        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={14} />
            Вернуться на главную
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
