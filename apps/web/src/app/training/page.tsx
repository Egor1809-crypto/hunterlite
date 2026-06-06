"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Puzzle,
  Target,
  BookOpen,
  Map as MapIcon,
  ClipboardList,
  GraduationCap,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { EditorialHeader } from "@/components/ui/EditorialHeader";
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
}[] = [
  { id: "tests",     label: "Тесты",        icon: MapIcon },
  { id: "builder",   label: "Мои клиенты",  icon: Puzzle },
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
      className="mt-5 rounded-2xl p-5 sm:p-6"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}
    >
      {/* Eyebrow — mono label + hairline (как на /knowledge) */}
      <div className="mb-6 flex items-center gap-2.5">
        <BookOpen size={13} style={{ color: "var(--text-muted)" }} />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
          Ваш путь обучения
        </span>
        <div className="h-px flex-1" style={{ background: "var(--border-color)" }} />
      </div>

      <div className="relative flex items-start justify-between">
        {/* Соединительная линия — hairline за иконками */}
        <div className="absolute left-[9%] right-[9%] top-6 h-px" style={{ background: "var(--border-color)" }} />
        {LP_STAGES.map((s, i) => {
          const p = progress[s.key] ?? 0;
          const isActive = i === active;
          const done = p >= 100;
          const StageIcon = s.icon;
          const pct = done ? "var(--success)" : isActive ? "var(--primary)" : "var(--text-muted)";
          return (
            <Link
              key={s.key}
              href={s.href}
              className="no-underline relative z-10 flex flex-col items-center gap-2.5 px-1"
              style={{ flex: 1 }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl transition-colors"
                style={{
                  background: done ? "var(--success)" : isActive ? "var(--primary)" : "var(--surface-card)",
                  border: `1px solid ${done ? "var(--success)" : isActive ? "var(--primary)" : "var(--border-color)"}`,
                  boxShadow: isActive || done ? "var(--shadow-sm)" : "none",
                }}
              >
                <StageIcon size={20} strokeWidth={1.8} color={done || isActive ? "#fff" : "var(--text-muted)"} />
              </span>
              <span
                className="text-center text-[12.5px] font-medium leading-tight"
                style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
              >
                {s.label}
              </span>
              <span className="font-mono text-[11px] tabular-nums leading-none" style={{ color: pct }}>
                {p}%
              </span>
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
    <AuthLayout showBreadcrumbs={false} requireConsent>
      <style dangerouslySetInnerHTML={{ __html: TRAINING_SURFACE_CSS }} />
      <div
        className="training-solid-page relative min-h-screen overflow-hidden"
        style={{
          background: "var(--bg-primary)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0" style={{ backgroundImage: NOISE_SVG, backgroundRepeat: "repeat", opacity: 0.08 }} />

        <div className="app-page">
          {/* Header — единый редакторский паттерн (как /cases), без иконки-плашки */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <EditorialHeader
              eyebrowLeft="Практикум · обучение"
              eyebrowRight="ФЗ-127"
              title="Обучение"
              subtitle="Тесты, AI-клиенты и практические сценарии в одной программе."
            />
          </motion.div>

          {/* Learning Path Widget */}
          <LearningPathWidget />

          {/* Tabs — clean segmented control, без glow/неона */}
          <div className="mt-6 flex gap-1.5 rounded-xl border p-1.5" style={{ background: "var(--surface-card)", borderColor: "var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
            {TABS.map((t) => {
              const active = tab === t.id;
              const TabIcon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="relative flex-1 flex items-center justify-center gap-2.5 rounded-lg px-4 py-3 transition-colors whitespace-nowrap min-w-0"
                >
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: "var(--primary-muted)",
                        border: "1px solid var(--primary)",
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2.5">
                    <TabIcon size={18} style={{ color: active ? "var(--primary)" : "var(--text-muted)" }} />
                    <span className="text-[15px] font-semibold" style={{ color: active ? "var(--primary)" : "var(--text-secondary)" }}>
                      {t.label}
                    </span>
                  </span>
                </button>
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
