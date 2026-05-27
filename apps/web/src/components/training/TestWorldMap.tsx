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
  Star,
  Map,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

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
const PASS_THRESHOLD = 0.7;

/* ═══════════════════════════════════════════════════════════════════════════
   LEVEL STATE
   ═══════════════════════════════════════════════════════════════════════════ */

type LevelStatus = "locked" | "available" | "completed" | "failed";

interface LevelState {
  level: number;
  status: LevelStatus;
  bestScore: number | null;
  attempts: number;
  questionsCount: number;
}

function getInitialLevelStates(): LevelState[] {
  return Array.from({ length: 100 }, (_, i) => ({
    level: i + 1,
    status: i === 0 ? "available" : "locked",
    bestScore: null,
    attempts: 0,
    questionsCount: QUESTIONS_PER_LEVEL_MIN + Math.floor(Math.random() * (QUESTIONS_PER_LEVEL_MAX - QUESTIONS_PER_LEVEL_MIN + 1)),
  }));
}

const STORAGE_KEY = "hunterlite_test_map_progress";

function loadProgress(): LevelState[] {
  if (typeof window === "undefined") return getInitialLevelStates();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return getInitialLevelStates();
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveProgress(states: LevelState[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch { /* ignore */ }
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    api.put("/training-map/progress", { test_map: states }).catch(() => {});
  }, 2000);
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
  const diff = getLevelDifficulty(state.level);
  const diffCfg = getDifficultyConfig(diff);
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
            {state.attempts}/{MAX_ATTEMPTS}
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
                  {island.levels.map((lvl, idx) => {
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
  onClose,
  onStart,
  starting,
}: {
  state: LevelState;
  island: Island;
  onClose: () => void;
  onStart: () => void;
  starting: boolean;
}) {
  const diff = getLevelDifficulty(state.level);
  const diffCfg = getDifficultyConfig(diff);
  const canRetry = state.attempts < MAX_ATTEMPTS;
  const isCompleted = state.status === "completed";

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
              <div className="text-lg font-bold" style={{ color: state.attempts >= MAX_ATTEMPTS ? "var(--danger)" : "var(--text-primary)" }}>
                {MAX_ATTEMPTS - state.attempts}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Попыток</div>
            </div>
          </div>

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
          {canRetry && !isCompleted ? (
            <motion.button
              onClick={onStart}
              disabled={starting}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: `linear-gradient(135deg, rgba(${island.colorRgb},0.2), rgba(${island.colorRgb},0.1))`,
                border: `1.5px solid rgba(${island.colorRgb},0.4)`,
                color: island.color,
                boxShadow: `0 4px 20px rgba(${island.colorRgb},0.15)`,
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {starting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <ArrowRight size={16} />
                  {state.attempts > 0 ? "Попробовать снова" : "Начать"}
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
              {state.attempts < MAX_ATTEMPTS && (
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
              )}
            </div>
          ) : (
            <div
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
                color: "var(--danger)",
              }}
            >
              <AlertTriangle size={14} /> Попытки исчерпаны
            </div>
          )}
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
  const [levelStates, setLevelStates] = useState<LevelState[]>(getInitialLevelStates);
  const [expandedIsland, setExpandedIsland] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    setLevelStates(loadProgress());
  }, []);

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
  }, [autoExpandFirst]);

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
        newStates[idx] = { ...newStates[idx], attempts: newStates[idx].attempts + 1 };
        setLevelStates(newStates);
        saveProgress(newStates);

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
          <div className="flex items-center gap-2">
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
            onClose={() => setSelectedLevel(null)}
            onStart={startLevel}
            starting={starting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
