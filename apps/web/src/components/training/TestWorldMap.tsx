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
  GraduationCap,
  X,
  Award,
} from "lucide-react";
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
   DIFFICULTY FOR LEVEL — ramps up within region
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

// 3-letter region code in the malvah "quiet classification" spirit (R03 · ИМУ).
function regionCode(idx: number, name: string): string {
  return `R${String(idx + 1).padStart(2, "0")} · ${name.slice(0, 3).toUpperCase()}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOPO TERRAIN — one continuous topographic field behind the WHOLE trail.
   A single SVG stretched across the full column makes it read as one island.
   ═══════════════════════════════════════════════════════════════════════════ */

function TopoTerrain() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 1000"
      preserveAspectRatio="none"
      style={{ opacity: "var(--topo-opacity)", zIndex: 0 }}
    >
      <g fill="none" stroke="var(--primary)" strokeWidth={1} vectorEffect="non-scaling-stroke">
        <path d="M-20,70 C90,30 150,120 250,80 C330,48 370,110 420,84" />
        <path d="M-20,150 C80,110 160,200 250,160 C340,124 380,190 420,164" />
        <path d="M-20,250 C100,300 170,210 260,260 C340,304 380,234 420,276" />
        <path d="M-20,360 C90,320 150,420 250,380 C340,346 380,420 420,392" />
        <path d="M-20,470 C100,520 180,430 260,480 C340,524 380,452 420,496" />
        <path d="M-20,580 C90,540 160,640 250,600 C340,566 380,640 420,612" />
        <path d="M-20,690 C100,740 180,650 260,700 C340,742 380,672 420,716" />
        <path d="M-20,800 C90,760 160,860 250,820 C340,786 380,860 420,832" />
        <path d="M-20,910 C100,952 180,872 260,920 C340,960 380,892 420,936" />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRAIL ROW — a single stop on the journey. Each row paints its own left
   trail-segment (solid = travelled, dashed = ahead) so the column reads as one
   continuous line without any global pixel math. The marker sits on the line.
   ═══════════════════════════════════════════════════════════════════════════ */

const TRAIL_X = 15; // px — centre of the trail line / markers

function TrailRow({
  travelled,
  firstSegment,
  lastSegment,
  marker,
  children,
  onClick,
  disabled,
  minHeight = 60,
}: {
  travelled: boolean;       // solid primary segment vs dashed border
  firstSegment?: boolean;   // no line above
  lastSegment?: boolean;    // no line below
  marker: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  minHeight?: number;
}) {
  const Comp: React.ElementType = onClick && !disabled ? "button" : "div";
  return (
    <Comp
      onClick={!disabled ? onClick : undefined}
      className="group relative flex w-full items-center text-left outline-none"
      style={{ minHeight, paddingLeft: 44, cursor: onClick && !disabled ? "pointer" : "default" }}
    >
      {/* trail segment (behind marker) */}
      <span
        aria-hidden
        className="absolute"
        style={{
          left: TRAIL_X,
          width: 2,
          top: firstSegment ? "50%" : 0,
          bottom: lastSegment ? "50%" : 0,
          transform: "translateX(-50%)",
          background: travelled
            ? "var(--primary)"
            : "repeating-linear-gradient(to bottom, var(--border-color) 0 3px, transparent 3px 9px)",
          opacity: travelled ? 1 : 0.9,
        }}
      />
      {/* marker on the line */}
      <span
        className="absolute z-10 flex items-center justify-center"
        style={{ left: TRAIL_X, top: "50%", transform: "translate(-50%,-50%)" }}
      >
        {marker}
      </span>
      <span className="min-w-0 flex-1 py-2">{children}</span>
    </Comp>
  );
}

/* ── Markers ──────────────────────────────────────────────────────────────── */

function levelMarker(state: LevelState) {
  const s = state.status;
  if (s === "completed") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--primary)" }}>
        <Check size={15} strokeWidth={3} style={{ color: "#fff" }} />
      </span>
    );
  }
  if (s === "available") {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: "var(--surface-card)", border: "2px solid var(--primary)" }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} />
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: "var(--danger-muted)", border: "2px solid var(--danger)" }}
      >
        <X size={14} strokeWidth={3} style={{ color: "var(--danger)" }} />
      </span>
    );
  }
  // locked — visually inert
  return (
    <span className="flex h-7 w-7 items-center justify-center" style={{ opacity: 0.5 }}>
      <span className="h-2 w-2 rounded-full" style={{ background: "var(--text-muted)" }} />
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   REGION — active (full level stops) / completed (compact) / locked (faint).
   ═══════════════════════════════════════════════════════════════════════════ */

type RegionStatus = "active" | "completed" | "locked";

function RegionBlock({
  island,
  idx,
  levels,
  status,
  expanded,
  hereLevel,
  onToggle,
  onLevelClick,
}: {
  island: Island;
  idx: number;
  levels: LevelState[];
  status: RegionStatus;
  expanded: boolean;
  hereLevel: number | null;
  onToggle: () => void;
  onLevelClick: (level: number) => void;
}) {
  const completedCount = levels.filter(s => s.status === "completed").length;
  const code = regionCode(idx, island.name);

  // ── Header marker per region status ──
  const headerMarker =
    status === "completed" ? (
      <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--primary)" }}>
        <Check size={15} strokeWidth={3} style={{ color: "#fff" }} />
      </span>
    ) : status === "active" ? (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: "var(--primary-muted)", border: "2px solid var(--primary)" }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} />
      </span>
    ) : (
      <span className="flex h-7 w-7 items-center justify-center" style={{ opacity: 0.5 }}>
        <Lock size={13} style={{ color: "var(--text-muted)" }} />
      </span>
    );

  const travelled = status !== "locked";
  const clickable = status !== "locked";

  return (
    <div>
      {/* Region header row */}
      <TrailRow
        travelled={travelled}
        marker={headerMarker}
        onClick={clickable ? onToggle : undefined}
        disabled={!clickable}
        minHeight={status === "active" ? 72 : 56}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)", opacity: status === "locked" ? 0.6 : 1 }}>
              {code}
            </div>
            <h3
              className="mt-0.5 truncate font-bold tracking-tight"
              style={{
                color: status === "locked" ? "var(--text-muted)" : "var(--text-primary)",
                fontSize: status === "active" ? 22 : 17,
                opacity: status === "locked" ? 0.6 : 1,
              }}
            >
              {island.name}
            </h3>
            {status === "active" && (
              <p className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {island.checkpoint ? "Все 10 уровней — и открываются врата." : "Десять уровней пути."}
              </p>
            )}
            {status === "locked" && (
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                Откроется на уровне {island.levels[0]}.
              </p>
            )}
          </div>
          <span className="shrink-0 text-xl leading-none select-none" style={{ opacity: status === "locked" ? 0.4 : 1 }}>
            {island.icon}
          </span>
          <span
            className="shrink-0 font-mono text-[12px] font-semibold tabular-nums"
            style={{ color: status === "completed" ? "var(--primary)" : "var(--text-muted)" }}
          >
            {completedCount}/10
          </span>
        </div>
      </TrailRow>

      {/* Expanded level stops */}
      <AnimatePresence initial={false}>
        {expanded && status !== "locked" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {island.levels.map((lvl, i) => {
              const st = levels.find(s => s.level === lvl)!;
              const isHere = hereLevel === lvl;
              const interactive = st.status === "available" || st.status === "failed" || st.status === "completed";
              const diff = getDifficultyConfig(getLevelDifficulty(lvl));
              return (
                <TrailRow
                  key={lvl}
                  travelled={st.status === "completed"}
                  lastSegment={i === island.levels.length - 1}
                  marker={levelMarker(st)}
                  onClick={interactive ? () => onLevelClick(lvl) : undefined}
                  disabled={!interactive}
                  minHeight={56}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[13.5px] font-semibold"
                          style={{ color: st.status === "locked" ? "var(--text-muted)" : "var(--text-primary)", opacity: st.status === "locked" ? 0.6 : 1 }}
                        >
                          Уровень {lvl}
                        </span>
                        {isHere && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em]"
                            style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
                          >
                            вы здесь
                          </span>
                        )}
                        {island.checkpoint === lvl && (
                          <GraduationCap size={13} style={{ color: "var(--warning)" }} />
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {st.status === "failed" ? (
                          <span style={{ color: "var(--danger)" }}>
                            {Math.max(0, MAX_ATTEMPTS + (st.bonusAttempts ?? 0) - st.attempts)} попыток сегодня
                          </span>
                        ) : st.status === "completed" && st.bestScore !== null ? (
                          <span style={{ color: "var(--primary)" }}>Пройден · {Math.round(st.bestScore)}%</span>
                        ) : (
                          <span>{st.questionsCount} вопросов · {diff?.label}</span>
                        )}
                      </div>
                    </div>
                    {interactive && st.status !== "completed" && (
                      <ArrowRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>
                </TrailRow>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXAM GATE — a milestone on the trail (not a level node).
   ═══════════════════════════════════════════════════════════════════════════ */

function ExamGate({ index, unlocked, levelsLeft }: { index: number; unlocked: boolean; levelsLeft: number }) {
  const marker = (
    <span
      className="flex items-center justify-center"
      style={{
        width: 18,
        height: 18,
        transform: "rotate(45deg)",
        background: unlocked ? "var(--primary)" : "var(--surface-card)",
        border: `1.5px solid ${unlocked ? "var(--primary)" : "var(--border-color)"}`,
      }}
    >
      <span style={{ transform: "rotate(-45deg)" }}>
        <GraduationCap size={10} style={{ color: unlocked ? "#fff" : "var(--text-muted)" }} />
      </span>
    </span>
  );
  return (
    <TrailRow travelled={unlocked} marker={marker} minHeight={56} disabled>
      <div
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
        style={{
          background: unlocked ? "var(--primary-muted)" : "transparent",
          border: `1px solid ${unlocked ? "var(--primary)" : "var(--border-color)"}`,
        }}
      >
        <div className="min-w-0">
          <div
            className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: unlocked ? "var(--primary)" : "var(--text-muted)" }}
          >
            Врата · Экзамен {index}
          </div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
            {unlocked ? "Открыто. Порог — 88%." : `Ещё ${levelsLeft} уровней до врат.`}
          </div>
        </div>
        {unlocked && <ArrowRight size={15} style={{ color: "var(--primary)" }} />}
      </div>
    </TrailRow>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CERTIFICATE SUMMIT — the destination, always visible (sticky).
   ═══════════════════════════════════════════════════════════════════════════ */

function CertificateSummit({ completed, total, energy }: { completed: number; total: number; energy: EnergyState }) {
  const earned = completed >= total;
  const pct = Math.round((completed / total) * 100);
  return (
    <div
      className="sticky top-2 z-30 mb-3 flex items-center gap-4 rounded-2xl px-4 py-3"
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
          <span className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Сертификат
          </span>
          <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {completed} / {total}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          {earned ? "Открыт — заберите свой сертификат." : `${completed} из ${total} — сертификат ждёт.`}
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
          ⚡ {energy.remaining}/{DAILY_ENERGY}
        </div>
        <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>энергия</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRAIL SPINE — left minimap: regions · gates · summit, with "you are here".
   ═══════════════════════════════════════════════════════════════════════════ */

interface SpineItem { kind: "region" | "gate"; status: RegionStatus | "gate-open" | "gate-locked"; active: boolean }

function TrailSpine({ items }: { items: SpineItem[] }) {
  return (
    <div className="relative hidden w-7 shrink-0 lg:flex lg:flex-col lg:items-center">
      <div className="sticky top-24 flex flex-col items-center">
        {/* summit dot */}
        <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ border: "1.5px solid var(--primary)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />
        </span>
        {items.map((it, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="my-1 h-4 w-px" style={{ background: "var(--border-color)" }} />
            {it.kind === "gate" ? (
              <span
                style={{
                  width: 8, height: 8, transform: "rotate(45deg)",
                  background: it.status === "gate-open" ? "var(--primary)" : "transparent",
                  border: `1.5px solid ${it.status === "gate-open" ? "var(--primary)" : "var(--border-color)"}`,
                }}
              />
            ) : it.active ? (
              <span className="flex items-center gap-1">
                <span className="h-3 w-[3px] rounded-full" style={{ background: "var(--primary)" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ border: "2px solid var(--primary)" }} />
              </span>
            ) : (
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: it.status === "completed" ? "var(--primary)" : "var(--text-muted)", opacity: it.status === "completed" ? 1 : 0.45 }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
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
  const passed = (state.bestScore ?? 0) >= PASS_THRESHOLD * 100;
  const actionLabel = blockedByAttempts
    ? "Лимит попыток на сегодня"
    : blockedByEnergy
      ? "Энергия закончилась"
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
      <div className="absolute inset-0 bg-[#18131D]/55 backdrop-blur-md" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm overflow-hidden rounded-[28px]"
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

          {/* Header: eyebrow + large title */}
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
              style={{ background: "var(--primary-muted)", border: "1px solid var(--border-color)" }}
            >
              {island.icon}
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--primary)" }}>
                {island.name}
              </div>
              <h3 className="mt-1 text-[26px] font-bold leading-none tracking-tight" style={{ color: "var(--text-primary)" }}>
                Уровень {state.level}
              </h3>
            </div>
            {isCompleted && (
              <span
                className="ml-auto mt-1 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
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
                {isCompleted ? "∞" : `${attemptsRemaining}/${effectiveMax}`}
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
              <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Энергия на сегодня</span>
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
          {!isCompleted && blockedByAttempts && (
            <div className="mt-4">
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

          {/* Action */}
          <div className="mt-6">
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
   MAIN COMPONENT — one island, one continuous trail to the certificate.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TestWorldMap() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [levelStates, setLevelStates] = useState<LevelState[]>(getInitialLevelStates);
  const [energy, setEnergy] = useState<EnergyState>(() => ({ date: getEnergyDateKey(), remaining: DAILY_ENERGY }));
  const [openIsland, setOpenIsland] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
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
    hydrateFromServer().then((server) => {
      if (cancelled || !server) return;
      setLevelStates(server.states);
      setEnergy(server.energy);
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
    if (!openIsland) setOpenIsland(autoOpenId);
  }, [autoOpenId, openIsland]);

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
        // NB: попытка/энергия списываются НЕ здесь, а при фактическом
        // завершении теста (quiz-страница, syncMapLevelProgress).
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

  // Докупка попыток идёт через @BFLHUNTER_bot — единая экосистема.
  const purchaseAttempts = useCallback(async (packSize = 5) => {
    if (!selectedLevel) return;
    try {
      const res = await api.post<{ deeplink: string; telegram_linked: boolean }>(
        "/training-map/attempts/deeplink",
        { level: selectedLevel, pack: packSize },
      );
      window.open(res.deeplink, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось открыть бота. Попробуйте ещё раз.";
      setStartError(message);
    }
  }, [selectedLevel]);

  const selectedState = selectedLevel ? levelStates.find(s => s.level === selectedLevel) : null;
  const selectedIsland = selectedLevel ? findIslandForLevel(selectedLevel) : null;

  // Spine items (regions + gates interleaved).
  const spineItems: SpineItem[] = useMemo(() => {
    const out: SpineItem[] = [];
    regions.forEach((r) => {
      const st = regionStatus(r);
      out.push({ kind: "region", status: st, active: st === "active" });
      if (r.island.checkpoint) {
        out.push({ kind: "gate", status: r.completedCount === 10 ? "gate-open" : "gate-locked", active: false });
      }
    });
    return out;
  }, [regions, regionStatus]);

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

      {/* One island: topo terrain behind the whole trail + spine + trail column */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="relative"
      >
        <TopoTerrain />
        <div className="relative flex gap-4" style={{ zIndex: 1 }}>
          <TrailSpine items={spineItems} />

          <div className="min-w-0 flex-1">
            {regions.map((r) => {
              const st = regionStatus(r);
              const gate = r.island.checkpoint ? (() => { examCounter += 1; return examCounter; })() : null;
              const levelsLeft = 10 - r.completedCount;
              return (
                <div key={r.island.id}>
                  <RegionBlock
                    island={r.island}
                    idx={r.idx}
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
