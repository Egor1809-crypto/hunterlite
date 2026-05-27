"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Award,
  FileText,
  Star,
  Shield,
  GraduationCap,
  Timer,
  RotateCcw,
  Loader2,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;
const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PASS_THRESHOLD = 88;

interface ExamQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctId: string;
  explanation: string;
  article?: string;
}

interface ExamDef {
  id: string;
  title: string;
  subtitle: string;
  questionCount: number;
  timeLimitMinutes: number;
  color: string;
  categories: string[];
}

const EXAMS: Record<string, ExamDef> = {
  "exam-1": { id: "exam-1", title: "Основы банкротства", subtitle: "Модуль 1: уровни 1-30", questionCount: 30, timeLimitMinutes: 45, color: "#3B82F6", categories: ["eligibility", "procedure", "property"] },
  "exam-2": { id: "exam-2", title: "Финансы и кредиторы", subtitle: "Модуль 2: уровни 31-60", questionCount: 30, timeLimitMinutes: 45, color: "#8B5CF6", categories: ["costs", "creditors", "consequences"] },
  "exam-3": { id: "exam-3", title: "Документы и суд", subtitle: "Модуль 3: уровни 61-90", questionCount: 35, timeLimitMinutes: 50, color: "#F59E0B", categories: ["documents", "court", "timeline"] },
  "exam-4": { id: "exam-4", title: "Права и защита", subtitle: "Модуль 4: уровни 91-100", questionCount: 35, timeLimitMinutes: 50, color: "#10B981", categories: ["rights"] },
  "exam-5": { id: "exam-5", title: "Финальная аттестация", subtitle: "Все модули + симуляция звонка", questionCount: 50, timeLimitMinutes: 90, color: "#EF4444", categories: ["eligibility", "procedure", "property", "costs", "creditors", "consequences", "documents", "court", "timeline", "rights"] },
};

