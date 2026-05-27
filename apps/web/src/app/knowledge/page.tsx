"use client";

import { motion } from "framer-motion";
import { BookOpen, Scale } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { KnowledgeBaseBrowser } from "@/components/pvp/KnowledgeBaseBrowser";

export default function KnowledgePage() {
  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-32 right-[10%] w-[500px] h-[500px] rounded-full opacity-[0.03]"
            style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 app-page">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8"
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--primary-muted)",
                  boxShadow: "0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent)",
                }}
              >
                <BookOpen size={22} style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  База знаний
                </h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Полная база ФЗ-127 · RAG-индекс AI-судьи
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <KnowledgeBaseBrowser />
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
