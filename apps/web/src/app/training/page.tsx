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
  { key: "practice", icon: Target, label: "Практика", href: "/training?tab=builder" },
];

function LearningPathWidget() {
  const [progress, setProgress] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api.get<{ progress: Record<string, number> }>("/learning-path/progress")
      .then((d) => { if (d.progress) setProgress(d.progress); })
      .catch(() => {});
  }, []);
  if (!progress) return null;
  return <nav aria-label="Программа обучения" className="learning-overview">{LP_STAGES.map(stage=><Link key={stage.key} href={stage.href}><stage.icon size={19}/><span>{stage.label}</span><span className="ml-auto tabular-nums" style={{color:"var(--text-secondary)"}}>{progress[stage.key] || 0}%</span></Link>)}</nav>;
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
              eyebrowLeft="Практикум"
              eyebrowRight="ФЗ-127"
              title="Обучение"
              subtitle="Тесты, AI-клиенты и практические сценарии в одной программе."
            />
          </motion.div>

          {/* Learning Path Widget */}
          <LearningPathWidget />

          <div className="learning-tabs" role="group" aria-label="Раздел обучения">{TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} aria-pressed={tab===t.id}><t.icon size={19}/>{t.label}</button>)}</div>

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