function generateQuestions(exam: ExamDef): ExamQuestion[] {
  const questionBanks: Record<string, ExamQuestion[]> = {
    eligibility: [
      { id: "e1", text: "Какой минимальный размер задолженности гражданина для подачи заявления о банкротстве?", options: [{ id: "a", text: "300 000 руб." }, { id: "b", text: "500 000 руб." }, { id: "c", text: "1 000 000 руб." }, { id: "d", text: "Нет минимального порога" }], correctId: "b", explanation: "Согласно ст. 213.3 ФЗ-127, заявление о банкротстве гражданина принимается при задолженности не менее 500 000 руб.", article: "ст. 213.3 ФЗ-127" },
      { id: "e2", text: "Кто может подать заявление о банкротстве юридического лица?", options: [{ id: "a", text: "Только сам должник" }, { id: "b", text: "Только кредиторы" }, { id: "c", text: "Должник, кредиторы или уполномоченный орган" }, { id: "d", text: "Только арбитражный суд" }], correctId: "c", explanation: "Ст. 7 ФЗ-127 предусматривает право подачи заявления должником, конкурсными кредиторами и уполномоченными органами.", article: "ст. 7 ФЗ-127" },
      { id: "e3", text: "Через сколько дней просрочки возникает обязанность должника-юрлица подать на банкротство?", options: [{ id: "a", text: "30 дней" }, { id: "b", text: "60 дней" }, { id: "c", text: "90 дней" }, { id: "d", text: "1 месяц с момента возникновения признаков" }], correctId: "d", explanation: "Ст. 9 ФЗ-127: руководитель должника обязан подать заявление в течение месяца с момента возникновения обстоятельств, указанных в п. 1 ст. 9.", article: "ст. 9 ФЗ-127" },
    ],
    procedure: [
      { id: "p1", text: "Какая процедура банкротства вводится первой для юридического лица?", options: [{ id: "a", text: "Конкурсное производство" }, { id: "b", text: "Наблюдение" }, { id: "c", text: "Финансовое оздоровление" }, { id: "d", text: "Внешнее управление" }], correctId: "b", explanation: "Наблюдение — первая процедура банкротства юрлица (глава IV ФЗ-127). Цель — анализ финансового состояния и обеспечение сохранности имущества.", article: "глава IV ФЗ-127" },
      { id: "p2", text: "Максимальный срок конкурсного производства?", options: [{ id: "a", text: "6 месяцев" }, { id: "b", text: "6 месяцев, продлеваемые ещё на 6" }, { id: "c", text: "1 год без продления" }, { id: "d", text: "Не ограничен" }], correctId: "b", explanation: "Ст. 124 ФЗ-127: конкурсное производство вводится на срок до 6 месяцев. Может продлеваться ещё на 6 месяцев.", article: "ст. 124 ФЗ-127" },
      { id: "p3", text: "Какой орган назначает арбитражного управляющего?", options: [{ id: "a", text: "Кредиторы" }, { id: "b", text: "Должник" }, { id: "c", text: "Арбитражный суд" }, { id: "d", text: "СРО арбитражных управляющих" }], correctId: "c", explanation: "Арбитражный суд утверждает арбитражного управляющего по представлению СРО (ст. 45 ФЗ-127).", article: "ст. 45 ФЗ-127" },
    ],
    property: [
      { id: "pr1", text: "Что не включается в конкурсную массу гражданина-банкрота?", options: [{ id: "a", text: "Автомобиль" }, { id: "b", text: "Единственное жильё (не в залоге)" }, { id: "c", text: "Банковские вклады" }, { id: "d", text: "Доли в ООО" }], correctId: "b", explanation: "Ст. 446 ГПК РФ: единственное жильё должника (не являющееся предметом залога) исключается из конкурсной массы.", article: "ст. 446 ГПК РФ" },
      { id: "pr2", text: "Кто проводит оценку имущества должника в конкурсном производстве?", options: [{ id: "a", text: "Конкурсный управляющий" }, { id: "b", text: "Кредиторы" }, { id: "c", text: "Независимый оценщик, привлечённый управляющим" }, { id: "d", text: "Суд" }], correctId: "c", explanation: "Ст. 130 ФЗ-127: для оценки имущества конкурсный управляющий привлекает независимого оценщика.", article: "ст. 130 ФЗ-127" },
    ],
    costs: [
      { id: "c1", text: "Какой размер госпошлины при подаче заявления о банкротстве юрлица?", options: [{ id: "a", text: "300 руб." }, { id: "b", text: "6 000 руб." }, { id: "c", text: "25 000 руб." }, { id: "d", text: "Госпошлина не уплачивается" }], correctId: "b", explanation: "Госпошлина за подачу заявления о признании должника банкротом — 6 000 руб. (ст. 333.21 НК РФ).", article: "ст. 333.21 НК РФ" },
      { id: "c2", text: "Какое минимальное вознаграждение конкурсного управляющего в месяц?", options: [{ id: "a", text: "15 000 руб." }, { id: "b", text: "25 000 руб." }, { id: "c", text: "30 000 руб." }, { id: "d", text: "45 000 руб." }], correctId: "c", explanation: "Ст. 20.6 ФЗ-127: фиксированная сумма вознаграждения конкурсного управляющего — 30 000 руб. в месяц.", article: "ст. 20.6 ФЗ-127" },
    ],
    creditors: [
      { id: "cr1", text: "В какой срок кредитор должен подать заявление о включении в реестр после публикации?", options: [{ id: "a", text: "15 дней" }, { id: "b", text: "30 дней" }, { id: "c", text: "2 месяца" }, { id: "d", text: "6 месяцев" }], correctId: "c", explanation: "Ст. 142 ФЗ-127: реестр требований кредиторов закрывается через 2 месяца с даты публикации о признании банкротом.", article: "ст. 142 ФЗ-127" },
      { id: "cr2", text: "Сколько очередей удовлетворения требований кредиторов в банкротстве?", options: [{ id: "a", text: "2" }, { id: "b", text: "3" }, { id: "c", text: "4" }, { id: "d", text: "5" }], correctId: "b", explanation: "Ст. 134 ФЗ-127 предусматривает 3 очереди: 1) возмещение вреда жизни/здоровью и алименты; 2) расчёты по зарплате; 3) все остальные.", article: "ст. 134 ФЗ-127" },
    ],
    consequences: [
      { id: "co1", text: "На какой срок гражданин-банкрот не может занимать руководящие должности?", options: [{ id: "a", text: "1 год" }, { id: "b", text: "3 года" }, { id: "c", text: "5 лет" }, { id: "d", text: "Ограничений нет" }], correctId: "b", explanation: "Ст. 213.30 ФЗ-127: в течение 3 лет гражданин не вправе занимать должности в органах управления юрлица.", article: "ст. 213.30 ФЗ-127" },
      { id: "co2", text: "Через какой срок гражданин может повторно подать на банкротство?", options: [{ id: "a", text: "3 года" }, { id: "b", text: "5 лет" }, { id: "c", text: "7 лет" }, { id: "d", text: "10 лет" }], correctId: "b", explanation: "Ст. 213.30 ФЗ-127: повторное заявление о банкротстве возможно не ранее чем через 5 лет.", article: "ст. 213.30 ФЗ-127" },
    ],
    documents: [
      { id: "d1", text: "Где публикуются сведения о банкротстве?", options: [{ id: "a", text: "Только в газете «Коммерсантъ»" }, { id: "b", text: "Только в ЕФРСБ" }, { id: "c", text: "В газете «Коммерсантъ» и ЕФРСБ" }, { id: "d", text: "На сайте арбитражного суда" }], correctId: "c", explanation: "Ст. 28 ФЗ-127: сведения публикуются в официальном издании (газета «Коммерсантъ») и в ЕФРСБ.", article: "ст. 28 ФЗ-127" },
    ],
    court: [
      { id: "ct1", text: "Какой срок исковой давности для оспаривания подозрительных сделок по ст. 61.2?", options: [{ id: "a", text: "6 месяцев" }, { id: "b", text: "1 год (п.1) и 3 года (п.2)" }, { id: "c", text: "3 года для всех" }, { id: "d", text: "Не ограничен" }], correctId: "b", explanation: "Ст. 61.2 ФЗ-127: п.1 — сделки в течение 1 года до банкротства; п.2 — сделки в течение 3 лет при причинении вреда.", article: "ст. 61.2 ФЗ-127" },
      { id: "ct2", text: "Что такое КДЛ в контексте банкротства?", options: [{ id: "a", text: "Кредитор должника-ликвидатора" }, { id: "b", text: "Контролирующее должника лицо" }, { id: "c", text: "Комитет долговых лимитов" }, { id: "d", text: "Конкурсный дежурный ликвидатор" }], correctId: "b", explanation: "КДЛ — контролирующее должника лицо (ст. 61.10 ФЗ-127), несёт субсидиарную ответственность.", article: "ст. 61.10 ФЗ-127" },
    ],
    timeline: [
      { id: "t1", text: "Какой максимальный срок процедуры реструктуризации долгов гражданина?", options: [{ id: "a", text: "1 год" }, { id: "b", text: "2 года" }, { id: "c", text: "3 года" }, { id: "d", text: "5 лет" }], correctId: "c", explanation: "Ст. 213.14 ФЗ-127: план реструктуризации утверждается на срок не более 3 лет.", article: "ст. 213.14 ФЗ-127" },
    ],
    rights: [
      { id: "r1", text: "Может ли должник-гражданин выезжать за границу в период банкротства?", options: [{ id: "a", text: "Да, без ограничений" }, { id: "b", text: "Нет, категорически запрещено" }, { id: "c", text: "Только с разрешения суда" }, { id: "d", text: "Суд может ограничить выезд, но не обязан" }], correctId: "d", explanation: "Ст. 213.24 ФЗ-127: суд вправе вынести определение о временном ограничении выезда, но это право, а не обязанность.", article: "ст. 213.24 ФЗ-127" },
      { id: "r2", text: "Какие долги НЕ списываются при банкротстве гражданина?", options: [{ id: "a", text: "Потребительские кредиты" }, { id: "b", text: "Алименты и возмещение вреда здоровью" }, { id: "c", text: "Долги по коммунальным услугам" }, { id: "d", text: "Микрозаймы" }], correctId: "b", explanation: "Ст. 213.28 ФЗ-127: требования о возмещении вреда жизни/здоровью и алименты сохраняют силу после банкротства.", article: "ст. 213.28 ФЗ-127" },
    ],
  };

  const pool: ExamQuestion[] = [];
  for (const cat of exam.categories) {
    const questions = questionBanks[cat];
    if (questions) pool.push(...questions);
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const result: ExamQuestion[] = [];
  const needed = exam.questionCount;

  for (let i = 0; i < needed; i++) {
    if (i < shuffled.length) {
      result.push({ ...shuffled[i], id: `q-${i}` });
    } else {
      const source = shuffled[i % shuffled.length];
      result.push({ ...source, id: `q-${i}` });
    }
  }
  return result;
}

interface ExamState {
  questions: ExamQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  startedAt: number;
  finished: boolean;
  timeExpired: boolean;
}

export default function ExamPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;
  const examDef = EXAMS[examId];

  const [state, setState] = useState<ExamState | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!examDef) return;
    const questions = generateQuestions(examDef);
    setState({
      questions,
      currentIndex: 0,
      answers: {},
      startedAt: Date.now(),
      finished: false,
      timeExpired: false,
    });
    setRemainingSeconds(examDef.timeLimitMinutes * 60);
  }, [examDef?.id]);

  useEffect(() => {
    if (!state || state.finished) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setState((s) => s ? { ...s, finished: true, timeExpired: true } : s);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state?.finished]);

  const currentQuestion = state?.questions[state.currentIndex];
  const totalQuestions = state?.questions.length ?? 0;
  const answeredCount = Object.keys(state?.answers ?? {}).length;

  const handleSelectOption = useCallback((optionId: string) => {
    if (showAnswer) return;
    setSelectedOption(optionId);
  }, [showAnswer]);

  const handleConfirm = useCallback(() => {
    if (!selectedOption || !currentQuestion || !state) return;
    setShowAnswer(true);
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, answers: { ...prev.answers, [currentQuestion.id]: selectedOption } };
    });
  }, [selectedOption, currentQuestion, state]);

  const handleNext = useCallback(() => {
    if (!state) return;
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.questions.length) {
      setState((prev) => prev ? { ...prev, finished: true } : prev);
    } else {
      setState((prev) => prev ? { ...prev, currentIndex: nextIndex } : prev);
    }
    setSelectedOption(null);
    setShowAnswer(false);
  }, [state]);

  const correctCount = useMemo(() => {
    if (!state) return 0;
    return state.questions.filter((q) => state.answers[q.id] === q.correctId).length;
  }, [state]);

  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = scorePercent >= PASS_THRESHOLD;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!examDef) {
    return (
      <AuthLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <div className="text-center">
            <GraduationCap size={48} className="mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Экзамен не найден</h2>
            <button onClick={() => router.push("/exam")} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#8B5CF6", color: "#fff" }}>
              К списку экзаменов
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (!state) {
    return (
      <AuthLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: examDef.color }} />
        </div>
      </AuthLayout>
    );
  }

  if (state.finished) {
    const grade = passed
      ? { label: "Сдан", color: "#22C55E", icon: Award }
      : { label: "Не сдан", color: "#EF4444", icon: XCircle };
    const GradeIcon = grade.icon;

    const saveExamResult = () => {
      try {
        const stored = localStorage.getItem("hunterlite_exam_progress");
        const progress = stored ? JSON.parse(stored) : {};
        const existing = progress[examId];
        if (!existing || scorePercent > (existing.bestScore ?? 0)) {
          progress[examId] = {
            bestScore: scorePercent,
            passed,
            attempts: (existing?.attempts ?? 0) + 1,
            lastAttempt: new Date().toISOString(),
          };
        } else {
          progress[examId].attempts = (existing.attempts ?? 0) + 1;
          progress[examId].lastAttempt = new Date().toISOString();
        }
        localStorage.setItem("hunterlite_exam_progress", JSON.stringify(progress));
        api.put("/training-map/progress", { exams: progress }).catch(() => {});
      } catch {}
    };

    if (typeof window !== "undefined") saveExamResult();

    return (
      <AuthLayout>
        <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <div className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]" style={{ background: `radial-gradient(circle, ${grade.color} 0%, transparent 70%)` }} />
          </div>
          <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

          <div className="relative z-10 max-w-[600px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${grade.color}15`, boxShadow: `0 0 40px ${grade.color}20` }}>
                  <GradeIcon size={36} style={{ color: grade.color }} />
                </div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {state.timeExpired ? "Время вышло" : grade.label}
                </h1>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{examDef.title}</p>
              </div>

              <div className="rounded-2xl p-6 mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="grid grid-cols-3 gap-4 text-center mb-6">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: grade.color }}>{scorePercent}%</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Результат</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{correctCount}/{totalQuestions}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Верных</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{PASS_THRESHOLD}%</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Порог</div>
                  </div>
                </div>

                <div className="w-full h-3 rounded-full relative mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="absolute top-0 h-full w-[1px]" style={{ left: `${PASS_THRESHOLD}%`, background: "rgba(255,255,255,0.3)" }} />
                  <motion.div className="h-full rounded-full" style={{ background: grade.color }} initial={{ width: 0 }} animate={{ width: `${scorePercent}%` }} transition={{ duration: 1, delay: 0.3 }} />
                </div>
                <div className="flex justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <span>0%</span>
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>{PASS_THRESHOLD}% порог</span>
                  <span>100%</span>
                </div>
              </div>

              {!passed && (
                <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
                  <div>
                    <p className="text-xs font-bold mb-0.5" style={{ color: "#EF4444" }}>Не набран проходной балл</p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Необходимо {PASS_THRESHOLD}% для сдачи. Повторите тестовые уровни модуля и попробуйте снова.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => router.push("/exam")} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)" }}>
                  <ArrowLeft size={14} /> Экзамены
                </button>
                {!passed && (
                  <button
                    onClick={() => {
                      const questions = generateQuestions(examDef);
                      setState({ questions, currentIndex: 0, answers: {}, startedAt: Date.now(), finished: false, timeExpired: false });
                      setRemainingSeconds(examDef.timeLimitMinutes * 60);
                      setSelectedOption(null);
                      setShowAnswer(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                    style={{ background: examDef.color, color: "#fff" }}
                  >
                    <RotateCcw size={14} /> Пересдать
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (!currentQuestion) return null;
  const isCorrect = selectedOption === currentQuestion.correctId;

  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]" style={{ background: `radial-gradient(circle, ${examDef.color} 0%, transparent 70%)` }} />
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

        <div className="relative z-10 max-w-[650px] mx-auto px-5 sm:px-8 py-6 sm:py-10">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => router.push("/exam")} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              <ArrowLeft size={14} /> Выйти
            </button>
            <div className="flex items-center gap-3">
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: remainingSeconds < 300 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${remainingSeconds < 300 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
                  color: remainingSeconds < 300 ? "#EF4444" : "var(--text-primary)",
                }}
              >
                <Timer size={12} /> {formatTime(remainingSeconds)}
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{examDef.title}</span>
              <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                {state.currentIndex + 1} / {totalQuestions}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div className="h-full rounded-full" style={{ background: examDef.color }} animate={{ width: `${((state.currentIndex + 1) / totalQuestions) * 100}%` }} transition={{ duration: 0.5 }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Верных: {correctCount} из {answeredCount}
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Порог: {PASS_THRESHOLD}%
              </span>
            </div>
          </div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: PREMIUM_EASE }}
            >
              <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${examDef.color}, transparent 80%)` }} />
                <div className="p-6">
                  <h2 className="text-base font-bold leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {currentQuestion.text}
                  </h2>
                  {currentQuestion.article && (
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${examDef.color}15`, color: examDef.color }}>
                      {currentQuestion.article}
                    </span>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2.5 mb-6">
                {currentQuestion.options.map((opt, i) => {
                  const isSelected = selectedOption === opt.id;
                  const isCorrectOpt = opt.id === currentQuestion.correctId;
                  let borderColor = "rgba(255,255,255,0.06)";
                  let bgColor = "rgba(255,255,255,0.03)";

                  if (showAnswer) {
                    if (isCorrectOpt) {
                      borderColor = "rgba(34,197,94,0.4)";
                      bgColor = "rgba(34,197,94,0.08)";
                    } else if (isSelected && !isCorrectOpt) {
                      borderColor = "rgba(239,68,68,0.4)";
                      bgColor = "rgba(239,68,68,0.08)";
                    }
                  } else if (isSelected) {
                    borderColor = `${examDef.color}60`;
                    bgColor = `${examDef.color}10`;
                  }

                  return (
                    <motion.button
                      key={opt.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      onClick={() => handleSelectOption(opt.id)}
                      disabled={showAnswer}
                      className="w-full text-left rounded-xl p-4 flex items-start gap-3 transition-all"
                      style={{ background: bgColor, border: `1.5px solid ${borderColor}` }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{
                          background: showAnswer && isCorrectOpt ? "rgba(34,197,94,0.15)" : isSelected ? `${examDef.color}20` : "rgba(255,255,255,0.06)",
                          color: showAnswer && isCorrectOpt ? "#22C55E" : isSelected ? examDef.color : "var(--text-muted)",
                        }}
                      >
                        {showAnswer && isCorrectOpt ? <CheckCircle2 size={14} /> : showAnswer && isSelected ? <XCircle size={14} /> : String.fromCharCode(65 + i)}
                      </div>
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{opt.text}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Answer explanation */}
              {showAnswer && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl p-4 mb-6" style={{ background: isCorrect ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${isCorrect ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    {isCorrect ? <CheckCircle2 size={14} style={{ color: "#22C55E" }} /> : <XCircle size={14} style={{ color: "#EF4444" }} />}
                    <span className="text-xs font-bold" style={{ color: isCorrect ? "#22C55E" : "#EF4444" }}>
                      {isCorrect ? "Верно!" : "Неверно"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{currentQuestion.explanation}</p>
                </motion.div>
              )}

              {/* Action button */}
              {!showAnswer ? (
                <button
                  onClick={handleConfirm}
                  disabled={!selectedOption}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: selectedOption ? examDef.color : "rgba(255,255,255,0.06)",
                    color: selectedOption ? "#fff" : "var(--text-muted)",
                    opacity: selectedOption ? 1 : 0.5,
                  }}
                >
                  Ответить <ChevronRight size={16} />
                </button>
              ) : (
                <button onClick={handleNext} className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: examDef.color, color: "#fff" }}>
                  {state.currentIndex + 1 >= totalQuestions ? "Завершить экзамен" : "Следующий вопрос"} <ArrowRight size={16} />
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AuthLayout>
  );
}
