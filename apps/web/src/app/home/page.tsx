"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  ArrowRight, Loader2, Phone, Clock, BookOpen, BarChart3,
  Trophy, Flame, Zap, CheckCircle2, XCircle, ChevronRight,
  Target, TrendingUp,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import AuthLayout from "@/components/layout/AuthLayout";
import { scoreColor } from "@/lib/utils";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { logger } from "@/lib/logger";

/* ── Premium easing constant ─────────────────────────────────── */
const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 17) return "Добрый день";
  if (h >= 17 && h < 22) return "Добрый вечер";
  return "Доброй ночи";
}

/* ── Noise texture SVG for premium background ────────────────── */
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

/* ── Learning path stages ────────────────────────────────────── */
const LEARNING_STAGES = [
  { key: "knowledge", icon: "\u{1f4da}", label: "Знания", href: "/knowledge" },
  { key: "tests", icon: "\u{1f5fa}️", label: "Тесты", href: "/training" },
  { key: "cases", icon: "\u{1f4cb}", label: "Кейсы", href: "/cases" },
  { key: "exams", icon: "\u{1f393}", label: "Экзамены", href: "/exam" },
  { key: "practice", icon: "\u{1f3af}", label: "Практика", href: "/training" },
];

/* ── Skills radar labels (10 axes) ────────────────────────────── */
const SKILL_LABELS: Record<string, string> = {
  empathy: "Эмпатия",
  knowledge: "Знания",
  objection_handling: "Возражения",
  stress_resistance: "Стресс",
  closing: "Закрытие",
  qualification: "Квалификация",
  time_management: "Тайм-менеджмент",
  adaptation: "Адаптация",
  legal_knowledge: "Право",
  rapport_building: "Раппорт",
};
const SKILL_KEYS = Object.keys(SKILL_LABELS);

/* ── Quiz question interface ─────────────────────────────────── */
interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

/* ── Mini-case interface ─────────────────────────────────────── */
interface MiniCase {
  id: string;
  narrative: string;
  choices: { text: string; consequence: string; is_best: boolean }[];
}

/* ── API response types ──────────────────────────────────────── */
interface LearningPathProgress {
  overall_percent: number;
  stages: {
    id: string;
    title: string;
    icon: string;
    progress_percent: number;
    detail: string;
    status: string;
  }[];
  streak: {
    current: number;
    best: number;
    today_completed: boolean;
  };
  stats: {
    total_sessions: number;
    total_hours: number;
    average_score: number;
    best_score: number;
    this_week_sessions: number;
    certificates_earned: number;
  };
  progress: Record<string, number>;
}

interface Recommendation {
  type: string;
  title: string;
  description: string;
  action_url: string;
  action_label: string;
}

/* ── Fallback quiz questions ─────────────────────────────────── */
const FALLBACK_QUESTIONS: QuizQuestion[] = [
  {
    id: "f1",
    question: "Какой минимальный размер задолженности для подачи заявления о банкротстве гражданина?",
    options: ["300 000 ₽", "500 000 ₽", "1 000 000 ₽", "100 000 ₽"],
    correct_index: 1,
    explanation: "Согласно ст. 213.3 ФЗ-127, минимальный размер задолженности для банкротства гражданина — 500 000 рублей.",
  },
  {
    id: "f2",
    question: "Максимальный срок процедуры реструктуризации долгов?",
    options: ["1 год", "2 года", "3 года", "5 лет"],
    correct_index: 2,
    explanation: "Срок реализации плана реструктуризации не может превышать 3 года (ст. 213.14 ФЗ-127).",
  },
  {
    id: "f3",
    question: "Кто назначает финансового управляющего в деле о банкротстве?",
    options: ["Должник", "Кредитор", "Арбитражный суд", "СРО"],
    correct_index: 2,
    explanation: "Финансовый управляющий утверждается арбитражным судом (ст. 213.9 ФЗ-127).",
  },
  {
    id: "f4",
    question: "Какие сделки могут быть оспорены в рамках банкротства?",
    options: [
      "Только за последний год",
      "За 1 год (подозрительные) и 3 года (с предпочтением)",
      "Только безвозмездные",
      "Любые за 5 лет",
    ],
    correct_index: 1,
    explanation: "Подозрительные сделки оспариваются за 1 год, сделки с предпочтением — за 6 мес. / 3 года (ст. 61.2, 61.3 ФЗ-127).",
  },
  {
    id: "f5",
    question: "Что происходит с имуществом должника при реализации?",
    options: [
      "Всё изымается без исключений",
      "Единственное жильё защищено, остальное — в конкурсную массу",
      "Должник сам выбирает, что продать",
      "Имущество замораживается на 5 лет",
    ],
    correct_index: 1,
    explanation: "Единственное жильё (если не в ипотеке) исключается из конкурсной массы (ст. 446 ГПК + ст. 213.25 ФЗ-127).",
  },
];

