"use client";

/**
 * QuizManyasha — маскот «Маняша» как ведущая теста (Task #7).
 *
 * Заменяет статичную плашку «верно/неверно» (QuizVerdictOverlay) в режиме
 * тематического теста / карты. Маскот ПРИСУТСТВУЕТ ВСЕГДА — даже до ответа,
 * с мягкой подсказкой. Как только приходит вердикт:
 *   1. сразу показывает и ОЗВУЧИВАЕТ короткий вердикт (верно / не совсем);
 *   2. подтягивает развёрнутое объяснение от DeepSeek v4 pro (/api/chat),
 *      понимая контекст конкретного вопроса и ответа студента, и тоже
 *      проговаривает его голосом.
 *
 * Голос — серверный нейро-TTS через /api/tts (Navy /audio/speech, голос
 * shimmer). Браузерный speechSynthesis из useTTS остаётся резервом, если
 * сетевой синтез недоступен.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, BookOpen, Loader2 } from "lucide-react";
import type { QuizMessage } from "@/stores/useKnowledgeStore";
import { useAuthStore } from "@/stores/useAuthStore";

interface QuizManyashaProps {
  /** Свежий вердикт или null (студент ещё не ответил / уже перешли дальше). */
  verdict: QuizMessage | null;
  /** Текст текущего вопроса — для контекста объяснения. */
  questionText?: string | null;
  /** Ответ студента — для контекста объяснения. */
  userAnswer?: string | null;
  /** Авто-переход (блиц). */
  autoAdvance: boolean;
  autoAdvanceMs?: number;
  /** Клик «Далее» или авто-переход. */
  onDismiss: () => void;
}

type Level = "correct" | "partial" | "off_topic" | "wrong";

const LEVEL_META: Record<Level, { label: string; color: string; soft: string }> = {
  correct: { label: "Верно", color: "#16A34A", soft: "rgba(22,163,74,0.12)" },
  partial: { label: "Почти", color: "#D97706", soft: "rgba(217,119,6,0.12)" },
  off_topic: { label: "Не по теме", color: "#2563EB", soft: "rgba(37,99,235,0.12)" },
  wrong: { label: "Не совсем", color: "#DC2626", soft: "rgba(220,38,38,0.12)" },
};

const MASCOT_VIDEO = "/mascot/manyasha-idle-alpha.webm";
const MASCOT_POSTER = "/mascot/manyasha-idle-poster.jpg";

function Mascot({ size = 132 }: { size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 60%, rgba(124,58,237,0.20) 0%, transparent 68%)",
          filter: "blur(8px)",
        }}
      />
      <video
        src={MASCOT_VIDEO}
        poster={MASCOT_POSTER}
        loop
        muted
        playsInline
        autoPlay
        preload="auto"
        draggable={false}
        className="relative h-full w-full object-contain"
        style={{ transform: "scale(1.12)" }}
        aria-label="Маняша"
      />
    </div>
  );
}

/** Запрос развёрнутого объяснения у DeepSeek через /api/chat. */
async function fetchDetailedExplanation(args: {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  level: Level;
  userName: string;
  signal: AbortSignal;
}): Promise<string | null> {
  const verdictWord =
    args.level === "correct" ? "верный" : args.level === "partial" ? "частично верный" : "неверный";
  // 2026-06-06 (#3): обращение строго на «ты» по имени пользователя, без 3-го
  // лица («студент перепутал»). Имя берём из профиля (full_name → первое слово).
  const who = (args.userName || "").trim().split(/\s+/)[0] || "";
  const youAnswered = args.userAnswer
    ? `Твой ответ: «${args.userAnswer}».`
    : "Ты не дал(а) развёрнутого ответа.";
  const prompt = [
    `Вопрос теста по банкротству физлиц: «${args.question}».`,
    youAnswered,
    args.correctAnswer ? `Правильный ответ: «${args.correctAnswer}».` : "",
    `Твой ответ ${verdictWord}.`,
    `Объясни простым живым языком, как наставница Маняша: почему так и в чём суть правильного ответа.`,
    who
      ? `Обращайся ко мне на «ты» по имени — ${who}.`
      : `Обращайся ко мне на «ты».`,
    `НИКОГДА не пиши обо мне в третьем лице («студент», «пользователь», «он/она перепутал») — только «ты …».`,
    "2-4 коротких предложения, без приветствий и без списков. Если уместно — сошлись на норму закона.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      signal: args.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
    return reply || null;
  } catch {
    return null;
  }
}

