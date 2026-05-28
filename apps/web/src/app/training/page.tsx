"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair,
  Puzzle,
  Target,
  Sparkles,
  BookOpen,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import CharacterBuilder from "@/components/training/CharacterBuilder";
import TestWorldMap from "@/components/training/TestWorldMap";
import { useTrainingMapSync } from "@/hooks/useTrainingMapProgress";
import { api } from "@/lib/api";
import { AppIcon } from "@/components/ui/AppIcon";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

type Tab = "tests" | "builder";

const TABS: {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  emoji: string;
  hue: string;
}[] = [
  { id: "tests",     label: "Карта тестов",  icon: Target,         emoji: "🗺️", hue: "var(--info)" },
  { id: "builder",   label: "Конструктор",   icon: Puzzle,         emoji: "🧩", hue: "var(--success)" },
];

interface RecommendedPreset {
  slug: string;
  title: string;
  icon_emoji: string;
  category: string;
}

function PresetRecommendation({ onGoToPresets }: { onGoToPresets: () => void }) {
  const [preset, setPreset] = useState<RecommendedPreset | null>(null);
  useEffect(() => {
    api.get("/training-presets/recommended").then((data: RecommendedPreset[]) => {
      if (data.length > 0) setPreset(data[0]);
    }).catch(() => {});
  }, []);
  if (!preset) return null;
  return (
    <motion.button
      onClick={onGoToPresets}
      className="mt-3 w-full glass-panel rounded-xl p-3 flex items-center gap-3 text-left"
      style={{ borderColor: "var(--accent)30" }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1, boxShadow: "0 4px 16px rgba(99,102,241,0.12)" }}
    >
      <span className="text-xl"><AppIcon emoji={preset.icon_emoji} size={20} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>{preset.title}</div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{preset.category}</div>
      </div>
      <div className="flex items-center gap-1 text-xs font-bold flex-shrink-0" style={{ color: "var(--accent)" }}>
        <Sparkles size={12} />
        <span>Попробовать</span>
      </div>
    </motion.button>
  );
}

const LP_STAGES = [
  { key: "knowledge", icon: "\u{1f4da}", label: "Знания", href: "/knowledge" },
  { key: "tests", icon: "\u{1f5fa}️", label: "Тесты", href: "/training" },
  { key: "cases", icon: "\u{1f4cb}", label: "Кейсы", href: "/cases" },
  { key: "exams", icon: "\u{1f393}", label: "Экзамены", href: "/exam" },
  { key: "practice", icon: "\u{1f3af}", label: "Практика", href: "/training" },
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
          return (
            <Link key={s.key} href={s.href} className="no-underline flex flex-col items-center relative z-10" style={{ flex: 1 }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm mb-1"
                style={{
                  background: done ? "var(--success)" : isActive ? "var(--accent)" : "var(--input-bg)",
                  border: isActive ? "2px solid var(--accent)" : done ? "2px solid var(--success)" : "1px solid var(--border-color)",
                  fontSize: "12px",
                }}
              >
                {s.icon}
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
  const [storyCalls] = useState<number>(3);

  useTrainingMapSync();

  useEffect(() => {
    if (tabParam === "builder") {
      setTab("builder");
    } else if (tabParam === "tests" || tabParam === "scenarios" || tabParam === "recommended" || tabParam === "assigned" || tabParam === "saved" || tabParam === "exams") {
      setTab("tests");
    }
  }, [tabParam]);

  return (
    <AuthLayout>
      <div className="relative panel-grid-bg min-h-screen">
        {/* Ambient gradient orbs */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute -top-[200px] -right-[200px] w-[900px] h-[900px] rounded-full" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.035) 0%, transparent 70%)" }} />
          <div className="absolute -bottom-[150px] -left-[150px] w-[700px] h-[700px] rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.025) 0%, transparent 70%)" }} />
          <div className="absolute top-1/3 -right-[100px] w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(34,197,94,0.02) 0%, transparent 70%)" }} />
        </div>
        {/* Noise texture overlay */}
        <div className="pointer-events-none absolute inset-0 z-0" style={{ backgroundImage: NOISE_SVG, backgroundRepeat: "repeat", opacity: 0.4 }} />

        <div className="app-page">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--accent-muted)",
                    boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent), 0 0 20px rgba(59,130,246,0.15), 0 0 40px rgba(59,130,246,0.05)",
                  }}
                >
                  <Crosshair size={22} style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                    Обучение
                  </h1>
                  <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                    AI-тренировки с реалистичными клиентами
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Learning Path Widget */}
          <LearningPathWidget />

          {/* Tabs */}
          <div className="mt-6 flex gap-1 rounded-xl p-1 overflow-x-auto" style={{ background: "var(--input-bg)" }}>
            {TABS.map((t) => {
              const active = tab === t.id;
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
                    <motion.span
                      style={{
                        fontSize: 26,
                        lineHeight: 1,
                        display: "inline-block",
                        filter: active ? "none" : "grayscale(0.45) opacity(0.85)",
                        transition: "filter 200ms",
                      }}
                      animate={active ? {
                        scale: [1, 1.08, 1],
                        rotate: [0, -3, 3, 0],
                      } : { scale: 1, rotate: 0 }}
                      transition={active ? {
                        duration: 1.6,
                        repeat: Infinity,
                        repeatDelay: 2.4,
                        ease: "easeInOut",
                      } : { duration: 0.2 }}
                      whileHover={!active ? { rotate: [-4, 4, -4, 0], transition: { duration: 0.4 } } : undefined}
                      aria-hidden
                    >
                      {t.emoji}
                    </motion.span>
                    <span className="text-sm font-semibold leading-none tracking-wide">
                      {t.label}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Preset recommendation when on tests tab */}
          {tab === "tests" && (
            <PresetRecommendation onGoToPresets={() => setTab("builder")} />
          )}

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
                <CharacterBuilder storyCalls={storyCalls} />
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
