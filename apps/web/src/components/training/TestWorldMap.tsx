"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Check,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Trophy,
  Map,
  ChevronDown,
  GraduationCap,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { AttemptsBooster } from "@/components/training/AttemptsBooster";

/* ═══════════════════════════════════════════════════════════════════════════
   ISLAND DEFINITIONS — 10 islands × 10 levels = 100 levels
   Each island maps to a LegalCategory in the DB.
   ═══════════════════════════════════════════════════════════════════════════ */

interface Island {
  id: string;
  category: string;
  name: string;
  icon: string;
  color: string;
  colorRgb: string;
  levels: number[];
  checkpoint: number | null;
  examId: string | null;
}

const ISLANDS: Island[] = [
  {
    id: "eligibility",
    category: "eligibility",
    name: "Условия подачи",
    icon: "📘",
    color: "var(--info)",
    colorRgb: "59,130,246",
    levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    checkpoint: null,
    examId: null,
  },
  {
    id: "procedure",
    category: "procedure",
    name: "Порядок процедуры",
    icon: "🏛️",
    color: "#8B5CF6",
    colorRgb: "139,92,246",
    levels: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    checkpoint: null,
    examId: null,
  },
  {
    id: "property",
    category: "property",
    name: "Имущество должника",
    icon: "🏠",
    color: "var(--warning)",
    colorRgb: "245,158,11",
    levels: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    checkpoint: 30,
    examId: "exam-1",
  },
  {
    id: "consequences",
    category: "consequences",
    name: "Последствия",
    icon: "⚖️",
    color: "var(--danger)",
    colorRgb: "239,68,68",
    levels: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
    checkpoint: null,
    examId: null,
  },
  {
    id: "costs",
    category: "costs",
    name: "Стоимость процедуры",
    icon: "💰",
    color: "#F59E0B",
    colorRgb: "245,158,11",
    levels: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
    checkpoint: null,
    examId: null,
  },
  {
    id: "creditors",
    category: "creditors",
    name: "Кредиторы",
    icon: "👥",
    color: "var(--success)",
    colorRgb: "34,197,94",
    levels: [51, 52, 53, 54, 55, 56, 57, 58, 59, 60],
    checkpoint: 60,
    examId: "exam-2",
  },
  {
    id: "documents",
    category: "documents",
    name: "Документы",
    icon: "📋",
    color: "#14B8A6",
    colorRgb: "20,184,166",
    levels: [61, 62, 63, 64, 65, 66, 67, 68, 69, 70],
    checkpoint: null,
    examId: null,
  },
  {
    id: "timeline",
    category: "timeline",
    name: "Сроки",
    icon: "⏰",
    color: "#F97316",
    colorRgb: "249,115,22",
    levels: [71, 72, 73, 74, 75, 76, 77, 78, 79, 80],
    checkpoint: null,
    examId: null,
  },
  {
    id: "court",
    category: "court",
    name: "Судебные процессы",
    icon: "🔨",
    color: "#EC4899",
    colorRgb: "236,72,153",
    levels: [81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
    checkpoint: 90,
    examId: "exam-3",
  },
  {
    id: "rights",
    category: "rights",
    name: "Права должника",
    icon: "🛡️",
    color: "#6366F1",
    colorRgb: "99,102,241",
    levels: [91, 92, 93, 94, 95, 96, 97, 98, 99, 100],
    checkpoint: 100,
    examId: "exam-4",
  },
];

const EXAM_CHECKPOINTS = [30, 60, 90, 100];
const QUESTIONS_PER_LEVEL_MIN = 10;
const QUESTIONS_PER_LEVEL_MAX = 20;
const MAX_ATTEMPTS = 5;
const DAILY_ENERGY = 20;
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
  return new Date().toISOString().slice(0, 10);
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

function saveEnergy(energy: EnergyState, userId: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(energyKey(userId), JSON.stringify(energy));
  window.dispatchEvent(new CustomEvent("hunterlite:energy", { detail: energy }));
  scheduleServerSync({ energy });
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
      ? Math.max(0, Math.min(MAX_ATTEMPTS + bonusAttempts, Number(candidate.attempts)))
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
async function hydrateFromServer(): Promise<{ states: LevelState[]; energy: EnergyState } | null> {
  try {
    const res = await api.get("/training-map/progress") as {
      test_map?: unknown;
      energy?: Partial<EnergyState> | null;
    };
    const hasTestMap = Array.isArray(res?.test_map) && (res.test_map as unknown[]).length > 0;
    return {
      states: hasTestMap ? normalizeProgress(res.test_map) : getInitialLevelStates(),
      energy: normalizeEnergy(res?.energy),
    };
  } catch {
    return null;
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingSync: { test_map?: LevelState[]; energy?: EnergyState } = {};

// Debounced PUT that coalesces test_map and energy writes into one request.
function scheduleServerSync(patch: { test_map?: LevelState[]; energy?: EnergyState }) {
  if (typeof window === "undefined") return;
  _pendingSync = { ..._pendingSync, ...patch };
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    const body = _pendingSync;
    _pendingSync = {};
    api.put("/training-map/progress", body).catch(() => {});
  }, 2000);
}

function saveProgress(states: LevelState[], userId: string | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(progressKey(userId), JSON.stringify(states));
  } catch { /* ignore */ }
  scheduleServerSync({ test_map: states });
}

/* ═══════════════════════════════════════════════════════════════════════════
   DIFFICULTY FOR LEVEL — ramps up within island
   ═══════════════════════════════════════════════════════════════════════════ */

function getLevelDifficulty(level: number): "easy" | "medium" | "hard" | "expert" {
  const posInIsland = ((level - 1) % 10);
  if (posInIsland < 3) return "easy";
  if (posInIsland < 6) return "medium";
  if (posInIsland < 9) return "hard";
  return "expert";
}

function getDifficultyConfig(d: ReturnType<typeof getLevelDifficulty>) {
  switch (d) {
    case "easy":   return { label: "Базовый",      color: "#22C55E", bg: "rgba(34,197,94,0.1)" };
    case "medium": return { label: "Средний",       color: "#F59E0B", bg: "rgba(245,158,11,0.1)" };
    case "hard":   return { label: "Продвинутый",   color: "#EF4444", bg: "rgba(239,68,68,0.1)" };
    case "expert": return { label: "Экспертный",    color: "#A855F7", bg: "rgba(168,85,247,0.1)" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEVEL NODE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function LevelNode({
  state,
  islandColor,
  islandColorRgb,
  isCheckpoint,
  onClick,
}: {
  state: LevelState;
  islandColor: string;
  islandColorRgb: string;
  isCheckpoint: boolean;
  onClick: () => void;
}) {
  const isAvailable = state.status === "available";
  const isCompleted = state.status === "completed";
  const isFailed = state.status === "failed";
  const isLocked = state.status === "locked";

  const nodeSize = isCheckpoint ? 56 : 44;

  return (
    <motion.button
      onClick={onClick}
      disabled={isLocked}
      className="relative flex flex-col items-center gap-1 group"
      whileHover={!isLocked ? { scale: 1.08 } : undefined}
      whileTap={!isLocked ? { scale: 0.95 } : undefined}
    >
      {/* Glow ring for available/checkpoint */}
      {(isAvailable || isCheckpoint && isCompleted) && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: nodeSize + 12,
            height: nodeSize + 12,
            top: -(6),
            left: "50%",
            marginLeft: -(nodeSize + 12) / 2,
            background: `radial-gradient(circle, rgba(${islandColorRgb},0.3) 0%, transparent 70%)`,
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Node circle */}
      <div
        className="relative rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          width: nodeSize,
          height: nodeSize,
          background: isCompleted
            ? `linear-gradient(135deg, rgba(${islandColorRgb},0.2), rgba(${islandColorRgb},0.05))`
            : isAvailable
              ? `linear-gradient(135deg, rgba(${islandColorRgb},0.15), rgba(${islandColorRgb},0.05))`
              : isFailed
                ? "rgba(239,68,68,0.1)"
                : "rgba(255,255,255,0.03)",
          border: isCompleted
            ? `2px solid rgba(${islandColorRgb},0.6)`
            : isAvailable
              ? `2px solid rgba(${islandColorRgb},0.4)`
              : isFailed
                ? "2px solid rgba(239,68,68,0.4)"
                : "1.5px solid rgba(255,255,255,0.08)",
          boxShadow: isAvailable
            ? `0 0 16px rgba(${islandColorRgb},0.2), inset 0 0 8px rgba(${islandColorRgb},0.1)`
            : isCompleted
              ? `0 0 12px rgba(${islandColorRgb},0.15)`
              : "none",
          cursor: isLocked ? "not-allowed" : "pointer",
          opacity: isLocked ? 0.35 : 1,
        }}
      >
        {isLocked && <Lock size={14} style={{ color: "var(--text-muted)", opacity: 0.5 }} />}
        {isCompleted && <Check size={18} style={{ color: islandColor }} strokeWidth={3} />}
        {isFailed && (
          <span className="text-xs font-bold" style={{ color: "var(--danger)" }}>
            {state.attempts > 0 ? `${state.attempts}/${MAX_ATTEMPTS}` : state.level}
          </span>
        )}
        {isAvailable && (
          <span className="text-sm font-bold" style={{ color: islandColor }}>
            {state.level}
          </span>
        )}

        {/* Checkpoint badge */}
        {isCheckpoint && (
          <div
            className="absolute -top-1 -right-1 rounded-full flex items-center justify-center"
            style={{
              width: 20,
              height: 20,
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              boxShadow: "0 2px 8px rgba(245,158,11,0.4)",
            }}
          >
            <GraduationCap size={11} className="text-white" />
          </div>
        )}
      </div>

      {/* Level number */}
      <span
        className="text-[10px] font-bold"
        style={{
          color: isCompleted ? islandColor : isAvailable ? "var(--text-primary)" : "var(--text-muted)",
          opacity: isLocked ? 0.3 : 1,
        }}
      >
        {state.level}
      </span>

      {/* Best score if completed */}
      {isCompleted && state.bestScore !== null && (
        <span className="text-[9px] font-medium" style={{ color: islandColor, opacity: 0.8 }}>
          {Math.round(state.bestScore)}%
        </span>
      )}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ISLAND SECTION COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function IslandSection({
  island,
  levelStates,
  expanded,
  onToggle,
  onLevelClick,
}: {
  island: Island;
  levelStates: LevelState[];
  expanded: boolean;
  onToggle: () => void;
  onLevelClick: (level: number) => void;
}) {
  const completedCount = levelStates.filter(s => s.status === "completed").length;
  const progress = completedCount / 10;
  const isFullyCompleted = completedCount === 10;
  const hasAvailable = levelStates.some(s => s.status === "available" || s.status === "failed");
  const allLocked = levelStates.every(s => s.status === "locked");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {/* Island card */}
      <motion.div
        onClick={onToggle}
        className="relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300"
        style={{
          background: isFullyCompleted
            ? `linear-gradient(135deg, rgba(${island.colorRgb},0.08), rgba(${island.colorRgb},0.02))`
            : "rgba(255,255,255,0.02)",
          border: `1px solid ${isFullyCompleted ? `rgba(${island.colorRgb},0.3)` : hasAvailable ? `rgba(${island.colorRgb},0.15)` : "var(--border-color)"}`,
          opacity: allLocked ? 0.5 : 1,
          boxShadow: hasAvailable ? `0 4px 24px rgba(${island.colorRgb},0.08)` : "none",
        }}
        whileHover={{ scale: allLocked ? 1 : 1.005 }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(${island.colorRgb},${isFullyCompleted ? 0.6 : 0.3}), transparent)`,
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-4 p-5 pb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{
              background: `rgba(${island.colorRgb},0.1)`,
              border: `1px solid rgba(${island.colorRgb},0.2)`,
            }}
          >
            {island.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-wide truncate" style={{ color: "var(--text-primary)" }}>
                {island.name}
              </h3>
              {isFullyCompleted && (
                <Trophy size={14} style={{ color: island.color }} />
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Уровни {island.levels[0]}-{island.levels[9]}
              </span>
              <span className="text-xs font-semibold" style={{ color: island.color }}>
                {completedCount}/10
              </span>
              {island.checkpoint && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: "rgba(245,158,11,0.1)",
                    color: "#F59E0B",
                    border: "1px solid rgba(245,158,11,0.2)",
                  }}
                >
                  Экзамен
                </span>
              )}
            </div>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={18} style={{ color: "var(--text-muted)" }} />
          </motion.div>
        </div>

        {/* Progress bar */}
        <div className="mx-5 mb-4 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, rgba(${island.colorRgb},0.6), rgba(${island.colorRgb},0.9))` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {/* Expanded level grid */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                {/* Level path — winding S-shape */}
                <div className="grid grid-cols-5 gap-y-5 gap-x-3 justify-items-center py-3">
                  {island.levels.map((lvl) => {
                    const st = levelStates.find(s => s.level === lvl)!;
                    const isCheckpoint = island.checkpoint === lvl;
                    return (
                      <LevelNode
                        key={lvl}
                        state={st}
                        islandColor={island.color}
                        islandColorRgb={island.colorRgb}
                        isCheckpoint={isCheckpoint}
                        onClick={() => onLevelClick(lvl)}
                      />
                    );
                  })}
                </div>

                {/* Checkpoint info */}
                {island.checkpoint && (
                  <div
                    className="mt-4 rounded-xl p-3 flex items-center gap-3"
                    style={{
                      background: "rgba(245,158,11,0.06)",
                      border: "1px solid rgba(245,158,11,0.15)",
                    }}
                  >
                    <GraduationCap size={16} style={{ color: "#F59E0B" }} />
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Пройди все 10 уровней чтобы открыть экзамен
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEVEL DETAIL MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function LevelDetailModal({
  state,
  island,
  energy,
  onClose,
  onStart,
  onPurchase,
  starting,
}: {
  state: LevelState;
  island: Island;
  energy: EnergyState;
  onClose: () => void;
  onStart: () => void;
  onPurchase: (packSize?: number) => Promise<void> | void;
  starting: boolean;
}) {
  const diff = getLevelDifficulty(state.level);
  const diffCfg = getDifficultyConfig(diff);
  const isCompleted = state.status === "completed";
  const bonusAttempts = state.bonusAttempts ?? 0;
  const effectiveMax = MAX_ATTEMPTS + bonusAttempts;
  const attemptsRemaining = Math.max(0, effectiveMax - state.attempts);
  const blockedByAttempts = !isCompleted && attemptsRemaining <= 0;
  const blockedByEnergy = !isCompleted && energy.remaining <= 0;
  const actionLabel = blockedByAttempts
    ? "Лимит попыток"
    : blockedByEnergy
      ? "Энергия закончилась"
      : state.attempts > 0
        ? "Попробовать снова"
        : "Начать";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface-card)",
          border: `1px solid rgba(${island.colorRgb},0.2)`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.5), 0 0 40px rgba(${island.colorRgb},0.1)`,
        }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        {/* Top accent */}
        <div
          className="h-1"
          style={{ background: `linear-gradient(90deg, rgba(${island.colorRgb},0.4), rgba(${island.colorRgb},0.8), rgba(${island.colorRgb},0.4))` }}
        />

        <div className="p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg transition-colors hover:bg-white/5"
          >
            <X size={16} style={{ color: "var(--text-muted)" }} />
          </button>

          {/* Icon + Level */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
              style={{
                background: `rgba(${island.colorRgb},0.1)`,
                border: `1px solid rgba(${island.colorRgb},0.2)`,
              }}
            >
              {island.icon}
            </div>
            <div>
              <h3 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                Уровень {state.level}
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {island.name}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)" }}
            >
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {state.questionsCount}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Вопросов</div>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: diffCfg.bg, border: `1px solid ${diffCfg.color}22` }}
            >
              <div className="text-sm font-bold" style={{ color: diffCfg.color }}>
                {diffCfg.label}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Сложность</div>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)" }}
            >
              <div className="text-lg font-bold" style={{ color: attemptsRemaining === 0 ? "var(--warning)" : "var(--text-primary)" }}>
                {attemptsRemaining}/{effectiveMax}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Попыток</div>
            </div>
          </div>

          <div
            className="mb-5 rounded-xl p-3"
            style={{
              background: energy.remaining > 0 ? "rgba(59,130,246,0.08)" : "rgba(245,158,11,0.08)",
              border: `1px solid ${energy.remaining > 0 ? "rgba(59,130,246,0.22)" : "rgba(245,158,11,0.28)"}`,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Энергия на сегодня
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  1 попытка = 1 энергия
                </div>
              </div>
              <div className="text-xl font-bold" style={{ color: energy.remaining > 0 ? "var(--info)" : "var(--warning)" }}>
                {energy.remaining}/{DAILY_ENERGY}
              </div>
            </div>
            {blockedByEnergy && !blockedByAttempts && (
              <div className="mt-3 text-xs leading-relaxed" style={{ color: "var(--warning)" }}>
                Дневная энергия закончилась. Новые 20 единиц появятся завтра.
              </div>
            )}
          </div>

          {/* Счётчик до обновления + докупка попыток (Task #6) */}
          {!isCompleted && blockedByAttempts && (
            <div className="mb-5">
              <AttemptsBooster
                used={state.attempts}
                baseMax={MAX_ATTEMPTS}
                bonus={bonusAttempts}
                colorRgb={island.colorRgb}
                onPurchase={() => onPurchase(5)}
                packSize={5}
              />
            </div>
          )}

          {/* Best score */}
          {state.bestScore !== null && (
            <div
              className="rounded-lg p-3 mb-5 flex items-center justify-between"
              style={{
                background: state.bestScore >= PASS_THRESHOLD * 100
                  ? `rgba(${island.colorRgb},0.06)`
                  : "rgba(239,68,68,0.06)",
                border: state.bestScore >= PASS_THRESHOLD * 100
                  ? `1px solid rgba(${island.colorRgb},0.15)`
                  : "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Лучший результат
              </span>
              <span
                className="text-lg font-bold"
                style={{ color: state.bestScore >= PASS_THRESHOLD * 100 ? island.color : "var(--danger)" }}
              >
                {Math.round(state.bestScore)}%
              </span>
            </div>
          )}

          {/* Action button */}
          {!isCompleted ? (
	            <motion.button
	              onClick={onStart}
	              disabled={starting}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
	                background: blockedByAttempts || blockedByEnergy
                    ? "rgba(245,158,11,0.08)"
                    : `linear-gradient(135deg, rgba(${island.colorRgb},0.2), rgba(${island.colorRgb},0.1))`,
	                border: blockedByAttempts || blockedByEnergy
                    ? "1.5px solid rgba(245,158,11,0.35)"
                    : `1.5px solid rgba(${island.colorRgb},0.4)`,
	                color: blockedByAttempts || blockedByEnergy ? "var(--warning)" : island.color,
	                boxShadow: `0 4px 20px rgba(${island.colorRgb},0.15)`,
	              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {starting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
	                <>
	                  {blockedByAttempts || blockedByEnergy ? <AlertTriangle size={16} /> : <ArrowRight size={16} />}
	                  {actionLabel}
	                </>
	              )}
            </motion.button>
          ) : isCompleted ? (
            <div className="flex gap-3">
              <div
                className="flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                style={{
                  background: `rgba(${island.colorRgb},0.08)`,
                  border: `1px solid rgba(${island.colorRgb},0.2)`,
                  color: island.color,
                }}
              >
                <Check size={16} /> Пройден
              </div>
              <motion.button
                onClick={onStart}
                disabled={starting}
                className="py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-secondary)",
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {starting ? <Loader2 size={14} className="animate-spin" /> : "Пересдать"}
              </motion.button>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TestWorldMap() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [levelStates, setLevelStates] = useState<LevelState[]>(getInitialLevelStates);
  const [energy, setEnergy] = useState<EnergyState>(() => ({ date: getEnergyDateKey(), remaining: DAILY_ENERGY }));
  const [expandedIsland, setExpandedIsland] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Hydrate from the per-user cache immediately to avoid a flash, then replace
  // with the authoritative server state once the GET resolves. Re-runs when the
  // logged-in user changes so account B never inherits account A's progress.
  useEffect(() => {
    const cachedStates = loadProgress(userId);
    const cachedEnergy = loadEnergy(userId);
    setLevelStates(cachedStates);
    setEnergy(cachedEnergy);

    let cancelled = false;
    hydrateFromServer().then((server) => {
      if (cancelled || !server) return;
      setLevelStates(server.states);
      setEnergy(server.energy);
      // Refresh the local cache for this user so the next load matches.
      try { localStorage.setItem(progressKey(userId), JSON.stringify(server.states)); } catch { /* ignore */ }
      saveEnergy(server.energy, userId);
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (startError) {
      const t = setTimeout(() => setStartError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [startError]);

  const autoExpandFirst = useMemo(() => {
    for (const island of ISLANDS) {
      if (island.levels.some(lvl => {
        const st = levelStates.find(s => s.level === lvl);
        return st && (st.status === "available" || st.status === "failed");
      })) {
        return island.id;
      }
    }
    return ISLANDS[0].id;
  }, [levelStates]);

  useEffect(() => {
    if (!expandedIsland) setExpandedIsland(autoExpandFirst);
  }, [autoExpandFirst, expandedIsland]);

  const totalCompleted = levelStates.filter(s => s.status === "completed").length;
  const overallProgress = totalCompleted / 100;

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

      const effectiveMax = MAX_ATTEMPTS + (state.bonusAttempts ?? 0);
      if (state.status !== "completed" && state.attempts >= effectiveMax) {
        setStartError("Попытки на этот уровень закончились");
        return;
      }

      const currentEnergy = loadEnergy(userId);
      setEnergy(currentEnergy);
      if (state.status !== "completed" && currentEnergy.remaining <= 0) {
        setStartError("Энергия на сегодня закончилась");
        return;
      }
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
	        const newStates = [...levelStates];
	        const idx = newStates.findIndex(s => s.level === selectedLevel);
	        newStates[idx] = {
            ...newStates[idx],
            attempts: Math.min(effectiveMax, newStates[idx].attempts + 1),
            attemptsDate: getEnergyDateKey(),
          };
	        setLevelStates(newStates);
	        saveProgress(newStates, userId);

          if (state.status !== "completed") {
            const nextEnergy = { ...currentEnergy, remaining: Math.max(0, currentEnergy.remaining - 1) };
            setEnergy(nextEnergy);
            saveEnergy(nextEnergy, userId);
          }

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
  }, [selectedLevel, levelStates, starting, findIslandForLevel, router, userId]);

  // Докупка ещё 5 попыток на выбранный уровень (Task #6). Оплата ещё не
  // подключена — пилотный режим выдаёт буст мгновенно. Заодно поднимаем
  // дневную энергию минимум до размера пакета, чтобы купленные попытки точно
  // можно было сыграть, а не упереться в нулевую энергию.
  const purchaseAttempts = useCallback(async (packSize = 5) => {
    if (!selectedLevel) return;
    setLevelStates((prev) => {
      const next = prev.map((s) =>
        s.level === selectedLevel
          ? {
              ...s,
              bonusAttempts: (s.bonusAttempts ?? 0) + packSize,
              attemptsDate: getEnergyDateKey(),
            }
          : s,
      );
      saveProgress(next, userId);
      return next;
    });
    setEnergy((prev) => {
      if (prev.remaining >= packSize) return prev;
      const topped = { ...prev, date: getEnergyDateKey(), remaining: packSize };
      saveEnergy(topped, userId);
      return topped;
    });
  }, [selectedLevel, userId]);

  const selectedState = selectedLevel ? levelStates.find(s => s.level === selectedLevel) : null;
  const selectedIsland = selectedLevel ? findIslandForLevel(selectedLevel) : null;

  return (
    <div className="mt-4 space-y-4">
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
              className="flex items-center gap-3 px-5 py-3 text-sm rounded-xl"
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <AlertTriangle size={16} />
              {startError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overall progress header */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--border-color)",
        }}
      >
	        <div className="flex items-center justify-between mb-3">
	          <div className="flex items-center gap-3">
	            <Map size={18} style={{ color: "var(--accent)" }} />
	            <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
	              Карта знаний ФЗ-127
	            </h3>
	          </div>
	          <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className="rounded-full border px-3 py-1 text-xs font-bold"
                style={{
                  color: energy.remaining > 0 ? "var(--info)" : "var(--warning)",
                  borderColor: energy.remaining > 0 ? "rgba(59,130,246,0.35)" : "rgba(245,158,11,0.4)",
                  background: energy.remaining > 0 ? "rgba(59,130,246,0.08)" : "rgba(245,158,11,0.08)",
                }}
              >
                ⚡ {energy.remaining}/{DAILY_ENERGY}
              </span>
	            <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
	              {totalCompleted}/100
	            </span>
	            <span className="text-xs" style={{ color: "var(--text-muted)" }}>уровней</span>
	          </div>
	        </div>

        {/* Overall progress bar */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, var(--info), var(--accent), var(--success))" }}
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        {/* Checkpoint markers */}
        <div className="flex justify-between mt-2 px-1">
          {EXAM_CHECKPOINTS.map(cp => {
            const reached = totalCompleted >= cp;
            return (
              <div key={cp} className="flex items-center gap-1">
                <GraduationCap size={10} style={{ color: reached ? "#F59E0B" : "var(--text-muted)", opacity: reached ? 1 : 0.3 }} />
                <span className="text-[9px] font-medium" style={{ color: reached ? "#F59E0B" : "var(--text-muted)", opacity: reached ? 1 : 0.3 }}>
                  {cp}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Island list */}
      <div className="space-y-3">
        {ISLANDS.map((island, i) => {
          const islandLevels = levelStates.filter(s => island.levels.includes(s.level));
          return (
            <motion.div
              key={island.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <IslandSection
                island={island}
                levelStates={islandLevels}
                expanded={expandedIsland === island.id}
                onToggle={() => setExpandedIsland(expandedIsland === island.id ? null : island.id)}
                onLevelClick={handleLevelClick}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Level detail modal */}
      <AnimatePresence>
        {selectedLevel && selectedState && selectedIsland && (
	          <LevelDetailModal
	            state={selectedState}
	            island={selectedIsland}
	            energy={energy}
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