/* ── Fallback mini-case ──────────────────────────────────────── */
const FALLBACK_CASE: MiniCase = {
  id: "fallback-1",
  narrative: "Клиент Иванов И.П. обратился с долгом 2.3 млн ₽. Имеет единственную квартиру и автомобиль стоимостью 800 000 ₽. Работает, зарплата 45 000 ₽. Просит подать на банкротство. Какую стратегию предложить?",
  choices: [
    { text: "Сразу реализация имущества — быстрое списание долгов", consequence: "Рискованно: суд может утвердить план реструктуризации при наличии дохода. Автомобиль будет реализован.", is_best: false },
    { text: "Реструктуризация долгов с планом погашения на 3 года", consequence: "Оптимально: при зарплате 45 000 ₽ суд может утвердить план. Автомобиль сохраняется.", is_best: true },
    { text: "Внесудебное банкротство через МФЦ", consequence: "Невозможно: долг превышает 1 млн ₽, а у должника есть доход. Не подходит под условия внесудебного банкротства.", is_best: false },
  ],
};

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [waitingClient, setWaitingClient] = useState<{
    full_name: string;
    age: number;
    city: string;
    archetype_code: string;
    difficulty: number;
    trust_level: number;
    total_debt: number;
    scenario_id: string;
    lead_source: string;
    gender: string;
  } | null>(null);
  const [waitingClientLoaded, setWaitingClientLoaded] = useState(false);

  /* ── Learning path progress from API ───────────────────────── */
  const [lpData, setLpData] = useState<LearningPathProgress | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [skills, setSkills] = useState<Record<string, number> | null>(null);

  /* ── Drill state ────────────────────────────────────────────── */
  const [expandedDrill, setExpandedDrill] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizCurrent, setQuizCurrent] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [miniCase, setMiniCase] = useState<MiniCase | null>(null);
  const [caseChoice, setCaseChoice] = useState<number | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [drillsCompleted, setDrillsCompleted] = useState<Set<string>>(new Set());

  const fetchData = useCallback(() => {
    if (!user) return;

    // Fetch learning path progress
    api.get<LearningPathProgress>("/learning-path/progress")
      .then((data) => {
        setLpData(data);
      })
      .catch((err) => { logger.error("Failed to load learning path:", err); })
      .finally(() => setLoading(false));

    // Fetch waiting client
    api.get<{ client: typeof waitingClient }>("/home/waiting-client")
      .then((data) => setWaitingClient(data.client))
      .catch(() => {})
      .finally(() => setWaitingClientLoaded(true));

    // Fetch recommendations
    api.get<{ recommendations: Recommendation[] }>("/learning-path/recommendations")
      .then((data) => setRecommendations(data.recommendations || []))
      .catch(() => {});

    // Fetch skills for radar
    if (user.id) {
      api.get<{ skills: Record<string, number> }>(`/progress/${user.id}/skills`)
        .then((data) => {
          if (data.skills) setSkills(data.skills);
          else if (data && typeof data === "object") setSkills(data as unknown as Record<string, number>);
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, 60_000);
    return () => clearInterval(id);
  }, [user, fetchData]);

  const firstName = user?.full_name?.split(" ")[0] || "Пользователь";
  const pathProgress = lpData?.progress || { knowledge: 0, tests: 0, cases: 0, exams: 0, practice: 0 };
  const stats = lpData?.stats || null;
  const streak = lpData?.streak || { current: 0, best: 0, today_completed: false };
  const overallPercent = lpData?.overall_percent || 0;

  /* ── Active learning stage ──────────────────────────────────── */
  const activeStageIndex = LEARNING_STAGES.findIndex((s) => (pathProgress[s.key] ?? 0) < 100);
  const activeStage = activeStageIndex >= 0 ? activeStageIndex : LEARNING_STAGES.length - 1;

  /* ── Week activity from streak ─────────────────────────────── */
  const getWeekActivity = (): boolean[] => {
    // Heuristic: mark today if today_completed, and previous days based on streak
    const result = [false, false, false, false, false, false, false];
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    if (streak.today_completed) {
      result[mondayIdx] = true;
    }
    // Mark previous streak days
    for (let i = 1; i < Math.min(streak.current, 7); i++) {
      const idx = mondayIdx - i;
      if (idx >= 0) result[idx] = true;
    }
    return result;
  };

  /* ── Quick start (incoming call) ────────────────────────────── */
  const quickStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      if (waitingClient) {
        try {
          const session = await api.post("/home/start", {});
          if (session?.id) {
            router.push(`/training/${session.id}`);
            setTimeout(() => setStarting(false), 1000);
            return;
          }
        } catch (err: unknown) {
          const status = (err as { status?: number })?.status;
          if (status === 409) {
            try {
              const { client } = await api.get<{ client: typeof waitingClient }>("/home/waiting-client");
              setWaitingClient(client);
            } catch { /* empty */ }
            setStarting(false);
            return;
          }
          throw err;
        }
      }
      const scenariosData = await api.get("/scenarios/");
      const scenarios: { id: string }[] = Array.isArray(scenariosData) ? scenariosData : [];
      if (!scenarios.length) { setStarting(false); return; }
      const scenarioId = scenarios[Math.floor(Math.random() * scenarios.length)].id;
      const session = await api.post("/training/sessions", {
        scenario_id: scenarioId,
        mode: "chat",
        runtime_type: "training_simulation",
      });
      if (!session?.id) throw new Error("Invalid session response");
      router.push(`/training/${session.id}`);
      setTimeout(() => setStarting(false), 1000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.detail?.code === "profile_incomplete") {
        router.push("/home");
        return;
      }
      useNotificationStore.getState().addToast({
        title: "Ошибка запуска",
        body: "Не удалось начать тренировку. Попробуйте ещё раз.",
        type: "error",
      });
      logger.error("Quick start failed:", err);
      setStarting(false);
    }
  };

  /* ── Quiz drill handlers ────────────────────────────────────── */
  const startQuiz = async () => {
    setExpandedDrill("quiz");
    setQuizLoading(true);
    setQuizCurrent(0);
    setQuizAnswers([]);
    setQuizFinished(false);
    try {
      const resp = await api.post<{ questions?: QuizQuestion[]; session_id?: string }>("/knowledge/sessions", {
        mode: "themed",
        max_questions: 5,
        choices_format: true,
        category: "random",
      });
      if (resp.questions && resp.questions.length > 0) {
        setQuizQuestions(resp.questions);
      } else {
        setQuizQuestions(FALLBACK_QUESTIONS);
      }
    } catch {
      setQuizQuestions(FALLBACK_QUESTIONS);
    } finally {
      setQuizLoading(false);
    }
  };

  const answerQuiz = (optionIndex: number) => {
    const newAnswers = [...quizAnswers];
    newAnswers[quizCurrent] = optionIndex;
    setQuizAnswers(newAnswers);
    setTimeout(() => {
      if (quizCurrent < quizQuestions.length - 1) {
        setQuizCurrent(quizCurrent + 1);
      } else {
        setQuizFinished(true);
        setDrillsCompleted((prev) => new Set([...prev, "quiz"]));
      }
    }, 1200);
  };

  const quizScore = quizAnswers.filter((a, i) => a === quizQuestions[i]?.correct_index).length;

  /* ── Mini-case drill handlers ───────────────────────────────── */
  const startCase = async () => {
    setExpandedDrill("case");
    setCaseLoading(true);
    setCaseChoice(null);
    try {
      const resp = await api.get<MiniCase>("/cases/case-1");
      if (resp && resp.narrative) {
        setMiniCase(resp);
      } else {
        setMiniCase(FALLBACK_CASE);
      }
    } catch {
      setMiniCase(FALLBACK_CASE);
    } finally {
      setCaseLoading(false);
    }
  };

  /* ── Radar chart helpers ───────────────────────────────────── */
  const renderRadar = (skillsData: Record<string, number>) => {
    const axes = SKILL_KEYS;
    const n = axes.length;
    const cx = 100, cy = 100, maxR = 75;
    const angleStep = (2 * Math.PI) / n;

    const getPoint = (index: number, value: number) => {
      const angle = index * angleStep - Math.PI / 2;
      const r = (value / 100) * maxR;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };

    const gridLevels = [20, 40, 60, 80];
    const points = axes.map((key, i) => getPoint(i, skillsData[key] || 0));
    const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

    return (
      <svg viewBox="0 0 200 200" className="w-full max-w-[280px]">
        <defs>
          <filter id="radarGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor="#2563EB" floodOpacity="0.4" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Grid circles */}
        {gridLevels.map((r) => (
          <circle key={r} cx={cx} cy={cy} r={(r / 100) * maxR} fill="none" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.08" />
        ))}
        {/* Axis lines */}
        {axes.map((_, i) => {
          const end = getPoint(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="var(--border-color)" strokeWidth="0.5" opacity="0.08" />;
        })}
        {/* Data polygon */}
        <polygon points={polygon} fill="rgba(37, 99, 235, 0.12)" stroke="#2563EB" strokeWidth="1.5" filter="url(#radarGlow)" />
        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="none" stroke="#2563EB" strokeWidth="0.5" opacity="0.3">
              <animate attributeName="r" values="3;7;3" dur="3s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
            </circle>
            <circle cx={p.x} cy={p.y} r="3" fill="#2563EB" filter="url(#radarGlow)" />
          </g>
        ))}
        {/* Labels */}
        {axes.map((key, i) => {
          const lp = getPoint(i, 115);
          return (
            <text key={key} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fill="var(--text-muted)" fontSize="6.5" fontWeight="600">
              {SKILL_LABELS[key]}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <AuthLayout>
      <div className="min-h-screen relative overflow-hidden" style={{ background: "var(--bg-primary)" }}>

        {/* ── Ambient background ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute rounded-full" style={{ top: "-200px", right: "-150px", width: "900px", height: "900px", opacity: 0.07, background: "radial-gradient(circle, #2563EB 0%, transparent 65%)" }} />
          <div className="absolute rounded-full" style={{ top: "40%", left: "-250px", width: "850px", height: "850px", opacity: 0.06, background: "radial-gradient(circle, #8B5CF6 0%, transparent 65%)" }} />
          <div className="absolute rounded-full" style={{ bottom: "-300px", left: "30%", width: "800px", height: "800px", opacity: 0.04, background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }} />
          <div className="absolute inset-0" style={{ backgroundImage: NOISE_SVG, backgroundRepeat: "repeat", opacity: 0.025, mixBlendMode: "overlay" }} />
        </div>

        <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 py-8 sm:py-12">

          {/* ═══════════════ 1. GREETING + LEARNING PATH ═══════════════ */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: PREMIUM_EASE }} className="mb-8">
            {/* Greeting */}
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3, ease: PREMIUM_EASE }} className="flex items-center gap-3 mb-4">
              <div style={{ width: "24px", height: "1px", background: "linear-gradient(90deg, #2563EB, transparent)" }} />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] m-0" style={{ color: "var(--text-muted)" }}>
                {getTimeGreeting()}
              </p>
            </motion.div>

            <div className="flex items-end justify-between gap-4 mb-2">
              <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: "0.95", letterSpacing: "-0.03em", fontWeight: 900, background: "linear-gradient(135deg, #F5F5F5 0%, #A1A1AA 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: 0 }}>
                {firstName}
              </h1>
              {!loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 pb-2">
                  <span className="text-3xl font-black" style={{ color: "#2563EB" }}>{overallPercent}%</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>общий<br />прогресс</span>
                </motion.div>
              )}
            </div>

            {/* Learning Path Progress Bar */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5, ease: PREMIUM_EASE }} className="mt-6 rounded-2xl p-5 sm:p-6" style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(37, 99, 235, 0.15)", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.03)" }}>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={14} style={{ color: "#2563EB" }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>Путь обучения</span>
              </div>
              <div className="flex items-center justify-between relative">
                {/* Connection line */}
                <div className="absolute top-5 left-[10%] right-[10%] h-[2px]" style={{ background: "rgba(255,255,255,0.06)" }} />
                {LEARNING_STAGES.map((stage, i) => {
                  const progress = pathProgress[stage.key] ?? 0;
                  const isActive = i === activeStage;
                  const isComplete = progress >= 100;
                  return (
                    <Link key={stage.key} href={stage.href} className="no-underline flex flex-col items-center relative z-10" style={{ flex: 1 }}>
                      <motion.div
                        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg mb-2"
                        style={{
                          background: isComplete ? "linear-gradient(135deg, #10B981, #059669)" : isActive ? "linear-gradient(135deg, #2563EB, #8B5CF6)" : "rgba(255,255,255,0.05)",
                          border: isActive ? "2px solid rgba(37, 99, 235, 0.6)" : isComplete ? "2px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255,255,255,0.08)",
                          boxShadow: isActive ? "0 0 20px rgba(37, 99, 235, 0.3)" : isComplete ? "0 0 12px rgba(16, 185, 129, 0.2)" : "none",
                        }}
                      >
                        {stage.icon}
                      </motion.div>
                      <span className="text-[10px] font-semibold text-center" style={{ color: isActive ? "#2563EB" : isComplete ? "#10B981" : "var(--text-muted)" }}>
                        {stage.label}
                      </span>
                      <span className="text-[9px] font-bold mt-0.5" style={{ color: isActive ? "#2563EB" : "var(--text-muted)" }}>
                        {progress}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>

          {/* ═══════════════ 2. INCOMING CALL ═══════════════ */}
          {waitingClient && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: PREMIUM_EASE }}
              className="relative rounded-2xl p-6 sm:p-8 mb-8 overflow-hidden group"
              style={{ background: "linear-gradient(135deg, #059669 0%, #047857 50%, #065F46 100%)", boxShadow: "0 12px 40px rgba(5, 150, 105, 0.3), inset 0 1px 0 rgba(255,255,255,0.12)" }}
            >
              <div className="absolute inset-0 rounded-2xl" style={{ padding: "2px", background: "conic-gradient(from var(--call-angle, 0deg), transparent 0%, rgba(255,255,255,0.3) 25%, transparent 50%, rgba(16,185,129,0.5) 75%, transparent 100%)", mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", maskComposite: "exclude", WebkitMaskComposite: "xor", animation: "rotateCallBorder 4s linear infinite" }} />
              <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)" }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                    <span className="absolute inline-flex h-full w-full rounded-xl" style={{ background: "rgba(255,255,255,0.25)", animation: "pingProminent 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" }} />
                    <Phone size={18} strokeWidth={2.5} className="relative text-white" />
                  </span>
                  <span className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em]">Входящий звонок</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white mb-3 tracking-tight">{waitingClient.full_name}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 text-white backdrop-blur-sm border border-white/10">{waitingClient.city}</span>
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white/70 border border-white/5">Долг: {(waitingClient.total_debt / 1000).toFixed(0)}K ₽</span>
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white/70 border border-white/5">{"★".repeat(Math.min(waitingClient.difficulty, 5))}</span>
                    </div>
                  </div>
                  <button
                    onClick={quickStart}
                    disabled={starting}
                    className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-sm font-black transition-all duration-300 shrink-0"
                    style={{ background: "rgba(255,255,255,0.95)", color: "#047857", boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,1)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.25)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,1)"; }}
                  >
                    {starting ? <Loader2 size={16} className="animate-spin" /> : <><Phone size={16} /> Ответить</>}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════ 3. STATS ROW (REAL DATA) ═══════════════ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08, ease: PREMIUM_EASE }} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {!loading && stats ? (
              <>
                <StatCard label="Сессий" value={String(stats.total_sessions)} icon={<BarChart3 size={16} />} color="#2563EB" idx={0} />
                <StatCard label="Ср. балл" value={String(stats.average_score)} icon={<Trophy size={16} />} color={scoreColor(stats.average_score)} idx={1} />
                <StatCard label="Лучший" value={String(stats.best_score)} icon={<Trophy size={16} />} color={scoreColor(stats.best_score)} idx={2} />
                <StatCard label="За неделю" value={String(stats.this_week_sessions)} icon={<Clock size={16} />} color="#8B5CF6" idx={3} />
              </>
            ) : loading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    <div className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "var(--bg-tertiary)" }} />
                    <div className="h-3 w-12 rounded animate-pulse" style={{ background: "var(--bg-tertiary)" }} />
                  </div>
                ))}
              </>
            ) : null}
          </motion.div>

          {/* ═══════════════ 4. DAILY DRILL ═══════════════ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12, ease: PREMIUM_EASE }} className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} style={{ color: "#F59E0B" }} />
              <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Ежедневная разминка</h2>
              {drillsCompleted.size > 0 && (
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>{drillsCompleted.size}/3</span>
              )}
            </div>

            <LayoutGroup>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {expandedDrill === null ? (
                    <>
                      {/* Three drill cards */}
                      <DrillCard
                        layoutId="drill-quiz"
                        icon="⚡"
                        title="Быстрый тест"
                        desc="5 вопросов за 3 минуты"
                        completed={drillsCompleted.has("quiz")}
                        borderColor="rgba(37, 99, 235, 0.15)"
                        hoverGradient="linear-gradient(135deg, rgba(37,99,235,0.08), rgba(139,92,246,0.04))"
                        accentColor="#2563EB"
                        onClick={startQuiz}
                      />
                      <DrillCard
                        layoutId="drill-case"
                        icon="\u{1f4cb}"
                        title="Мини-кейс"
                        desc="Один юридический сценарий"
                        completed={drillsCompleted.has("case")}
                        borderColor="rgba(139, 92, 246, 0.15)"
                        hoverGradient="linear-gradient(135deg, rgba(139,92,246,0.08), rgba(37,99,235,0.04))"
                        accentColor="#8B5CF6"
                        onClick={startCase}
                      />
                      <Link href="/training" className="no-underline">
                        <motion.div layout layoutId="drill-call" className="rounded-2xl p-5 relative overflow-hidden group h-full" style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(16, 185, 129, 0.15)", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)", transition: "all 0.3s ease" }} whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(37,99,235,0.04))" }} />
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-lg">{"\u{1f4de}"}</span>
                              <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                            </div>
                            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Тренировочный звонок</h3>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>AI-клиент средней сложности</p>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #10B981, transparent 80%)" }} />
                        </motion.div>
                      </Link>
                    </>
                  ) : expandedDrill === "quiz" ? (
                    <ExpandedQuiz
                      quizLoading={quizLoading}
                      quizFinished={quizFinished}
                      quizQuestions={quizQuestions}
                      quizCurrent={quizCurrent}
                      quizAnswers={quizAnswers}
                      quizScore={quizScore}
                      answerQuiz={answerQuiz}
                      onCollapse={() => setExpandedDrill(null)}
                    />
                  ) : expandedDrill === "case" ? (
                    <ExpandedCase
                      caseLoading={caseLoading}
                      miniCase={miniCase}
                      caseChoice={caseChoice}
                      onChoose={(i) => { setCaseChoice(i); setDrillsCompleted((prev) => new Set([...prev, "case"])); }}
                      onCollapse={() => setExpandedDrill(null)}
                    />
                  ) : null}
                </AnimatePresence>
              </div>
            </LayoutGroup>
          </motion.div>

          {/* ═══════════════ 5. STREAK ═══════════════ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.16, ease: PREMIUM_EASE }} className="mb-8">
            <div className="rounded-2xl p-5 sm:p-6" style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(245, 158, 11, 0.12)", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame size={16} style={{ color: "#F59E0B" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Серия: {streak.current} {streak.current === 1 ? "день" : streak.current >= 2 && streak.current <= 4 ? "дня" : "дней"}
                  </span>
                </div>
                <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  Рекорд: {streak.best}
                </span>
              </div>
              <div className="flex gap-2">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => {
                  const weekActivity = getWeekActivity();
                  const isActive = weekActivity[i];
                  return (
                    <div key={day} className="flex-1 text-center">
                      <motion.div initial={false} animate={isActive ? { scale: [1, 1.1, 1] } : {}} transition={{ duration: 0.4 }} className="h-8 rounded-lg mb-1 flex items-center justify-center" style={{ background: isActive ? "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))" : "rgba(255,255,255,0.03)", border: `1px solid ${isActive ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.06)"}`, boxShadow: isActive ? "0 0 12px rgba(245,158,11,0.2)" : "none" }}>
                        {isActive && <CheckCircle2 size={12} style={{ color: "#F59E0B" }} />}
                      </motion.div>
                      <span className="text-[9px] font-semibold" style={{ color: isActive ? "#F59E0B" : "var(--text-muted)" }}>{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* ═══════════════ 6. RECOMMENDATIONS (REAL DATA) ═══════════════ */}
          {recommendations.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18, ease: PREMIUM_EASE }} className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={14} style={{ color: "#8B5CF6" }} />
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Рекомендации</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendations.slice(0, 5).map((rec, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 + i * 0.05, duration: 0.3, ease: PREMIUM_EASE }}
                    className="group rounded-xl p-5 cursor-pointer relative overflow-hidden"
                    style={{ background: "rgba(15, 15, 30, 0.95)", border: `1px solid ${rec.type === "weak_spot" ? "rgba(239, 68, 68, 0.15)" : "rgba(37, 99, 235, 0.15)"}`, boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)", transition: "all 0.3s ease" }}
                    onClick={() => router.push(rec.action_url)}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px) scale(1.02)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0) scale(1)"; }}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: rec.type === "weak_spot" ? "linear-gradient(135deg, rgba(239,68,68,0.06), transparent)" : "linear-gradient(135deg, rgba(37,99,235,0.06), transparent)" }} />
                    <div className="relative z-10">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide mb-2" style={{ background: rec.type === "weak_spot" ? "rgba(239,68,68,0.12)" : "rgba(37,99,235,0.12)", color: rec.type === "weak_spot" ? "#EF4444" : "#2563EB" }}>
                        {rec.type === "weak_spot" ? "Слабое место" : "Следующий шаг"}
                      </span>
                      <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>{rec.title}</h3>
                      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{rec.description}</p>
                      <span className="text-xs font-bold flex items-center gap-1" style={{ color: rec.type === "weak_spot" ? "#EF4444" : "#2563EB" }}>
                        {rec.action_label} <ArrowRight size={12} />
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══════════════ 7. COMPETENCY RADAR (10 AXES, REAL DATA) ═══════════════ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2, ease: PREMIUM_EASE }} className="mb-8">
            <div className="rounded-2xl p-5 sm:p-6" style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(37, 99, 235, 0.12)", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Target size={14} style={{ color: "#2563EB" }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Карта компетенций</h3>
              </div>
              {skills && Object.keys(skills).length > 0 ? (
                <div className="flex items-center justify-center">
                  {renderRadar(skills)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-3xl mb-3 opacity-50">{"\u{1f3af}"}</div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Пройдите 3 тренировки для калибровки</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{stats ? `${stats.total_sessions}/3 выполнено` : "0/3 выполнено"}</p>
                </div>
              )}
              <p className="text-xs text-center mt-3" style={{ color: "var(--text-muted)" }}>Данные обновляются после каждой сессии</p>
            </div>
          </motion.div>

        </div>

        {/* ── Global keyframe animations ── */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pingProminent {
            0% { transform: scale(1); opacity: 0.35; }
            75%, 100% { transform: scale(2); opacity: 0; }
          }
          @keyframes pulseRadial {
            0%, 100% { transform: scale(1); opacity: 0.15; }
            50% { transform: scale(1.4); opacity: 0.3; }
          }
          @property --call-angle {
            syntax: '<angle>';
            initial-value: 0deg;
            inherits: false;
          }
          @keyframes rotateCallBorder {
            to { --call-angle: 360deg; }
          }
        `}} />
      </div>
    </AuthLayout>
  );
}


/* ── Stat Card ─────────────────────────────────────────────────── */

function StatCard({ label, value, color, icon, idx }: { label: string; value: string; color: string; icon: React.ReactNode; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 + idx * 0.05, ease: PREMIUM_EASE }}
      className="group rounded-2xl p-4 sm:p-5 relative overflow-hidden"
      style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(255, 255, 255, 0.06)", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)", transition: "all 0.3s ease" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 40%, transparent)`; e.currentTarget.style.boxShadow = `0 0 20px color-mix(in srgb, ${color} 10%, transparent), 0 8px 32px rgba(0, 0, 0, 0.3)`; e.currentTarget.style.transform = "translateY(-4px) scale(1.02)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.3)"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}
    >
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${color} 15%, transparent) 0%, transparent 70%)` }} />
      <div className="relative z-10">
        <div className="relative inline-block">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
            {icon}
          </div>
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4], boxShadow: [`0 0 4px ${color}`, `0 0 12px ${color}`, `0 0 4px ${color}`] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", top: "0px", right: "-2px", width: "6px", height: "6px", borderRadius: "50%", background: color }}
          />
        </div>
        <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight" style={{ color: "var(--text-primary)" }}>{value}</div>
        <div className="text-[10px] font-bold mt-1 uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>{label}</div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, transparent 80%)` }} />
    </motion.div>
  );
}


