"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair,
  Puzzle,
  Target,
  BookOpen,
  Map as MapIcon,
  ClipboardList,
  GraduationCap,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import CharacterBuilder from "@/components/training/CharacterBuilder";
import TestWorldMap from "@/components/training/TestWorldMap";
import { useTrainingMapSync } from "@/hooks/useTrainingMapProgress";
import { api } from "@/lib/api";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;
const TRAINING_SURFACE_CSS = `
.training-solid-page .glass-panel,
.training-solid-page .premium-card,
.training-solid-page .surface-card {
  background: var(--surface-card) !important;
  border-color: var(--border-color) !important;
  box-shadow: var(--shadow-sm) !important;
}
.training-solid-page input,
.training-solid-page textarea,
.training-solid-page select {
  background: var(--input-bg) !important;
}
`;

type Tab = "tests" | "builder";

const TABS: {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  hue: string;
}[] = [
  { id: "tests",     label: "Тесты",        icon: MapIcon, hue: "var(--brand-logo-hunter)" },
  { id: "builder",   label: "Мои клиенты",  icon: Puzzle,  hue: "var(--brand-logo-hunter)" },
];

const LP_STAGES = [
  { key: "knowledge", icon: BookOpen, label: "Знания", href: "/knowledge" },
  { key: "tests", icon: MapIcon, label: "Тесты", href: "/training" },
  { key: "cases", icon: ClipboardList, label: "Кейсы", href: "/cases" },
  { key: "exams", icon: GraduationCap, label: "Экзамены", href: "/exam" },
  { key: "practice", icon: Target, label: "Практика", href: "/training" },
];

function LearningPathWidget() {
  const [progress, setProgress] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api.get<{ progress: Record<string, number> }>("/learning-path/progress")
      .then((d) => { if (d.progress) setProgress(d.progress); })
      .catch(() => {});
  }, []);
  if (!progress) return null;
  const activeIdx = LP_STAGES.findIndex((s) => (progress[s.key] ?? 0) < 100);
  const active = activeIdx >= 0 ? activeIdx : LP_STAGES.length - 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-xl p-3 sm:p-4"
      style={{ background: "var(--glass-bg)", border: "1px solid color-mix(in srgb, var(--accent) 15%, transparent)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <BookOpen size={12} style={{ color: "var(--accent)" }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Ваш путь обучения</span>
      </div>
      <div className="flex items-center justify-between relative">
        <div className="absolute top-3 left-[10%] right-[10%] h-[1px]" style={{ background: "var(--border-color)" }} />
        {LP_STAGES.map((s, i) => {
          const p = progress[s.key] ?? 0;
          const isActive = i === active;
          const done = p >= 100;
          const StageIcon = s.icon;
          return (
            <Link key={s.key} href={s.href} className="no-underline flex flex-col items-center relative z-10" style={{ flex: 1 }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center mb-1"
                style={{
                  background: done ? "var(--success)" : isActive ? "var(--accent)" : "var(--input-bg)",
                  border: isActive ? "2px solid var(--accent)" : done ? "2px solid var(--success)" : "1px solid var(--border-color)",
                }}
              >
                <StageIcon size={13} strokeWidth={2} color={done || isActive ? "#fff" : "var(--text-muted)"} />
              </div>
              <span className="text-[8px] font-bold" style={{ color: isActive ? "var(--accent)" : done ? "var(--success)" : "var(--text-muted)" }}>{p}%</span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}

function TrainingPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>("tests");

  useTrainingMapSync();

  useEffect(() => {
    if (tabParam === "builder") {
      setTab("builder");
    } else {
      setTab("tests");
    }
  }, [tabParam]);

  return (
    <AuthLayout showBreadcrumbs={false}>
      <style dangerouslySetInnerHTML={{ __html: TRAINING_SURFACE_CSS }} />
      <div
        className="training-solid-page relative min-h-screen overflow-hidden"
        style={{
          background: "var(--bg-primary)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0" style={{ backgroundImage: NOISE_SVG, backgroundRepeat: "repeat", opacity: 0.08 }} />

        <div className="app-page">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--primary-muted)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <Crosshair size={22} style={{ color: "var(--brand-logo-hunter)" }} />
                </div>
                <div>
                  <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-0.07em]" style={{ color: "var(--text-primary)" }}>
                    Обучение
                  </h1>
                  <p className="mt-2 text-lg" style={{ color: "var(--brand-logo-hunter)" }}>
                    Тесты, AI-клиенты и практические сценарии в одной программе
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Learning Path Widget */}
          <LearningPathWidget />

          {/* Tabs */}
          <div className="mt-6 flex gap-1 rounded-[24px] border p-1 overflow-x-auto" style={{ background: "var(--surface-card)", borderColor: "var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
            {TABS.map((t) => {
              const active = tab === t.id;
              const TabIcon = t.icon;
              return (
                <motion.button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  whileHover={!active ? { y: -1 } : undefined}
                  whileTap={{ scale: 0.97 }}
                  className="relative flex-1 flex items-center justify-center gap-2 sm:gap-2.5 rounded-lg px-2 sm:px-4 py-2.5 text-sm font-medium tracking-wide transition-colors whitespace-nowrap min-w-0"
                  style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
                >
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${t.hue} 14%, var(--glass-bg))`,
                        border: `1.5px solid ${t.hue}`,
                        boxShadow: `0 0 14px color-mix(in srgb, ${t.hue} 35%, transparent)`,
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 32, layout: { duration: 0.25 } }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2.5">
                    <TabIcon size={18} style={{ color: active ? t.hue : "var(--text-muted)" }} />
                    <span className="text-sm font-semibold leading-none tracking-wide">
                      {t.label}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ overflow: "hidden" }}>
          <AnimatePresence mode="wait" initial={false}>
            {tab === "tests" && (
              <motion.div key="tests" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                <TestWorldMap />
              </motion.div>
            )}

            {tab === "builder" && (
              <motion.div key="builder" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                <CharacterBuilder onGoToTests={() => setTab("tests")} />
              </motion.div>
            )}

          </AnimatePresence>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function TrainingPage() {
  return (
    <Suspense fallback={<AuthLayout><div className="relative panel-grid-bg min-h-screen" /></AuthLayout>}>
      <TrainingPageContent />
    </Suspense>
  );
}
