"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Home,
  MessageSquare,
  TrendingUp,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Crosshair,
  Repeat,
    Share2,
    Check,
    Download,
    Copy,
    ClipboardCheck,
    Sparkles,
    BookOpen,
  } from "lucide-react";
import { api } from "@/lib/api";
import { downloadTranscript, copyTranscript, copyToClipboard } from "@/lib/exportTranscript";
import AuthLayout from "@/components/layout/AuthLayout";
import { PageSkeleton } from "@/components/ui/Skeleton";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

const PentagramChart = dynamic(() => import("@/components/results/PentagramChart"), {
  loading: () => <Skeleton height={280} width="100%" rounded="12px" />, ssr: false,
});
const EmotionTimeline = dynamic(() => import("@/components/results/EmotionTimeline"), {
  loading: () => <Skeleton height={200} width="100%" rounded="12px" />, ssr: false,
});
import SoftSkillsCard from "@/components/results/SoftSkillsCard";
import AIRecommendations from "@/components/results/AIRecommendations";
import CheckpointProgress from "@/components/results/CheckpointProgress";
import StageBreakdown from "@/components/results/StageBreakdown";
import AICoachSection from "@/components/results/AICoachSection";
import ScoreLayersBreakdown from "@/components/results/ScoreLayersBreakdown";
import JudgeVerdictCard from "@/components/results/JudgeVerdictCard";
import MistakesBreakdown from "@/components/results/MistakesBreakdown";
import ReplayModal from "@/components/results/ReplayModal";
import CallDroppedCard, { type CallDroppedReason } from "@/components/results/CallDroppedCard";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EMOTION_MAP, type EmotionState, type ChatMessage, type SessionResultResponse } from "@/types";
import { logger } from "@/lib/logger";
import { colorAlpha } from "@/lib/utils";

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} мин ${s} сек` : `${s} сек`;
}

const stateValues: Record<string, number> = { cold: 0, skeptical: 1, warming: 2, open: 3, deal: 4 };

function emotionColor(state: string): string {
  return EMOTION_MAP[state as EmotionState]?.color ?? "var(--text-muted)";
}

function emotionLabelRu(state: string): string {
  return EMOTION_MAP[state as EmotionState]?.labelRu ?? state;
}

function getScoreColor(score: number): string {
  return score >= 70 ? "var(--success)" : score >= 40 ? "var(--warning)" : "var(--danger)";
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [result, setResult] = useState<SessionResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [repeating, setRepeating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Replay Mode state
  const [replayMessage, setReplayMessage] = useState<{ msg: ChatMessage; index: number } | null>(null);

  const [previousSkillRadar, setPreviousSkillRadar] = useState<Record<string, number> | null>(null);

  // 2026-05-04 (v2): poll until backend has finished writing score_total +
  // (optionally) the LLM-judge verdict. The training-page hangup fallback
  // navigates here in 5s — but backend's completion_policy + judge call
  // can take 8–60s after that. Without polling, the user sees a
  // half-rendered report (no judge card, score_total=null, message
  // count short) and assumes the session crashed.
  //
  // Stop polling when EITHER:
  //   (a) score_total is set AND (judge present OR transcript too short
  //       to qualify for judge — heuristic: < 4 user messages),
  //   (b) loadError set,
  //   (c) 30s budget exhausted (renders whatever we have — better than
  //       infinite spinner).
  //
  // While polling: show a "processing" hint via `processing` state so
  // the page renders a small banner above the (possibly partial) report
  // instead of a hard skeleton — UX-wise this is gentler than swapping
  // in a full skeleton on every poll cycle.
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 15;          // 15 × 2s = 30s budget
    const POLL_INTERVAL_MS = 2000;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const isFullyScored = (data: SessionResultResponse | null): boolean => {
      if (!data?.session) return false;
      const sess = data.session;
      // Hard fail: backend marked the session terminal but with no scores
      // (rare race). Treat as "done" so we don't spin forever.
      if (sess.status === "abandoned" || sess.status === "error") return true;
      if (sess.score_total === null || sess.score_total === undefined) return false;
      // Judge runs only on transcripts with enough user turns. If the
      // transcript is short, skip the judge check.
      const breakdown = data.score_breakdown as Record<string, unknown> | null;
      const userMsgCount = (breakdown?._user_message_count as number) ?? 0;
      const judgeRequired = userMsgCount >= 4;
      const judgePresent = Boolean(breakdown?.judge);
      return !judgeRequired || judgePresent;
    };

    const fetchOnce = (isFirst: boolean) => {
      api
        .get<SessionResultResponse>(`/training/sessions/${params.id}`)
        .then((data) => {
          if (cancelled) return;
          setResult(data);
          if (isFirst) setLoading(false);
          if (isFullyScored(data) || attempts >= MAX_ATTEMPTS - 1) {
            setProcessing(false);
            // P1 (training-rework): score-based achievement toasts +
            // the "gamification" perfect-score event were removed —
            // дегеймификация. Результат показывается спокойной сводкой,
            // без ачивок/тостов/конфетти.
            return;
          }
          attempts += 1;
          pollTimer = setTimeout(() => fetchOnce(false), POLL_INTERVAL_MS);
        })
        .catch((err) => {
          if (cancelled) return;
          logger.error("Failed to load results:", err);
          setLoadError(err instanceof Error ? err.message : "Не удалось загрузить результаты сессии");
          setProcessing(false);
          if (isFirst) setLoading(false);
        });
    };

    fetchOnce(true);

    // Fetch previous session for skill radar comparison (one-shot)
    api.get<Array<{ id: string; scoring_details?: Record<string, unknown> }>>("/training/history?limit=5")
      .then((history) => {
        if (cancelled) return;
        const currentId = String(params.id);
        const prev = history.find((h) => h.id !== currentId && h.scoring_details?._skill_radar);
        if (prev) {
          setPreviousSkillRadar(prev.scoring_details?._skill_radar as Record<string, number>);
        }
      })
      .catch(() => { /* optional: previous radar not critical */ });

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [params.id]);

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center min-h-screen">
          <PageSkeleton />
        </div>
      </AuthLayout>
    );
  }

  if (loadError) {
    return (
      <AuthLayout>
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <div className="text-center" style={{ maxWidth: 400 }}>
            <AlertCircle size={48} style={{ color: "var(--danger)", margin: "0 auto 16px" }} />
            <h2 style={{ color: "var(--text-primary)", marginBottom: 8 }}>Ошибка загрузки</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>{loadError}</p>
            <button
              onClick={() => { setLoadError(null); setLoading(true); window.location.reload(); }}
              className="px-4 py-2 rounded"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="flex items-center gap-2" style={{ color: "var(--danger)" }}>
          <AlertCircle size={20} />
          Сессия не найдена
        </div>
      </div>
    );
  }

  const { session, messages } = result;
  const totalScore = session.score_total ?? 0;
  const hasScores = session.score_total !== null;
  const totalScoreColor = getScoreColor(totalScore);

  // Phase C (2026-05-08): branch on terminal_outcome. Sessions that
  // ended due to system error / timeout / operator abort get the
  // CallDroppedCard treatment instead of the verdict overlay — the
  // user is NOT at fault and shouldn't be framed as such.
  const errorOutcomes = new Set(["technical_failed", "timeout", "operator_aborted"]);
  const completeness = (result.score_breakdown as unknown as Record<string, number>)?._completeness ?? 1;
  const userMsgCount = (result.score_breakdown as unknown as Record<string, number>)?._user_message_count ?? 0;
  const hasUserTranscript = messages.some((msg) => msg.role === "user" && msg.content?.trim());
  const isCallDropped = !!(
    session.terminal_outcome &&
    errorOutcomes.has(session.terminal_outcome) &&
    !hasScores &&
    userMsgCount === 0 &&
    !hasUserTranscript
  );

  // Layer-based score bars — the canonical 5 categories.
  // Phase C (2026-05-08): consolidated to a single 5-axis truth source.
  // Previously the page rendered THREE different category sets:
  //   - 5 axes here (script/objections/comms/anti/result)
  //   - 8 axes in the live "Балл" sidebar on /training/[id]
  //   - 10 axes in the post-call pentagram from `_skill_radar`
  // Pilots saw three different visualisations of the same call,
  // with category drift (e.g. live preview's `(value/12.5)*100`
  // assumed equal weights but `script_adherence` is /30 not /12.5).
  // Product owner approved consolidation to the 5-axis canonical set;
  // the 10-axis `_skill_radar` is no longer rendered as a pentagram.
  const scoreItems = [
    { label: "Полнота выяснения обстоятельств", value: session.score_script_adherence ?? 0, max: 18 },
    { label: "Правовая точность ФЗ-127", value: session.score_legal ?? 0, max: 25 },
    { label: "Корректность рекомендации", value: session.score_result ?? 0, max: 18 },
    { label: "Отработка сомнений и страхов", value: session.score_objection_handling ?? 0, max: 12 },
    { label: "Этические нарушения", value: Math.max(0, 15 + (session.score_anti_patterns ?? 0)), max: 15 },
  ];

  // Phase C: previous-session overlay extracted from `score_breakdown`
  // for the same 5 axes. Falls back to absent overlay when the prior
  // session has no comparable data (first session, error session, etc).
  const prevScoreItems = previousSkillRadar
    ? [
        // _skill_radar from history may still carry older wider sets;
        // we map the 5 canonical axes from whatever's present, falling
        // back to 0 silently. Order must match `scoreItems` above:
        // Полнота / Правовая точность / Корректность / Сомнения / Этич.нарушения.
        Math.min(100, Math.max(0, (previousSkillRadar.script_adherence ?? 0))),
        Math.min(100, Math.max(0, (previousSkillRadar.legal ?? 0))),
        Math.min(100, Math.max(0, (previousSkillRadar.result ?? 0))),
        Math.min(100, Math.max(0, (previousSkillRadar.objection_handling ?? 0))),
        Math.min(100, Math.max(0, (previousSkillRadar.anti_patterns ?? 0))),
      ]
    : undefined;

  const pentagramData = {
    labels: scoreItems.map((s) => s.label),
    values: scoreItems.map((s) => (s.max > 0 ? (s.value / s.max) * 100 : 0)),
    previousValues: prevScoreItems,
  };

  // Stage progress data (from stage tracker)
  const stageProgress = (result.score_breakdown as Record<string, unknown> | null)?._stage_progress as
    {
      stages_completed?: number[];
      stage_scores?: Record<string, number>;
      skipped_stages?: number[];
      stage_durations_sec?: Record<string, number>;
      stage_message_counts?: Record<string, number>;
      final_stage?: number;
      total_stages?: number;
      call_outcome?: string;
    } | undefined;

  const timeline = session.emotion_timeline || [];
  const emotionJourney = (result.score_breakdown as Record<string, unknown> | null)?._emotion_journey as
    {
      summary?: {
        total_transitions?: number;
        rollback_count?: number;
        peak_state?: string;
        fake_count?: number;
        turning_points?: Array<{
          message_index?: number | null;
          from_state: string;
          to_state: string;
          direction: string;
          triggers?: string[];
        }>;
      };
      timeline?: unknown[];
    } | undefined;
  const journeySummary = emotionJourney?.summary;
  let criticalDrop: { from: string; to: string } | null = null;
  let keyRecovery: { from: string; to: string } | null = null;

  for (let i = 1; i < timeline.length; i++) {
    const prev = stateValues[timeline[i - 1].state] ?? 0;
    const curr = stateValues[timeline[i].state] ?? 0;
    if (curr < prev && !criticalDrop) criticalDrop = { from: timeline[i - 1].state, to: timeline[i].state };
    if (curr > prev && !keyRecovery) keyRecovery = { from: timeline[i - 1].state, to: timeline[i].state };
  }

  return (
    <AuthLayout>
      {/* AchievementToast removed */}

      {/* Phase C (2026-05-08): for error outcomes show CallDroppedCard
          INSTEAD of the verdict overlay + main report. The user shouldn't
          be told «ПОТЕРЯЛ КОНТРОЛЬ 0/100» when the system aborted them. */}
      {isCallDropped && (
        <div className="app-page flex min-h-screen flex-col items-center justify-center px-4">
          <CallDroppedCard
            reason={session.terminal_outcome as CallDroppedReason}
            onRetry={() => {
              // Naive "redirect to /training to start fresh" — fast and
              // avoids needing to know the exact scenario id format. The
              // user can re-pick the same scenario in 2 taps.
              window.location.href = "/training";
            }}
            onExit={() => {
              window.location.href = "/training";
            }}
          />
        </div>
      )}

      <div className="app-page flex flex-col min-h-screen" style={{ display: isCallDropped ? "none" : undefined }}>
        {/* Спокойная сводка вместо драматичного полноэкранного оверлея.
            Тон — нейтральный редакторский (как CallDroppedCard): итог
            одной-двумя строками, без капса/конфетти/звука/glitch.
            Показывается только когда есть итоговый балл. */}
        {!isCallDropped && hasScores && (
          <div
            className="mt-3 mb-2 rounded-2xl border px-5 py-4"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border-color)",
            }}
          >
            <div className="font-mono text-xs tracking-widest" style={{ color: "var(--text-muted)" }}>
              Сессия завершена
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-lg" style={{ color: "var(--text-primary)" }}>
                Итог: {Math.round(totalScore)} из 100
              </span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {totalScore >= 70
                  ? "Разговор проведён уверенно. Ниже — разбор по навыкам и динамика клиента."
                  : totalScore >= 40
                  ? "Есть над чем поработать. Ниже — разбор сильных и слабых мест."
                  : "Разговор дался непросто. Ниже — разбор ошибок и рекомендации, что подтянуть."}
              </span>
            </div>
          </div>
        )}

        <Breadcrumb items={[{ label: "История", href: "/history" }, { label: "Результат" }]} />
        <BackButton href="/training" label="К тренировкам" />

        {/* 2026-05-04 (v2): "processing" banner shown while we poll for
            score_total + LLM-judge to land. The training-page hangup
            fallback can navigate here in 5s — but the judge call alone
            takes up to 8s. Without this banner the user sees a blank
            score and an empty judge-verdict card and assumes a crash. */}
        {processing && (
          <div
            className="mt-3 mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(120,140,255,0.3)",
              background: "rgba(120,140,255,0.06)",
              color: "var(--text-muted)",
            }}
          >
            <Loader2 size={16} className="animate-spin" />
            Подсчёт результатов... Обычно занимает 5–15 секунд.
          </div>
        )}

        {/* Completeness warning for short conversations */}
        {completeness < 0.6 && (
          <div
            className="mt-3 mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(255,180,0,0.3)",
              background: "rgba(255,180,0,0.06)",
              color: "var(--warning)",
            }}
          >
            <AlertTriangle size={16} />
            Разговор был коротким ({userMsgCount} сообщ.). Баллы снижены пропорционально. Для полной оценки проведите сессию с 10+ репликами.
          </div>
        )}

        {/* Header.
            2026-05-11 redesign-B: CRM CTA подтянули из самого низа страницы
            в hero (выше сгиба). Раньше «Добавить в CRM» жил на строке 1219
            под пентаграммой / эмоциями / трапами / soft skills / score layers
            / weak legal / promise / score bars / checkpoint progress /
            stages / script report / AI coach / recommendations — юзеры
            физически не доскролливали. Плюс убрали гейт на `hasScores`:
            кнопка показывалась только если score насчитан, но добавление
            клиента в CRM — независимая от скоринга фича. */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 border-b pb-6 flex flex-col gap-6"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <div className="font-mono text-sm tracking-widest mb-2 uppercase" style={{ color: "var(--accent)" }}>
                Сессия завершена
              </div>
              <h1 className="font-display font-bold text-3xl md:text-4xl tracking-wide uppercase " style={{ color: "var(--text-primary)" }}>
                Отчёт по сессии
              </h1>
            </div>
            <div className="flex items-end gap-8">
              {hasScores && (
                <div className="text-right flex flex-col items-center">
                  <div className="font-mono text-sm tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>ОБЩИЙ БАЛЛ</div>
                  <div className="score-ring relative" style={{ "--ring-color": totalScoreColor } as React.CSSProperties}>
                    <svg width="96" height="96" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="42" fill="none" stroke="var(--border-color)" strokeWidth="4" opacity="0.3" />
                      <circle
                        cx="48" cy="48" r="42" fill="none"
                        stroke={totalScoreColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42 * (totalScore / 100)} ${2 * Math.PI * 42}`}
                        transform="rotate(-90 48 48)"
                        style={{ filter: `drop-shadow(0 0 6px ${totalScoreColor})`, transition: "stroke-dasharray 1s ease-out" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display text-3xl font-bold" style={{ color: totalScoreColor, textShadow: `0 0 10px ${totalScoreColor}` }}>
                        {Math.round(totalScore)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <Link href="/training">
                <motion.span
                  className="flex items-center gap-2 rounded-lg px-6 py-3 font-mono text-xs tracking-widest transition-colors backdrop-blur"
                  style={{ background: "var(--accent-muted)", border: "1px solid var(--accent)", color: "var(--accent)" }}
                  whileHover={{ background: "var(--accent)", color: "white" }}
                  whileTap={{ scale: 0.97 }}
                >
                  <RotateCcw size={14} /> НОВАЯ ТРЕНИРОВКА
                </motion.span>
              </Link>
            </div>
          </div>
        </motion.header>

        {/*
          NEW-8 (2026-05-04): JudgeVerdictCard + MistakesBreakdown were
          originally inserted HERE (between header and the
          pentagram + emotion-timeline grid below). On standard laptop
          viewports the two cards together pushed the pentagram column
          ~700px down — users reported "пентаграмма исчезла, ничего не вижу"
          (URL: /results/46cca1a2-…). PR #224 added them too aggressively.

          Fix: render them BELOW the existing two-column grid so the
          pentagram + emotion timeline remain the first thing visible
          after the score header. Cards are not removed — they re-appear
          immediately after the grid (still above XP / story / soft-skills /
          L1-L10 / weak-legal sections).
        */}

        {/* P1 (training-rework): XP Rewards banner (+N XP, level_up,
            base/score/streak/achievements breakdown) удалён —
            дегеймификация по решению заказчика. XP больше не
            начисляется/показывается; таблицы xp_* остаются спящими. */}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          {/* LEFT: Pentagram */}
          {hasScores && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="col-span-1 lg:col-span-5 glass-panel rounded-2xl p-6 md:p-8 flex flex-col relative overflow-hidden"
            >
              <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-20 blur-[100px] pointer-events-none" style={{ background: "var(--accent)" }} />

              <h2 className="font-display text-lg tracking-widest flex items-center gap-2 border-b pb-3 z-10 mb-6" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                <Crosshair size={18} style={{ color: "var(--accent)" }} /> ПЕНТАГРАММА НАВЫКОВ
              </h2>

              <div className="flex-1 relative z-10">
                <PentagramChart data={pentagramData} />
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-6 z-10 font-mono text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border" style={{ background: "var(--accent-glow)", borderColor: "var(--accent)" }} />
                  <span style={{ color: "var(--text-secondary)" }}>Ваш профиль</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-dashed" style={{ background: "rgba(255,255,255,0.05)", borderColor: "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-muted)" }}>Идеальная модель</span>
                </div>
              </div>
            </motion.div>
          )}

          <div className={`col-span-1 ${hasScores ? "lg:col-span-7" : "lg:col-span-12"} flex flex-col gap-8`}>
            {/* Emotion Timeline */}
            {timeline.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel rounded-2xl p-6 md:p-8 flex-1 flex flex-col relative overflow-hidden"
              >
                <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full opacity-10 blur-[100px] pointer-events-none" style={{ background: "var(--magenta)" }} />

                <h2 className="font-display text-lg tracking-widest flex items-center gap-2 border-b pb-3 z-10 mb-6" style={{ color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                  <TrendingUp size={18} style={{ color: "var(--magenta)" }} /> ЭМОЦИИ ПО ВРЕМЕНИ
                </h2>

                <div className="flex-1 w-full relative z-10">
                  <EmotionTimeline
                    timeline={timeline}
                    journeySummary={journeySummary}
                    onReplayMessage={(msgIdx) => {
                      // Find the nearest user message at or after this index for Replay Mode
                      const msg = messages.find((m, i) => i >= msgIdx && m.role === "user");
                      if (msg) {
                        setReplayMessage({ msg, index: messages.indexOf(msg) });
                      }
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Insight cards */}
            {(criticalDrop || keyRecovery) && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {criticalDrop && (
                  <div className="glass-panel p-5 rounded-xl" style={{ borderLeft: "4px solid var(--danger)", background: "linear-gradient(to right, var(--danger-muted), transparent)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} style={{ color: "var(--danger)" }} />
                      <div className="font-mono text-sm uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Критич. падение</div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      Эмоция клиента упала: <span style={{ color: "var(--danger)" }}>{emotionLabelRu(criticalDrop.from)}</span> → <span style={{ color: "var(--danger)" }}>{emotionLabelRu(criticalDrop.to)}</span>
                    </p>
                  </div>
                )}
                {keyRecovery && (
                  <div className="glass-panel p-5 rounded-xl" style={{ borderLeft: "4px solid var(--success)", background: "linear-gradient(to right, rgba(61,220,132,0.05), transparent)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={14} style={{ color: "var(--success)" }} />
                      <div className="font-mono text-sm uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Восстановление</div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      Восстановление: <span style={{ color: "var(--success)" }}>{emotionLabelRu(keyRecovery.from)}</span> → <span style={{ color: "var(--success)" }}>{emotionLabelRu(keyRecovery.to)}</span>
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* NEW-8: judge verdict + mistakes breakdown rendered AFTER the
            pentagram + emotion-timeline grid, so the score visualisation
            appears first and the verbose AI text doesn't push it offscreen. */}
        {result.score_breakdown?.judge && (
          <div className="mt-8">
            <JudgeVerdictCard
              judge={result.score_breakdown.judge}
              // P4 (2026-05-04): clicking a chip scrolls to the cited
              // user message in the transcript pane. We use the user-only
              // message stream the judge prompt enumerates (M[i]) — find
              // the i-th user role message in `result.messages`, locate
              // its DOM anchor, scroll into view and pulse-highlight.
              onJumpToMessage={(idx) => {
                if (idx < 0 || !Array.isArray(result.messages)) return;
                let userTurnSeen = -1;
                let targetMsgId: string | null = null;
                for (const m of result.messages) {
                  if (m.role === "user") {
                    userTurnSeen += 1;
                    if (userTurnSeen === idx) {
                      targetMsgId = String(m.id ?? "");
                      break;
                    }
                  }
                }
                if (!targetMsgId) return;
                const el = document.querySelector(`[data-msg-id="${targetMsgId}"]`);
                if (!el) return;
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-yellow-400/70");
                setTimeout(() => el.classList.remove("ring-2", "ring-yellow-400/70"), 2200);
              }}
            />
          </div>
        )}
        <div className="mt-6">
          <MistakesBreakdown items={result.score_breakdown?.anti_patterns?.detected ?? []} />
        </div>

        {/* Transcript — moved here (2026-05-11 redesign-B) от позиции
            под всеми 20+ блоками к позиции сразу после verdict + mistakes.
            Юзер видит свой диалог на 2-м экране вместо 20-го. */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-panel mt-6 p-6 rounded-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} style={{ color: "var(--text-muted)" }} />
              <p className="font-mono text-sm uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                ДИАЛОГ ({messages.length} сообщ.)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={async () => {
                  const meta = {
                    sessionId: session.id,
                    scenarioTitle: undefined,
                    date: session.started_at ? new Date(session.started_at).toLocaleDateString("ru-RU") : new Date().toLocaleDateString("ru-RU"),
                    score: session.score_total,
                    emotion: timeline.length > 0 ? emotionLabelRu(timeline[timeline.length - 1].state) : undefined,
                    duration: session.duration_seconds ? formatDuration(session.duration_seconds) : undefined,
                  };
                  const msgs = messages.map((m) => ({
                    role: m.role as "user" | "assistant" | "system",
                    text: m.content,
                    timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : undefined,
                  }));
                  const ok = await copyTranscript(meta, msgs);
                  if (ok) {
                    setTranscriptCopied(true);
                    setTimeout(() => setTranscriptCopied(false), 2000);
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors"
                style={{ background: "var(--input-bg)", color: transcriptCopied ? "var(--success)" : "var(--text-muted)", border: "1px solid var(--border-color)" }}
                whileTap={{ scale: 0.95 }}
                title="Скопировать транскрипт"
              >
                {transcriptCopied ? <ClipboardCheck size={12} /> : <Copy size={12} />}
                {transcriptCopied ? "Скопировано" : "Копировать"}
              </motion.button>
              <motion.button
                onClick={() => {
                  const meta = {
                    sessionId: session.id,
                    scenarioTitle: undefined,
                    date: session.started_at ? new Date(session.started_at).toLocaleDateString("ru-RU") : new Date().toLocaleDateString("ru-RU"),
                    score: session.score_total,
                    emotion: timeline.length > 0 ? emotionLabelRu(timeline[timeline.length - 1].state) : undefined,
                    duration: session.duration_seconds ? formatDuration(session.duration_seconds) : undefined,
                  };
                  const msgs = messages.map((m) => ({
                    role: m.role as "user" | "assistant" | "system",
                    text: m.content,
                    timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : undefined,
                  }));
                  downloadTranscript(meta, msgs);
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors"
                style={{ background: "var(--input-bg)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
                whileTap={{ scale: 0.95 }}
                title="Скачать транскрипт (.md)"
              >
                <Download size={12} />
                Скачать
              </motion.button>
            </div>
          </div>
          <div className="max-h-[500px] space-y-2 overflow-y-auto">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                data-msg-id={String(msg.id)}
                className={`flex gap-3 rounded-lg p-2 transition-colors ${msg.role === "user" ? "cursor-pointer hover:ring-1 hover:ring-[var(--accent)]" : ""}`}
                style={{ background: msg.role !== "user" ? "var(--input-bg)" : "transparent" }}
                onClick={() => {
                  if (msg.role === "user") {
                    setReplayMessage({ msg, index: idx });
                  }
                }}
                title={msg.role === "user" ? "Нажмите для идеального ответа" : undefined}
              >
                <span
                  className="w-20 shrink-0 font-mono text-sm uppercase"
                  style={{ color: msg.role === "user" ? "var(--accent)" : emotionColor(msg.emotion_state || "") }}
                >
                  {msg.role === "user" ? "ВЫ" : "КЛИЕНТ"}
                </span>
                <div className="flex-1">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{msg.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {msg.emotion_state && (
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs"
                        style={{ background: "var(--accent-muted)", color: emotionColor(msg.emotion_state) }}
                      >
                        {emotionLabelRu(msg.emotion_state)}
                      </span>
                    )}
                    {msg.role === "user" && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs opacity-50 hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(138,43,226,0.15)", color: "var(--accent)" }}
                      >
                        <Sparkles size={13} /> Разбор
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Story-mode panel removed (customer decision #3, 2026-06-04):
            «История клиента / Звонок N из M / последствия» surface is cut
            front-and-back. The backend no longer projects story/story_calls. */}

        {/* Soft Skills */}
        {result.soft_skills && (
          <div className="mt-6">
            <SoftSkillsCard skills={result.soft_skills} />
          </div>
        )}

        {/* L1-L10 Detailed Score Layers */}
        {hasScores && (
          <div className="mt-6">
            <ScoreLayersBreakdown
              scoreBreakdown={{
                score_script_adherence: session.score_script_adherence ?? 0,
                score_objection_handling: session.score_objection_handling ?? 0,
                score_communication: session.score_communication ?? 0,
                score_anti_patterns: session.score_anti_patterns ?? 0,
                score_result: session.score_result ?? 0,
                score_chain_traversal: session.score_chain_traversal ?? 0,
                score_trap_handling: session.score_trap_handling ?? 0,
                score_human_factor: session.score_human_factor ?? 0,
                score_narrative: session.score_narrative ?? 0,
                score_legal: session.score_legal ?? 0,
              }}
              totalScore={totalScore}
              layerExplanations={session.scoring_details?._layer_explanations as import("@/components/results/ScoreLayersBreakdown").LayerExplanation[] | undefined}
            />
          </div>
        )}

        {/* 3.1: Weak legal areas → Knowledge Quiz link */}
        {result.weak_legal_categories && result.weak_legal_categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="cyber-card mt-6 p-5 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, var(--danger), transparent)" }} />
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--danger-muted)", border: "1px solid var(--danger-muted)" }}>
                <BookOpen size={18} style={{ color: "var(--danger)" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={12} style={{ color: "var(--danger)" }} />
                  <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--danger)" }}>СЛАБЫЕ МЕСТА ПО ФЗ-127</span>
                </div>
                <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                  Ваша юридическая точность ниже нормы. Подтяните знания в этих категориях:
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {result.weak_legal_categories.map((cat: { category: string; display_name: string; accuracy_pct: number }) => (
                    <Link key={cat.category} href={`/knowledge`}>
                      <span className="status-badge status-badge--danger" style={{ cursor: "pointer" }}>
                        {cat.display_name} · {cat.accuracy_pct}%
                      </span>
                    </Link>
                  ))}
                </div>
                <Button href={`/knowledge`} size="sm" icon={<BookOpen size={14} />}>
                    Подтяни знания по ФЗ-127
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Promise-fulfillment panel removed (customer decision #3,
            2026-06-04): it was a CRM-story «выполнение обещаний» surface tied
            to story-mode. Cut front-and-back; backend no longer projects it. */}

        {/* Score bars */}
        {hasScores && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-panel mt-8 p-6 md:p-8 rounded-2xl"
          >
            <h3 className="font-display text-lg font-bold tracking-wide mb-5" style={{ color: "var(--text-primary)" }}>
              Базовые категории
            </h3>
            <div className="space-y-4">
              {scoreItems.map((item, i) => {
                const pct = item.max > 0 ? (item.value / item.max) * 100 : 0;
                const barColor = pct >= 70 ? "var(--success)" : pct >= 40 ? "var(--warning)" : "var(--danger)";
                return (
                  <motion.div key={item.label} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold" style={{ color: barColor }}>{Math.round(item.value)}</span>
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>/ {item.max}</span>
                      </div>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.6 + i * 0.1 }}
                        style={{ background: barColor, boxShadow: `0 0 8px ${colorAlpha(barColor, 25)}` }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Checkpoint Progress */}
        {result.score_breakdown?.script_adherence?.checkpoints && (
          <div className="mt-6">
            <CheckpointProgress checkpoints={result.score_breakdown.script_adherence.checkpoints} />
          </div>
        )}

        {/* Stage-by-stage breakdown with recommendations */}
        {stageProgress && (
          <div className="mt-6">
            <StageBreakdown
              stageProgress={stageProgress}
              resultDetails={(result.score_breakdown as Record<string, unknown> | null)?.result as Record<string, unknown> | undefined}
              callOutcome={((result.score_breakdown as Record<string, unknown> | null)?.call_outcome as string) || undefined}
              emotionTimeline={session.emotion_timeline || undefined}
            />
          </div>
        )}

        {/* AI-Coach Section (expanded analysis with citations) */}
        <div className="mt-6">
          <AICoachSection
            sessionId={String(params.id)}
            coachData={result.score_breakdown as Record<string, unknown> | null}
            difficulty={(() => {
              // Extract difficulty from session or default to 5
              const sd = result.score_breakdown as Record<string, unknown> | null;
              return (sd?._session_difficulty as number) ?? 5;
            })()}
          />
        </div>

        {/* AI Recommendations (markdown) — рендерим только если реальный
            feedback_text есть. 2026-05-11 redesign-B: убрали fallback-текст
            «попробуйте обновить страницу позже» — он рендерился пустым
            серым блоком на каждой сессии до того как джадж дописывал
            feedback, и юзер видел его постоянно. AICoachSection выше уже
            держит этот use case с polling-ом. */}
        {session.feedback_text && session.feedback_text.trim().length > 0 && (
          <div className="mt-6">
            <AIRecommendations text={session.feedback_text} />
          </div>
        )}


        {/* Transcript moved up (after MistakesBreakdown) per 2026-05-11
            redesign-B — это центральный артефакт сессии, должен быть на
            1-м экране, а не двадцатом. */}

        {/* «Что дальше?» — score-based hints. CRM CTA уехал в hero
            (см. редизайн-B 2026-05-11). Этот блок остаётся только для
            подсказок по баллам и больше не дублирует кнопку CRM. */}
        {hasScores && (totalScore < 70 || totalScore >= 85) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-8 glass-panel rounded-2xl p-6"
          >
            <h3 className="font-display font-semibold text-base mb-4" style={{ color: "var(--text-primary)" }}>
              Что дальше?
            </h3>
            <div className="flex flex-wrap gap-3">
              {totalScore < 70 && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(255,180,0,0.08)", color: "var(--warning)", border: "1px solid rgba(255,180,0,0.2)" }}>
                  Рекомендуем повторить сценарий — сфокусируйтесь на слабых местах
                </div>
              )}
              {totalScore >= 85 && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(61,220,132,0.08)", color: "var(--success)", border: "1px solid rgba(61,220,132,0.2)" }}>
                  Отличный результат! Попробуйте более сложный сценарий
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 flex justify-center gap-3 pb-8">
          <Button
            onClick={async () => {
              const ok = await copyToClipboard(window.location.href);
              if (ok) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            icon={copied ? <Check size={16} /> : <Share2 size={16} />}
          >
            {copied ? "Скопировано" : "Поделиться"}
          </Button>
          <Button href="/home" icon={<Home size={16} />}>На главную</Button>
          {(() => {
            const sessionLoose = session as unknown as {
              scenario_id?: string | null;
              real_client_id?: string | null;
              custom_character_id?: string | null;
              custom_params?: Record<string, unknown> | null;
              id: string;
              started_at?: string | null;
            };
            const oldMode =
              (sessionLoose.custom_params?.session_mode as string) || "chat";
            const realClientId = sessionLoose.real_client_id ?? null;
            const customCharId = sessionLoose.custom_character_id ?? null;
            const retrainLabel = oldMode === "call" ? "Повторить звонок" : "Повторить чат";
            const canRetrain = !!(sessionLoose.scenario_id || realClientId || customCharId);
            // 2026-04-23 Sprint 7 (scenario M) — detect legacy sessions
            // created before Zone 1 migration (2026-04-23) that don't
            // carry real_client_id / custom_character_id. On retrain
            // they'll fallback to P3 direct-clone with a freshly
            // generated random client → warn the user so the mismatch
            // isn't a surprise («почему другой клиент?»).
            const ZONE1_CUTOFF = "2026-04-23";
            const isLegacySession = (() => {
              if (realClientId || customCharId) return false;
              if (!sessionLoose.started_at) return true;
              try {
                return sessionLoose.started_at.slice(0, 10) < ZONE1_CUTOFF;
              } catch {
                return false;
              }
            })();

            return (
              <div className="flex flex-col items-center gap-1.5">
                <Button
                  onClick={async () => {
                    if (repeating || !canRetrain) return;
                    // Priority 1: real_client → CRM pit-stop
                    if (realClientId) {
                      router.push(
                        `/clients/${realClientId}?retrain=${oldMode}&from=${sessionLoose.id}`,
                      );
                      return;
                    }
                    // Priority 2: custom_character → SavedTab pit-stop
                    if (customCharId) {
                      router.push(
                        `/training?retrain_from=${sessionLoose.id}&char=${customCharId}`,
                      );
                      return;
                    }
                    // Priority 3: catalog scenario → direct POST clone (no pit-stop)
                    setRepeating(true);
                    try {
                      const newSession = await api.post("/training/sessions", {
                        clone_from_session_id: sessionLoose.id,
                      });
                      if (oldMode === "call") {
                        router.push(`/training/${newSession.id}/call`);
                      } else {
                        router.push(`/training/${newSession.id}`);
                      }
                    } catch {
                      setRepeating(false);
                    }
                  }}
                  disabled={repeating || !canRetrain}
                  loading={repeating}
                  icon={<Repeat size={16} />}
                >
                  {retrainLabel}
                </Button>
                {isLegacySession && canRetrain && (
                  <span
                    className="text-[10px] flex items-center gap-1"
                    style={{ color: "var(--warning)" }}
                    title="Это старая сессия из времён до обновления CRM-привязки — клиент сгенерируется случайно и может отличаться от оригинального."
                  >
                    <AlertTriangle size={10} />
                    Старая сессия — клиент может отличаться
                  </span>
                )}
              </div>
            );
          })()}
          <Button href="/training" variant="primary" iconRight={<ArrowRight size={16} />}>
            Новая тренировка
          </Button>
        </motion.div>
      </div>

      {/* Wave 5: Replay Mode Modal */}
      {replayMessage && (
        <ReplayModal
          sessionId={session.id}
          message={replayMessage.msg}
          messageIndex={replayMessage.index}
          clientMessageBefore={
            replayMessage.index > 0
              ? messages.slice(0, replayMessage.index).reverse().find((m) => m.role === "assistant") ?? null
              : null
          }
          onClose={() => setReplayMessage(null)}
        />
      )}
    </AuthLayout>
  );
}
