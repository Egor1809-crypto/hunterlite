"use client";
import { trainingDay, type AttemptBalance } from "@/lib/trainingDay";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import { ClipboardCheck, Landmark, Home, Scale, Coins, Users, FileText, Clock, Gavel, ShieldCheck, Check, Lock, ArrowRight, GraduationCap, Award } from "@/components/ui/RuneIcons";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { AttemptsBooster } from "@/components/training/AttemptsBooster";

/* ═══════════════════════════════════════════════════════════════════════════
   ISLAND DEFINITIONS — 10 regions × 10 levels = 100 levels.
   One island. Each region maps to a LegalCategory in the DB.
   ═══════════════════════════════════════════════════════════════════════════ */

interface Island {
  id: string;
  category: string;
  name: string;
  Icon: typeof ClipboardCheck;
  levels: number[];
  checkpoint: number | null;
  examId: string | null;
}

const ISLANDS: Island[] = [
  {
    id: "eligibility",
    category: "eligibility",
    name: "Условия подачи",
    Icon: ClipboardCheck,
    levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    checkpoint: null,
    examId: null,
  },
  {
    id: "procedure",
    category: "procedure",
    name: "Порядок процедуры",
    Icon: Landmark,
    levels: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    checkpoint: null,
    examId: null,
  },
  {
    id: "property",
    category: "property",
    name: "Имущество должника",
    Icon: Home,
    levels: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    checkpoint: 30,
    examId: "exam-1",
  },
  {
    id: "consequences",
    category: "consequences",
    name: "Последствия",
    Icon: Scale,
    levels: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
    checkpoint: null,
    examId: null,
  },
  {
    id: "costs",
    category: "costs",
    name: "Стоимость процедуры",
    Icon: Coins,
    levels: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
    checkpoint: null,
    examId: null,
  },
  {
    id: "creditors",
    category: "creditors",
    name: "Кредиторы",
    Icon: Users,
    levels: [51, 52, 53, 54, 55, 56, 57, 58, 59, 60],
    checkpoint: 60,
    examId: "exam-2",
  },
  {
    id: "documents",
    category: "documents",
    name: "Документы",
    Icon: FileText,
    levels: [61, 62, 63, 64, 65, 66, 67, 68, 69, 70],
    checkpoint: null,
    examId: null,
  },
  {
    id: "timeline",
    category: "timeline",
    name: "Сроки",
    Icon: Clock,
    levels: [71, 72, 73, 74, 75, 76, 77, 78, 79, 80],
    checkpoint: null,
    examId: null,
  },
  {
    id: "court",
    category: "court",
    name: "Судебные процессы",
    Icon: Gavel,
    levels: [81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
    checkpoint: 90,
    examId: "exam-3",
  },
  {
    id: "rights",
    category: "rights",
    name: "Права должника",
    Icon: ShieldCheck,
    levels: [91, 92, 93, 94, 95, 96, 97, 98, 99, 100],
    checkpoint: 100,
    examId: "exam-4",
  },
];

const QUESTIONS_PER_LEVEL_MIN = 10;
const QUESTIONS_PER_LEVEL_MAX = 20;
const MAX_ATTEMPTS = 5;
const DAILY_ENERGY = 25;
const PASS_THRESHOLD = 0.88;

/* ═══════════════════════════════════════════════════════════════════════════
   LEVEL STATE
   ═══════════════════════════════════════════════════════════════════════════ */

type LevelStatus = "locked" | "available" | "completed" | "failed";

interface LevelState {
  level: number;
  status: LevelStatus;
  bestScore: number | null;
  attempts: number;
  attemptsDate?: string | null;
  // Докупленные на сегодня попытки сверх MAX_ATTEMPTS (Task #6). Сбрасывается
  // вместе с attempts при смене календарного дня (UTC).
  bonusAttempts?: number;
  questionsCount: number;
}

function getInitialLevelStates(): LevelState[] {
  return Array.from({ length: 100 }, (_, i) => ({
    level: i + 1,
    status: i === 0 ? "available" : "locked",
    bestScore: null,
    attempts: 0,
    attemptsDate: null,
    bonusAttempts: 0,
    questionsCount: QUESTIONS_PER_LEVEL_MIN + Math.floor(Math.random() * (QUESTIONS_PER_LEVEL_MAX - QUESTIONS_PER_LEVEL_MIN + 1)),
  }));
}

// localStorage keys are namespaced PER USER. The non-scoped keys used to leak
// attempts/energy across accounts on the same browser. The server
// (training_map_progress, per user_id) is the source of truth; localStorage is
// only a same-user cache to avoid a flash before the GET resolves.
const STORAGE_PREFIX = "hunterlite_test_map_progress";
const ENERGY_STORAGE_PREFIX = "hunterlite_daily_energy";

function progressKey(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX;
}
function energyKey(userId: string | null): string {
  return userId ? `${ENERGY_STORAGE_PREFIX}:${userId}` : ENERGY_STORAGE_PREFIX;
}

interface EnergyState {
  date: string;
  remaining: number;
}

function getEnergyDateKey(): string {
  return trainingDay();
}

// Apply daily reset + clamp to a raw energy object from any source (server or cache).
function normalizeEnergy(parsed: Partial<EnergyState> | null | undefined): EnergyState {
  const today = getEnergyDateKey();
  if (!parsed || parsed.date !== today) return { date: today, remaining: DAILY_ENERGY };
  return {
    date: today,
    remaining: Math.max(0, Math.min(DAILY_ENERGY, Number(parsed.remaining ?? DAILY_ENERGY))),
  };
}

function loadEnergy(userId: string | null): EnergyState {
  if (typeof window === "undefined") return { date: getEnergyDateKey(), remaining: DAILY_ENERGY };
  try {
    const raw = localStorage.getItem(energyKey(userId));
    if (!raw) return { date: getEnergyDateKey(), remaining: DAILY_ENERGY };
    return normalizeEnergy(JSON.parse(raw) as Partial<EnergyState>);
  } catch {
    return { date: getEnergyDateKey(), remaining: DAILY_ENERGY };
  }
}

function normalizeProgress(value: unknown): LevelState[] {
  const initial = getInitialLevelStates();
  if (!Array.isArray(value)) return initial;
  const today = getEnergyDateKey();

  const normalized = initial.map((fallback, index) => {
    const raw = value[index];
    if (!raw || typeof raw !== "object") return fallback;

    const candidate = raw as Partial<LevelState>;
    const status: LevelStatus = ["locked", "available", "completed", "failed"].includes(String(candidate.status))
      ? candidate.status as LevelStatus
      : fallback.status;
    const attemptsDate = typeof candidate.attemptsDate === "string" ? candidate.attemptsDate : null;
    // Докупленные попытки живут один день (как и attempts).
    const bonusAttempts = attemptsDate === today && Number.isFinite(candidate.bonusAttempts)
      ? Math.max(0, Math.min(50, Number(candidate.bonusAttempts)))
      : 0;
    const attempts = attemptsDate === today && Number.isFinite(candidate.attempts)
      ? Math.max(0, Number(candidate.attempts))
      : fallback.attempts;
    const questionsCount = Number.isFinite(candidate.questionsCount)
      ? Math.max(QUESTIONS_PER_LEVEL_MIN, Math.min(QUESTIONS_PER_LEVEL_MAX, Number(candidate.questionsCount)))
      : fallback.questionsCount;

    return {
      ...fallback,
      ...candidate,
      level: fallback.level,
      status,
      attempts,
      attemptsDate,
      bonusAttempts,
      questionsCount,
      bestScore: typeof candidate.bestScore === "number" ? candidate.bestScore : fallback.bestScore,
    };
  });

  for (let i = 0; i < normalized.length; i++) {
    const bestScore = normalized[i].bestScore ?? 0;
    const passed = bestScore >= PASS_THRESHOLD * 100;

    if (i === 0) {
      normalized[i] = {
        ...normalized[i],
        status: passed ? "completed" : normalized[i].status === "failed" ? "failed" : "available",
      };
      continue;
    }

    const previousPassed = (normalized[i - 1].bestScore ?? 0) >= PASS_THRESHOLD * 100;
    if (passed) {
      normalized[i] = { ...normalized[i], status: "completed" };
    } else if (!previousPassed) {
      normalized[i] = { ...normalized[i], status: "locked" };
    } else if (normalized[i].attempts > 0 || normalized[i].status === "failed") {
      normalized[i] = { ...normalized[i], status: "failed" };
    } else {
      normalized[i] = { ...normalized[i], status: "available" };
    }
  }

  return normalized;
}

function loadProgress(userId: string | null): LevelState[] {
  if (typeof window === "undefined") return getInitialLevelStates();
  try {
    const raw = localStorage.getItem(progressKey(userId));
    if (raw) return normalizeProgress(JSON.parse(raw));
  } catch { /* ignore */ }
  return getInitialLevelStates();
}

// Pull authoritative per-user state from the server. Returns null on failure so
// the caller can fall back to the local cache.
async function hydrateFromServer(): Promise<{ states: LevelState[]; energy: EnergyState; attempts: AttemptBalance | null } | null> {
  try {
    const res = await api.get("/training-map/progress") as {
      test_map?: unknown;
      attempts?: AttemptBalance;
      energy?: Partial<EnergyState> | null;
    };
    const hasTestMap = Array.isArray(res?.test_map) && (res.test_map as unknown[]).length > 0;
    return {
      states: hasTestMap ? normalizeProgress(res.test_map) : getInitialLevelStates(),
      energy: normalizeEnergy(res?.energy),
      attempts: res.attempts || null,
    };
  } catch {
    return null;
  }
}

function getLevelDifficulty(level: number): "easy" | "medium" | "hard" | "expert" {
  const posInIsland = ((level - 1) % 10);
  if (posInIsland < 3) return "easy";
  if (posInIsland < 6) return "medium";
  if (posInIsland < 9) return "hard";
  return "expert";
}

function getDifficultyConfig(d: ReturnType<typeof getLevelDifficulty>) {
  switch (d) {
    case "easy":   return { label: "Базовый",      color: "var(--success)", bg: "var(--success-muted)" };
    case "medium": return { label: "Средний",       color: "var(--warning)", bg: "var(--warning-muted)" };
    case "hard":   return { label: "Продвинутый",   color: "var(--danger)",  bg: "var(--danger-muted)" };
    case "expert": return { label: "Экспертный",    color: "var(--primary)", bg: "var(--primary-muted)" };
  }
}

// 3-letter region code in the malvah "quiet classification" spirit (R03 · ИМУ).
type RegionStatus = "active" | "completed" | "locked";

function RegionBlock({
  island,
  levels,
  status,
  expanded,
  hereLevel,
  onToggle,
  onLevelClick,
}: {
  island: Island;
  levels: LevelState[];
  status: RegionStatus;
  expanded: boolean;
  hereLevel: number | null;
  onToggle: () => void;
  onLevelClick: (level: number) => void;
}) {
  const completedCount = levels.filter(s => s.status === "completed").length;
  return <section className={`learning-region ${status}`}>
    <h3><button className="learning-region-heading" onClick={onToggle} disabled={status === "locked"} aria-expanded={expanded} aria-controls={`region-${island.id}`}>
      <span className="learning-region-icon"><island.Icon size={25}/>{status === "completed" && <span className="learning-region-seal"><Check size={10}/></span>}</span>
      <span className="min-w-0 flex-1"><span className="block font-display text-xl sm:text-2xl">{island.name}</span><span className="block mt-1 text-sm font-normal" style={{color:"var(--text-secondary)"}}>Уровни {island.levels[0]}–{island.levels[9]} · {completedCount} из 10 пройдено</span></span>
      <span className="learning-region-status">{status === "completed" ? "Пройдено" : status === "locked" ? <Lock size={16}/> : "В процессе"}</span>
      {status !== "locked" && <ArrowRight size={18} className={expanded ? "rotate-90" : ""}/>}
    </button></h3>
    <div id={`region-${island.id}`} hidden={!expanded || status === "locked"}>
      <div className="learning-levels">{levels.map(st => <button key={st.level} onClick={()=>onLevelClick(st.level)} disabled={st.status === "locked"} aria-current={hereLevel === st.level ? "step" : undefined} className={`learning-level ${st.status}`}>
        <span className="flex items-center justify-between gap-2"><span>Уровень {st.level}</span>{st.status === "completed" ? <Check size={15}/> : st.status === "locked" ? <Lock size={14}/> : <ArrowRight size={14}/>}</span>
        <span className="block text-xs mt-3" style={{color:"var(--text-secondary)"}}>{st.status === "completed" ? `${Math.round(st.bestScore || 0)}% · пройдено` : `${st.questionsCount} вопросов`}</span>
      </button>)}</div>
    </div>
  </section>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXAM GATE — a milestone on the trail (not a level node).
   ═══════════════════════════════════════════════════════════════════════════ */

function ExamGate({index, unlocked, levelsLeft}: {index:number;unlocked:boolean;levelsLeft:number}) {
  return <div className="learning-exam"><GraduationCap size={20}/><span className="flex-1">Контрольный экзамен {index}<span className="block text-xs mt-1" style={{color:"var(--text-secondary)"}}>{unlocked ? "Доступен в разделе экзаменов" : `Осталось пройти уровней: ${levelsLeft}`}</span></span>{unlocked ? <a href="/exam" className="underline underline-offset-4">Перейти</a> : <Lock size={15}/>}</div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CERTIFICATE SUMMIT — the destination, always visible (sticky).
   ═══════════════════════════════════════════════════════════════════════════ */

function CertificateSummit({ completed, total, energy }: { completed: number; total: number; energy: EnergyState }) {
  const earned = completed >= total;
  const pct = Math.round((completed / total) * 100);
  return (
    <div
      className="mb-8 flex items-center gap-4 rounded-xl px-4 py-5"
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border-color)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {/* seal */}
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: earned ? "var(--primary)" : "var(--bg-tertiary)",
          border: `1px solid ${earned ? "var(--primary)" : "var(--border-color)"}`,
        }}
      >
        {earned ? <Award size={22} style={{ color: "#fff" }} /> : <Lock size={18} style={{ color: "var(--text-muted)" }} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Сертификат
          </span>
          <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {completed} / {total}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          {earned ? "Открыт — заберите сертификат." : `${completed} из ${total} уровней пройдено.`}
        </p>
        {/* single hairline progress — the only bar on the screen */}
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full" style={{ background: "var(--border-color)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--primary)" }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <div className="font-mono text-[12px] font-semibold tabular-nums" style={{ color: energy.remaining > 0 ? "var(--primary)" : "var(--warning)" }}>
          {energy.remaining}/{DAILY_ENERGY}
        </div>
        <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>лимит сегодня</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRAIL SPINE — left minimap: regions · gates · summit, with "you are here".
   ═══════════════════════════════════════════════════════════════════════════ */

function LevelDetailModal({
  state,
  island,
  energy,
  paidRemaining,
  onClose,
  onStart,
  onPurchase,
  starting,
}: {
  state: LevelState;
  island: Island;
  energy: EnergyState;
  paidRemaining: number;
  onClose: () => void;
  onStart: () => void;
  onPurchase: (packSize?: number) => Promise<void> | void;
  starting: boolean;
}) {
  const diff = getLevelDifficulty(state.level);
  const diffCfg = getDifficultyConfig(diff);
  const isCompleted = state.status === "completed";
  const bonusAttempts = paidRemaining;
  const attemptsRemaining = Math.min(energy.remaining, Math.max(0, MAX_ATTEMPTS - state.attempts)) + paidRemaining;
  const blockedByAttempts = !isCompleted && attemptsRemaining <= 0;
  const blockedByEnergy = !isCompleted && energy.remaining <= 0 && paidRemaining <= 0;
  const passed = (state.bestScore ?? 0) >= PASS_THRESHOLD * 100;
  const actionLabel = blockedByAttempts
    ? "Лимит попыток на сегодня"
    : blockedByEnergy
      ? "Дневной лимит исчерпан"
      : state.attempts > 0
        ? "Попробовать снова"
        : "Начать уровень";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 backdrop-blur-md" style={{ background: "var(--overlay-bg)" }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-lg)",
        }}
        initial={{ scale: 0.94, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 18 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        {/* Accent hairline at the very top */}
        <div className="h-1 w-full" style={{ background: "var(--primary)" }} />

        <div className="px-7 pb-7 pt-6">
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>

          {/* Header: eyebrow + large title.
              2026-06-06 (#2): pr-10 reserves space for the absolute X close
              button (right-4 top-4) so the «Пройден» badge (ml-auto) no longer
              sits underneath it — fixes the button overlap. */}
          <div className="flex items-start gap-4 pr-10">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `color-mix(in srgb, var(--primary) 16%, var(--surface-card))`, border: `1px solid color-mix(in srgb, var(--primary) 32%, transparent)` }}
            >
              <island.Icon size={22} strokeWidth={1.75} color={`var(--primary)`} />
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: `var(--primary)` }}>
                {island.name}
              </div>
              <h3 className="mt-1 whitespace-nowrap text-[26px] font-semibold leading-none tracking-tight" style={{ color: "var(--text-primary)" }}>
                Уровень {state.level}
              </h3>
            </div>
            {isCompleted && (
              <span
                className="ml-auto mt-1 flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
              >
                <Check size={11} /> Пройден
              </span>
            )}
          </div>

          {/* Spec strip — hairline rows */}
          <div className="mt-6 space-y-px overflow-hidden rounded-2xl" style={{ border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--bg-secondary)" }}>
              <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Вопросов в тесте</span>
              <span className="font-mono text-[15px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{state.questionsCount}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--bg-tertiary)" }}>
              <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Сложность</span>
              <span className="text-[13px] font-bold" style={{ color: diffCfg?.color }}>{diffCfg?.label}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--bg-secondary)" }}>
              <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Попыток сегодня</span>
              <span
                className="font-mono text-[15px] font-bold tabular-nums"
                style={{ color: attemptsRemaining === 0 && !isCompleted ? "var(--warning)" : "var(--text-primary)" }}
              >
                {isCompleted ? "∞" : String(attemptsRemaining)}
              </span>
            </div>
            {state.bestScore !== null && (
              <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--bg-tertiary)" }}>
                <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Лучший результат</span>
                <span className="font-mono text-[15px] font-bold tabular-nums" style={{ color: passed ? "var(--primary)" : "var(--danger)" }}>
                  {Math.round(state.bestScore)}%
                </span>
              </div>
            )}
          </div>

          {/* Energy — slim bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Бесплатный дневной лимит</span>
              <span
                className="font-mono text-[12px] font-bold tabular-nums"
                style={{ color: energy.remaining > 0 ? "var(--primary)" : "var(--warning)" }}
              >
                {energy.remaining}/{DAILY_ENERGY}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-tertiary)" }}>
              <motion.div
                className="h-full rounded-full"
                initial={false}
                animate={{ width: `${Math.max(0, Math.min(100, (energy.remaining / DAILY_ENERGY) * 100))}%` }}
                transition={{ type: "spring", stiffness: 220, damping: 28 }}
                style={{ background: energy.remaining > 0 ? "var(--primary)" : "var(--warning)" }}
              />
            </div>
            {blockedByEnergy && !blockedByAttempts && (
              <div className="mt-2 text-[11.5px] leading-relaxed" style={{ color: "var(--warning)" }}>
                Дневная энергия исчерпана — новые {DAILY_ENERGY} единиц откроются завтра.
              </div>
            )}
          </div>

          {/* Счётчик до обновления + докупка попыток (Task #6) */}
          {!isCompleted && (blockedByAttempts || blockedByEnergy) && (
            <div className="mt-4">
              <AttemptsBooster
                used={state.attempts}
                baseMax={MAX_ATTEMPTS}
                bonus={bonusAttempts}
                onPurchase={() => onPurchase(10)}
                packSize={10}
              />
            </div>
          )}

          {/* Action */}
          <div className="mt-6">
            <p className="mb-3 text-xs" style={{color:"var(--text-secondary)"}}>Попытка списывается при запуске теста. Обновление лимита — в 00:00 по Москве.</p>
            <motion.button
              onClick={onStart}
              disabled={starting || (!isCompleted && (blockedByAttempts || blockedByEnergy))}
              className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-[14px] font-bold transition disabled:cursor-not-allowed"
              style={
                !isCompleted && (blockedByAttempts || blockedByEnergy)
                  ? { background: "var(--warning-muted)", border: "1px solid var(--warning)", color: "var(--warning)" }
                  : { background: "var(--primary)", color: "#fff" }
              }
              whileHover={!isCompleted && (blockedByAttempts || blockedByEnergy) ? undefined : { scale: 1.015 }}
              whileTap={!isCompleted && (blockedByAttempts || blockedByEnergy) ? undefined : { scale: 0.985 }}
            >
              {starting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  {!isCompleted && (blockedByAttempts || blockedByEnergy) ? <AlertTriangle size={16} /> : <ArrowRight size={16} />}
                  <span>{isCompleted ? "Пересдать уровень" : actionLabel}</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Learning stages, with one topic icon and compact level controls.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TestWorldMap() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [levelStates, setLevelStates] = useState<LevelState[]>(getInitialLevelStates);
  const [energy, setEnergy] = useState<EnergyState>(() => ({ date: getEnergyDateKey(), remaining: DAILY_ENERGY }));
  const [openIsland, setOpenIsland] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<AttemptBalance | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Hydrate from the per-user cache immediately to avoid a flash, then replace
  // with the authoritative server state once the GET resolves.
  useEffect(() => {
    const cachedStates = loadProgress(userId);
    const cachedEnergy = loadEnergy(userId);
    setLevelStates(cachedStates);
    setEnergy(cachedEnergy);

    let cancelled = false;
    const refresh = async () => {
      if (document.hidden) return;
      const server = await hydrateFromServer();
      if (cancelled || !server) return;
      setLevelStates(server.states);
      setEnergy(server.energy);
      setAttempts(server.attempts);
      try {
        localStorage.setItem(progressKey(userId), JSON.stringify(server.states));
        localStorage.setItem(energyKey(userId), JSON.stringify(server.energy));
        window.dispatchEvent(new CustomEvent("hunterlite:energy", {detail:server.energy}));
      } catch { /* cache is optional */ }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60000);
    return () => {cancelled=true;clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  }, [userId]);

  useEffect(() => {
    if (startError) {
      const t = setTimeout(() => setStartError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [startError]);

  // ── Derive the trail: per-region status, the active frontier, "you are here" ──
  const regions = useMemo(() => {
    return ISLANDS.map((island, idx) => {
      const levels = levelStates.filter(s => island.levels.includes(s.level));
      const completedCount = levels.filter(s => s.status === "completed").length;
      const hasFrontier = levels.some(s => s.status === "available" || s.status === "failed");
      return { island, idx, levels, completedCount, hasFrontier };
    });
  }, [levelStates]);

  const activeIdx = useMemo(() => regions.findIndex(r => r.hasFrontier), [regions]);

  const regionStatus = useCallback((r: typeof regions[number]): RegionStatus => {
    if (r.completedCount === 10) return "completed";
    if (r.idx === activeIdx) return "active";
    return "locked";
  }, [activeIdx]);

  // "You are here": first available level in the active region.
  const hereLevel = useMemo(() => {
    if (activeIdx < 0) return null;
    const r = regions[activeIdx];
    const avail = r.levels.find(s => s.status === "available");
    return avail?.level ?? null;
  }, [regions, activeIdx]);

  // Auto-open the active region.
  const autoOpenId = useMemo(() => {
    if (activeIdx >= 0) return ISLANDS[activeIdx].id;
    return ISLANDS[0].id;
  }, [activeIdx]);

  useEffect(() => {
    setOpenIsland(autoOpenId);
  }, [autoOpenId]);

  const totalCompleted = levelStates.filter(s => s.status === "completed").length;

  const findIslandForLevel = useCallback((level: number) => {
    return ISLANDS.find(i => i.levels.includes(level))!;
  }, []);

  const handleLevelClick = useCallback((level: number) => {
    const state = levelStates.find(s => s.level === level);
    if (!state || state.status === "locked") return;
    setSelectedLevel(level);
  }, [levelStates]);

  const startLevel = useCallback(async () => {
    if (!selectedLevel || starting) return;
    const state = levelStates.find(s => s.level === selectedLevel);
    if (!state) return;

    // Server checks the shared wallet atomically; the cache cannot authorize a test.
    const island = findIslandForLevel(selectedLevel);
    setStarting(true);
    setStartError(null);

    try {
      const difficulty = getLevelDifficulty(selectedLevel);
      const diffMap = { easy: 1, medium: 2, hard: 3, expert: 4 };
      const res = await api.post("/knowledge/sessions", {
        mode: "themed",
        category: island.category,
        ai_personality: "professor",
        choices_format: true,
        difficulty: diffMap[difficulty],
        max_questions: state.questionsCount,
        map_level: selectedLevel,
      }) as { id?: string; session_id?: string };

      const sid = res?.id || res?.session_id;
      if (sid) {
        // Daily usage is reserved by the server when the test is created.
        const params = new URLSearchParams({
          mode: "themed",
          category: island.category,
          personality: "professor",
          choices_format: "1",
          map_level: String(selectedLevel),
        });
        router.push(`/pvp/quiz/${sid}?${params.toString()}`);
      } else {
        setStartError("Не удалось создать сессию");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка при запуске теста";
      setStartError(message);
    } finally {
      setStarting(false);
    }
  }, [selectedLevel, levelStates, starting, findIslandForLevel, router]);

  // Докупка попыток идёт через @BFLHUNTER_bot — единая экосистема.
  const purchaseAttempts = useCallback(async (packSize = 10) => {
    if (!selectedLevel) return;
    try {
      const res = await api.post<{ deeplink: string; telegram_linked: boolean }>(
        "/training-map/attempts/deeplink",
        { level: selectedLevel, pack: packSize },
      );
      window.location.assign(res.deeplink);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось открыть бота. Попробуйте ещё раз.";
      setStartError(message);
    }
  }, [selectedLevel]);

  const selectedState = selectedLevel ? levelStates.find(s => s.level === selectedLevel) : null;
  const selectedIsland = selectedLevel ? findIslandForLevel(selectedLevel) : null;

  let examCounter = 0;

  return (
    <div className="relative mt-4">
      {/* Error toast */}
      <AnimatePresence>
        {startError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 z-50 -translate-x-1/2"
          >
            <div
              className="flex items-center gap-3 rounded-xl px-5 py-3 text-sm"
              style={{ background: "var(--surface-card)", border: "1px solid var(--danger)", color: "var(--danger)", boxShadow: "var(--shadow-lg)" }}
            >
              <AlertTriangle size={16} />
              {startError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The certificate — destination, always visible */}
      <CertificateSummit completed={totalCompleted} total={100} energy={energy} />
      <p className="mb-6 text-sm" style={{color:"var(--text-secondary)"}}>Дополнительных попыток: {attempts?.paid_remaining || 0}. Общий пакет — 10 попыток за 1 499 ₽ до 00:00 МСК. Покупка пока недоступна.</p>

      {/* One island: topo terrain behind the whole trail + spine + trail column */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="relative"
      >

        <div className="relative flex gap-4" style={{ zIndex: 1 }}>


          <div className="min-w-0 flex-1">
            {regions.map((r) => {
              const st = regionStatus(r);
              const gate = r.island.checkpoint ? (() => { examCounter += 1; return examCounter; })() : null;
              const levelsLeft = 10 - r.completedCount;
              return (
                <div key={r.island.id}>
                  <RegionBlock
                    island={r.island}
                    levels={r.levels}
                    status={st}
                    expanded={openIsland === r.island.id}
                    hereLevel={st === "active" ? hereLevel : null}
                    onToggle={() => setOpenIsland(openIsland === r.island.id ? null : r.island.id)}
                    onLevelClick={handleLevelClick}
                  />
                  {gate !== null && (
                    <ExamGate index={gate} unlocked={r.completedCount === 10} levelsLeft={levelsLeft} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Level detail modal */}
      <AnimatePresence>
        {selectedLevel && selectedState && selectedIsland && (
          <LevelDetailModal
            state={selectedState}
            island={selectedIsland}
            energy={energy}
            paidRemaining={attempts?.paid_remaining || 0}
            onClose={() => setSelectedLevel(null)}
            onStart={startLevel}
            onPurchase={purchaseAttempts}
            starting={starting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