export function QuizManyasha({
  verdict,
  questionText,
  userAnswer,
  autoAdvance,
  autoAdvanceMs = 2600,
  onDismiss,
}: QuizManyashaProps) {
  // 2026-06-06 (#3): имя пользователя для обращения Маняши на «ты».
  const userName = useAuthStore((s) => s.user?.full_name ?? "");

  // 2026-06-06 (#1): Маняша в тестах НЕ озвучивает разбор — только текст.
  // Весь TTS-механизм (серверный /api/tts + браузерный fallback + тумблер
  // звука) удалён по требованию: в тестах голос не нужен.

  const verdictId = verdict?.id ?? null;
  const level: Level = verdict
    ? ((verdict.verdictLevel as Level) ?? (verdict.isCorrect ? "correct" : "wrong"))
    : "correct";
  const meta = LEVEL_META[level];
  const correctAnswer = (verdict?.correctAnswer ?? "").trim();
  const backendExplanation = (verdict?.explanation ?? "").trim();
  const showCorrect = level !== "correct" && !!correctAnswer;

  // Развёрнутое объяснение от DeepSeek (подгружается асинхронно).
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // На каждый новый вердикт: озвучить короткий вердикт + подтянуть деталь.
  const spokenForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!verdictId) return;
    if (spokenForRef.current === verdictId) return;
    spokenForRef.current = verdictId;

    setAiExplanation(null);

    // Развёрнутое объяснение от DeepSeek (только текст, без озвучки).
    const controller = new AbortController();
    setAiLoading(true);
    fetchDetailedExplanation({
      question: (questionText ?? "").trim(),
      userAnswer: (userAnswer ?? "").trim(),
      correctAnswer,
      level,
      userName,
      signal: controller.signal,
    })
      .then((detail) => {
        if (controller.signal.aborted) return;
        const text = detail ?? backendExplanation;
        if (text) {
          setAiExplanation(text);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAiLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdictId]);

  // Авто-переход (блиц): отсчёт.
  useEffect(() => {
    if (!verdictId || !autoAdvance) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / autoAdvanceMs);
      setProgress(p);
      if (p >= 1) {
        clearInterval(tick);
        onDismiss();
      }
    }, 60);
    return () => clearInterval(tick);
  }, [verdictId, autoAdvance, autoAdvanceMs, onDismiss]);

  const displayedExplanation = aiExplanation ?? (level === "correct" ? backendExplanation : "");
  const articleRef = verdict?.articleRef;

  const idlePrompt = useMemo(
    () => "Отвечай на вопрос — я объясню каждый ответ голосом и по делу.",
    [],
  );

  return (
    <div
      className="overflow-hidden rounded-[28px]"
      style={{
        background: "#FFFDF8",
        border: "1px solid #E7DAF2",
        boxShadow: "0 24px 60px -34px rgba(124,58,237,0.45), 0 12px 38px rgba(63,42,76,0.12)",
      }}
    >
      <div className="flex items-start gap-3 px-5 pt-5">
        <Mascot />
        <div className="min-w-0 flex-1 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-[#18131D]">Маняша</span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-[#9B7DB4]">наставник</span>
          </div>

          <AnimatePresence mode="wait">
            {verdict ? (
              <motion.div
                key={verdictId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="mt-2"
              >
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-sm font-bold"
                  style={{ background: meta.soft, color: meta.color }}
                >
                  {meta.label}
                  {typeof verdict.llmScore === "number" && (
                    <span className="ml-2 font-mono text-xs opacity-80">
                      {Math.round(verdict.llmScore)}/10
                    </span>
                  )}
                </span>
              </motion.div>
            ) : (
              <motion.p
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 text-[15px] leading-snug text-[#5F5367]"
              >
                {idlePrompt}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {verdict && (
        <div className="px-5 pb-5 pt-3">
          {showCorrect && (
            <div
              className="mb-3 rounded-2xl px-4 py-3"
              style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.35)" }}
            >
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
                Правильный ответ
              </div>
              <div className="text-[16px] font-medium leading-snug text-[#18131D]">{correctAnswer}</div>
            </div>
          )}

          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: "#FBF6EF", border: "1px solid #E7DAF2" }}
          >
            {displayedExplanation ? (
              <p className="text-[15px] leading-relaxed text-[#3D3346]">{displayedExplanation}</p>
            ) : aiLoading ? (
              <p className="flex items-center gap-2 text-[14px] text-[#9B7DB4]">
                <Loader2 size={15} className="animate-spin" />
                Маняша готовит объяснение…
              </p>
            ) : (
              <p className="text-[14px] text-[#9B7DB4]">Объяснение появится здесь.</p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            {articleRef && (
              <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E7DAF2] px-3 py-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-[#7B7084]">
                <BookOpen size={14} />
                {articleRef}
              </div>
            )}
            <button
              type="button"
              onClick={() => onDismiss()}
              className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[#18131D] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7C3AED] sm:ml-auto sm:w-auto"
            >
              {autoAdvance && progress > 0 && progress < 1 && (
                <span
                  className="absolute inset-0 origin-left bg-[#7C3AED]"
                  style={{ transform: `scaleX(${progress})`, opacity: 0.5 }}
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-2">
                Далее
                <ArrowRight size={18} />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