/* ── Drill Card ────────────────────────────────────────────────── */

function DrillCard({ layoutId, icon, title, desc, completed, borderColor, hoverGradient, accentColor, onClick }: {
  layoutId: string;
  icon: string;
  title: string;
  desc: string;
  completed: boolean;
  borderColor: string;
  hoverGradient: string;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <motion.div
      layout
      layoutId={layoutId}
      className="rounded-2xl p-5 cursor-pointer relative overflow-hidden group"
      style={{ background: "rgba(15, 15, 30, 0.95)", border: completed ? "1px solid rgba(16, 185, 129, 0.3)" : `1px solid ${borderColor}`, boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)", transition: "all 0.3s ease" }}
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: hoverGradient }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg">{icon}</span>
          {completed && <CheckCircle2 size={16} style={{ color: "#10B981" }} />}
        </div>
        <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>{title}</h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent 80%)` }} />
    </motion.div>
  );
}


/* ── Expanded Quiz ─────────────────────────────────────────────── */

function ExpandedQuiz({ quizLoading, quizFinished, quizQuestions, quizCurrent, quizAnswers, quizScore, answerQuiz, onCollapse }: {
  quizLoading: boolean;
  quizFinished: boolean;
  quizQuestions: QuizQuestion[];
  quizCurrent: number;
  quizAnswers: (number | null)[];
  quizScore: number;
  answerQuiz: (i: number) => void;
  onCollapse: () => void;
}) {
  return (
    <motion.div
      layout
      layoutId="drill-quiz"
      key="drill-quiz-expanded"
      className="col-span-1 lg:col-span-3 rounded-2xl p-6 relative overflow-hidden"
      style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(37, 99, 235, 0.25)", boxShadow: "0 8px 40px rgba(37, 99, 235, 0.1), 0 4px 24px rgba(0, 0, 0, 0.3)" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-lg">{"⚡"}</span>
          <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Ежедневный тест</h3>
        </div>
        <button onClick={onCollapse} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}>
          Свернуть
        </button>
      </div>

      {quizLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: "#2563EB" }} />
        </div>
      ) : quizFinished ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
          <div className="text-4xl mb-4">{quizScore >= 4 ? "\u{1f389}" : quizScore >= 3 ? "\u{1f44d}" : "\u{1f4aa}"}</div>
          <h4 className="text-xl font-black mb-2" style={{ color: "var(--text-primary)" }}>{quizScore}/{quizQuestions.length} правильно</h4>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{quizScore >= 4 ? "Отличный результат!" : quizScore >= 3 ? "Хороший результат!" : "Есть над чем поработать"}</p>
          <button onClick={onCollapse} className="px-6 py-2.5 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #2563EB, #8B5CF6)", color: "white" }}>Готово</button>
        </motion.div>
      ) : quizQuestions.length > 0 ? (
        <div>
          {/* Progress bar */}
          <div className="flex gap-1.5 mb-6">
            {quizQuestions.map((_, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300" style={{ background: i < quizCurrent ? (quizAnswers[i] === quizQuestions[i]?.correct_index ? "#10B981" : "#EF4444") : i === quizCurrent ? "#2563EB" : "rgba(255,255,255,0.08)" }} />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={quizCurrent} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <p className="text-sm font-semibold mb-5 leading-relaxed" style={{ color: "var(--text-primary)" }}>{quizQuestions[quizCurrent]?.question}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quizQuestions[quizCurrent]?.options.map((opt, i) => {
                  const answered = quizAnswers[quizCurrent] !== undefined && quizAnswers[quizCurrent] !== null;
                  const isCorrect = i === quizQuestions[quizCurrent]?.correct_index;
                  const isSelected = quizAnswers[quizCurrent] === i;
                  return (
                    <button key={i} onClick={() => !answered && answerQuiz(i)} disabled={answered} className="text-left p-4 rounded-xl text-sm font-medium transition-all duration-300" style={{ background: answered ? (isCorrect ? "rgba(16, 185, 129, 0.12)" : isSelected ? "rgba(239, 68, 68, 0.12)" : "rgba(255,255,255,0.03)") : "rgba(255,255,255,0.03)", border: answered ? (isCorrect ? "1px solid rgba(16, 185, 129, 0.4)" : isSelected ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255,255,255,0.06)") : "1px solid rgba(255,255,255,0.08)", color: "var(--text-primary)", cursor: answered ? "default" : "pointer" }}>
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: answered && isCorrect ? "rgba(16,185,129,0.2)" : answered && isSelected ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)", color: answered && isCorrect ? "#10B981" : answered && isSelected ? "#EF4444" : "var(--text-muted)" }}>
                          {answered && isCorrect ? <CheckCircle2 size={14} /> : answered && isSelected ? <XCircle size={14} /> : String.fromCharCode(65 + i)}
                        </span>
                        <span>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {quizAnswers[quizCurrent] !== undefined && quizAnswers[quizCurrent] !== null && quizQuestions[quizCurrent]?.explanation && (
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-xs p-3 rounded-lg leading-relaxed" style={{ background: "rgba(37, 99, 235, 0.06)", color: "var(--text-secondary)", border: "1px solid rgba(37,99,235,0.1)" }}>
                  {quizQuestions[quizCurrent]?.explanation}
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}
    </motion.div>
  );
}


/* ── Expanded Case ─────────────────────────────────────────────── */

function ExpandedCase({ caseLoading, miniCase, caseChoice, onChoose, onCollapse }: {
  caseLoading: boolean;
  miniCase: MiniCase | null;
  caseChoice: number | null;
  onChoose: (i: number) => void;
  onCollapse: () => void;
}) {
  return (
    <motion.div
      layout
      layoutId="drill-case"
      key="drill-case-expanded"
      className="col-span-1 lg:col-span-3 rounded-2xl p-6 relative overflow-hidden"
      style={{ background: "rgba(15, 15, 30, 0.95)", border: "1px solid rgba(139, 92, 246, 0.25)", boxShadow: "0 8px 40px rgba(139, 92, 246, 0.1), 0 4px 24px rgba(0, 0, 0, 0.3)" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-lg">{"\u{1f4cb}"}</span>
          <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Мини-кейс</h3>
        </div>
        <button onClick={onCollapse} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}>
          Свернуть
        </button>
      </div>

      {caseLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: "#8B5CF6" }} />
        </div>
      ) : miniCase ? (
        <div>
          <p className="text-sm leading-relaxed mb-6 p-4 rounded-xl" style={{ color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {miniCase.narrative}
          </p>
          <div className="space-y-3">
            {miniCase.choices.map((choice, i) => {
              const isChosen = caseChoice === i;
              const showResult = caseChoice !== null;
              return (
                <motion.button
                  key={i}
                  onClick={() => { if (caseChoice === null) onChoose(i); }}
                  disabled={showResult}
                  className="w-full text-left p-4 rounded-xl transition-all duration-300"
                  style={{ background: showResult ? (choice.is_best ? "rgba(16, 185, 129, 0.08)" : isChosen ? "rgba(239, 68, 68, 0.08)" : "rgba(255,255,255,0.02)") : "rgba(255,255,255,0.03)", border: showResult ? (choice.is_best ? "1px solid rgba(16, 185, 129, 0.3)" : isChosen ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255,255,255,0.05)") : "1px solid rgba(255,255,255,0.08)", cursor: showResult ? "default" : "pointer" }}
                  whileHover={!showResult ? { scale: 1.01 } : {}}
                >
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>{choice.text}</p>
                  {showResult && (isChosen || choice.is_best) && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="text-xs mt-2 leading-relaxed" style={{ color: choice.is_best ? "#10B981" : "#EF4444" }}>
                      {choice.consequence}
                    </motion.p>
                  )}
                </motion.button>
              );
            })}
          </div>
          {caseChoice !== null && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-center justify-between">
              <Link href={`/cases/${miniCase.id}`} className="text-xs font-bold no-underline flex items-center gap-1" style={{ color: "#8B5CF6" }}>
                Пройти полный кейс <ArrowRight size={12} />
              </Link>
              <button onClick={onCollapse} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6" }}>Готово</button>
            </motion.div>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}
