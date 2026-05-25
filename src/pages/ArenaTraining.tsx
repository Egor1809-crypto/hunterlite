import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { frontendApi } from "@/lib/frontend-api";
import { arenaQuestions } from "@/lib/arena-questions";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Loader2,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";

type QuizCategory =
  | "eligibility"
  | "procedure"
  | "property"
  | "consequences"
  | "costs"
  | "creditors"
  | "documents"
  | "timeline"
  | "court"
  | "rights";

const CATEGORIES: Array<{ id: QuizCategory; label: string }> = [
  { id: "eligibility", label: "Условия допуска" },
  { id: "procedure", label: "Процедура" },
  { id: "property", label: "Имущество" },
  { id: "consequences", label: "Последствия" },
  { id: "costs", label: "Расходы" },
  { id: "creditors", label: "Кредиторы" },
  { id: "documents", label: "Документы" },
  { id: "timeline", label: "Сроки" },
  { id: "court", label: "Суд" },
  { id: "rights", label: "Права" },
];

const QUESTION_COUNTS = [10, 15, 20] as const;

type DifficultyTier = "factoid" | "procedure" | "edge_case" | "strategic";

type ParsedQuestion = {
  question: string;
  topic: string;
  options: Array<{ text: string; isCorrect: boolean }>;
  explanation: string;
  law: string;
};

type QuizPhase = "setup" | "loading" | "quiz" | "evaluating" | "results";

type RoundResult = {
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  points: number;
};

function getDifficultyTier(step: number, totalSteps: number): DifficultyTier {
  const ratio = step / totalSteps;
  if (ratio < 0.25) return "factoid";
  if (ratio < 0.5) return "procedure";
  if (ratio < 0.75) return "edge_case";
  return "strategic";
}

const CATEGORY_LABELS: Record<QuizCategory, string> = {
  eligibility: "Условия допуска к банкротству",
  procedure: "Процедура банкротства",
  property: "Имущество при банкротстве",
  consequences: "Последствия банкротства",
  costs: "Расходы на банкротство",
  creditors: "Кредиторы и реестр",
  documents: "Документы для банкротства",
  timeline: "Сроки и этапы",
  court: "Судебные вопросы",
  rights: "Права должника",
};

function buildQuestionPrompt(category: QuizCategory, difficulty: DifficultyTier, step: number, totalSteps: number): string {
  return [
    `Ты — генератор экзаменационных вопросов по банкротству физических лиц (127-ФЗ).`,
    `Категория: ${CATEGORY_LABELS[category]}.`,
    `Уровень сложности: ${difficulty}.`,
    `Вопрос ${step} из ${totalSteps}.`,
    ``,
    `Сгенерируй один вопрос с 4 вариантами ответа. Только один вариант правильный.`,
    `Ответь строго в JSON формате без markdown:`,
    `{"question":"текст вопроса","topic":"короткое название темы","options":[{"text":"вариант 1","isCorrect":false},{"text":"вариант 2","isCorrect":true},{"text":"вариант 3","isCorrect":false},{"text":"вариант 4","isCorrect":false}],"explanation":"подробное объяснение правильного ответа со ссылкой на закон","law":"ссылка на статью закона"}`,
  ].join("\n");
}

function parseAiQuestion(reply: string): ParsedQuestion | null {
  try {
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (
      typeof parsed.question !== "string" ||
      !Array.isArray(parsed.options) ||
      parsed.options.length !== 4
    ) {
      return null;
    }
    const hasCorrect = parsed.options.some((o: { isCorrect?: boolean }) => o.isCorrect === true);
    if (!hasCorrect) return null;
    return {
      question: parsed.question,
      topic: parsed.topic || "",
      options: parsed.options.map((o: { text: string; isCorrect: boolean }) => ({
        text: String(o.text),
        isCorrect: Boolean(o.isCorrect),
      })),
      explanation: parsed.explanation || "",
      law: parsed.law || "",
    };
  } catch {
    return null;
  }
}

function getStaticFallbackQuestion(index: number): ParsedQuestion {
  const q = arenaQuestions[index % arenaQuestions.length];
  const correct = q.options.find((o) => o.isCorrect);
  return {
    question: q.question,
    topic: q.topic,
    options: q.options,
    explanation: correct?.text || "",
    law: q.law,
  };
}

export default function ArenaTraining() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<QuizPhase>("setup");
  const [category, setCategory] = useState<QuizCategory>("procedure");
  const [questionCount, setQuestionCount] = useState<number>(10);

  const sessionIdRef = useRef<string | null>(null);

  const [roundIndex, setRoundIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<ParsedQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const fetchQuestion = useCallback(
    async (step: number, total: number, sessId: string | null) => {
      setLoading(true);
      setAiError(false);
      const difficulty = getDifficultyTier(step, total);
      const prompt = buildQuestionPrompt(category, difficulty, step + 1, total);

      try {
        const response = await frontendApi.generateTrainingReply({
          sessionId: sessId ?? undefined,
          topic: CATEGORY_LABELS[category],
          mode: "exam",
          difficulty: step < total * 0.33 ? "basic" : step < total * 0.66 ? "medium" : "hard",
          step: step + 1,
          totalSteps: total,
          userMessage: prompt,
          messages: [{ from: "user", text: prompt }],
        });

        const parsed = parseAiQuestion(response.reply);
        if (parsed) {
          setCurrentQuestion(parsed);
          if (sessId) {
            frontendApi.addTrainingMessage(sessId, { from: "ai", text: response.reply }).catch(() => {});
          }
        } else {
          setAiError(true);
          setCurrentQuestion(getStaticFallbackQuestion(step));
        }
      } catch {
        setAiError(true);
        setCurrentQuestion(getStaticFallbackQuestion(step));
      } finally {
        setLoading(false);
      }
    },
    [category],
  );

  const startQuiz = async () => {
    setPhase("loading");
    setRoundIndex(0);
    setSelectedOption(null);
    setRevealed(false);
    setScore(0);
    setStreak(0);
    setResults([]);

    let sessId: string | null = null;
    try {
      const session = await frontendApi.createTrainingSession({
        topic: CATEGORY_LABELS[category],
        mode: "exam",
        difficulty: "medium",
        format: "text",
        character: "skeptical",
        questionCount,
      });
      sessId = session.id;
      sessionIdRef.current = sessId;
    } catch {
      sessionIdRef.current = null;
    }

    await fetchQuestion(0, questionCount, sessId);
    setPhase("quiz");
  };

  const submit = () => {
    if (selectedOption === null || revealed || !currentQuestion) return;

    const selected = currentQuestion.options[selectedOption];
    const correct = currentQuestion.options.find((o) => o.isCorrect);
    const isCorrect = selected.isCorrect;
    const points = isCorrect ? 10 : 0;

    setScore((s) => s + points);
    setStreak((s) => (isCorrect ? s + 1 : 0));
    setResults((prev) => [
      ...prev,
      {
        question: currentQuestion.question,
        selectedAnswer: selected.text,
        correctAnswer: correct?.text || "",
        isCorrect,
        explanation: currentQuestion.explanation,
        points,
      },
    ]);
    setRevealed(true);

    if (sessionIdRef.current) {
      frontendApi
        .addTrainingMessage(sessionIdRef.current, {
          from: "user",
          text: `Ответ: ${selected.text} (${isCorrect ? "верно" : "неверно"})`,
        })
        .catch(() => {});
    }
  };

  const nextRound = async () => {
    const next = roundIndex + 1;
    if (next >= questionCount) return;
    setRoundIndex(next);
    setSelectedOption(null);
    setRevealed(false);
    setCurrentQuestion(null);
    await fetchQuestion(next, questionCount, sessionIdRef.current);
  };

  const finishQuiz = async () => {
    setPhase("evaluating");

    const finalScore = Math.round((score / (questionCount * 10)) * 100);
    const mistakes = results.filter((r) => !r.isCorrect).map((r) => r.question);
    const passed = finalScore >= 70;

    if (sessionIdRef.current) {
      try {
        await frontendApi.completeTrainingSession(sessionIdRef.current, {
          score: finalScore,
          criteria: [
            { criterion: "legal_accuracy", score: finalScore, comment: `${results.filter((r) => r.isCorrect).length}/${questionCount} верных` },
            { criterion: "answer_structure", score: finalScore, comment: passed ? "Тест пройден" : "Тест не пройден" },
          ],
          mistakes,
          recommendations: mistakes.length > 0 ? ["Повторить ошибочные темы"] : ["Отличный результат"],
        });
      } catch {
        // session save failed, continue to results
      }
    }

    setPhase("results");
  };

  const isComplete = revealed && roundIndex >= questionCount - 1;
  const progress = Math.round(((roundIndex + (revealed ? 1 : 0)) / questionCount) * 100);

  const correctCount = results.filter((r) => r.isCorrect).length;
  const wrongCount = results.filter((r) => !r.isCorrect).length;
  const finalPercent = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;

  if (phase === "setup") {
    return (
      <ArenaShell
        title="Квиз по банкротству"
        subtitle="Проверка знаний"
        round={0}
        totalRounds={0}
        timeLeftSec={0}
        score={0}
        streak={0}
        onExit={() => navigate("/modes")}
        scoreboard={
          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-violet-100 font-bold text-sm">
                <BookOpen className="h-4 w-4" />
                О квизе
              </div>
              <p className="text-sm text-white/60 mt-2 leading-relaxed">
                AI генерирует вопросы по выбранной категории. Сложность растёт от фактологии к стратегическим кейсам.
              </p>
            </div>
          </div>
        }
        hud={null}
        main={
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-6">Настройка квиза</h2>

              <div className="space-y-5">
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/45 font-bold mb-3">Категория</div>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 text-sm font-semibold text-left transition-colors",
                          category === cat.id
                            ? "border-violet-200/50 bg-violet-200/12 text-white"
                            : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.075]",
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-white/45 font-bold mb-3">Количество вопросов</div>
                  <div className="flex gap-2">
                    {QUESTION_COUNTS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionCount(count)}
                        className={cn(
                          "rounded-lg border px-5 py-2.5 text-sm font-bold transition-colors",
                          questionCount === count
                            ? "border-violet-200/50 bg-violet-200/12 text-white"
                            : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.075]",
                        )}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
        footer={
          <div className="max-w-4xl mx-auto flex justify-end">
            <Button
              type="button"
              className="h-12 bg-white text-slate-950 hover:bg-white/90 px-8"
              onClick={startQuiz}
            >
              Начать квиз
            </Button>
          </div>
        }
      />
    );
  }

  if (phase === "loading" || phase === "evaluating") {
    return (
      <ArenaShell
        title="Квиз по банкротству"
        subtitle={CATEGORY_LABELS[category]}
        round={phase === "evaluating" ? questionCount : 1}
        totalRounds={questionCount}
        timeLeftSec={0}
        score={score}
        streak={streak}
        onExit={() => navigate("/modes")}
        scoreboard={null}
        hud={null}
        main={
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-violet-300 animate-spin" />
            <p className="text-white/65 text-lg">
              {phase === "loading" ? "Создаём сессию и генерируем вопросы…" : "Сохраняем результаты…"}
            </p>
          </div>
        }
        footer={null}
      />
    );
  }

  if (phase === "results") {
    const passed = finalPercent >= 70;
    return (
      <ArenaShell
        title="Результаты квиза"
        subtitle={CATEGORY_LABELS[category]}
        round={questionCount}
        totalRounds={questionCount}
        timeLeftSec={0}
        score={score}
        streak={0}
        onExit={() => navigate("/modes")}
        scoreboard={
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  r.isCorrect ? "border-emerald-300/20 bg-emerald-300/5" : "border-rose-300/20 bg-rose-300/5",
                )}
              >
                <div className="text-white/50 text-xs font-bold uppercase tracking-wider">Вопрос {i + 1}</div>
                <div className="mt-1 text-white/85 line-clamp-2">{r.question}</div>
                <div className={cn("mt-1 text-xs", r.isCorrect ? "text-emerald-200" : "text-rose-200")}>
                  {r.isCorrect ? "Верно +10" : "Ошибка +0"}
                </div>
              </div>
            ))}
          </div>
        }
        hud={null}
        main={
          <div className="space-y-6 max-w-2xl mx-auto">
            <div
              className={cn(
                "rounded-xl border p-8 text-center",
                passed ? "border-emerald-200/20 bg-emerald-200/10" : "border-rose-200/20 bg-rose-200/10",
              )}
            >
              <Trophy className={cn("h-12 w-12 mx-auto mb-4", passed ? "text-emerald-300" : "text-rose-300")} />
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white">
                {finalPercent}%
              </h2>
              <p className="text-white/65 mt-2 text-lg">
                {passed ? "Тест пройден" : "Тест не пройден"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center">
                <div className="text-pixel-number text-2xl tabular-nums text-emerald-300">{correctCount}</div>
                <div className="text-xs text-white/50 mt-1">Верных</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center">
                <div className="text-pixel-number text-2xl tabular-nums text-rose-300">{wrongCount}</div>
                <div className="text-xs text-white/50 mt-1">Ошибок</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center">
                <div className="text-pixel-number text-2xl tabular-nums text-violet-300">{score}</div>
                <div className="text-xs text-white/50 mt-1">Баллов</div>
              </div>
            </div>

            {wrongCount > 0 && (
              <div className="rounded-xl border border-rose-200/15 bg-rose-200/5 p-5">
                <h3 className="font-bold text-rose-100 mb-3">Ошибки</h3>
                <div className="space-y-3">
                  {results
                    .filter((r) => !r.isCorrect)
                    .map((r, i) => (
                      <div key={i} className="text-sm">
                        <p className="text-white/80 font-semibold">{r.question}</p>
                        <p className="text-rose-200/70 mt-1">Ваш ответ: {r.selectedAnswer}</p>
                        <p className="text-emerald-200/70">Верный ответ: {r.correctAnswer}</p>
                        {r.explanation && <p className="text-white/50 mt-1">{r.explanation}</p>}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        }
        footer={
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-white/55">
              Категория: {CATEGORY_LABELS[category]}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="h-12 bg-white text-slate-950 hover:bg-white/90"
                onClick={() => {
                  setPhase("setup");
                  setResults([]);
                  setScore(0);
                  setStreak(0);
                  setRoundIndex(0);
                  sessionIdRef.current = null;
                }}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Новый квиз
              </Button>
            </div>
          </div>
        }
      />
    );
  }

  const isCorrect = selectedOption !== null && currentQuestion ? currentQuestion.options[selectedOption].isCorrect : false;
  const correctAnswer = currentQuestion?.options.find((o) => o.isCorrect);

  return (
    <ArenaShell
      title="Квиз по банкротству"
      subtitle={CATEGORY_LABELS[category]}
      round={roundIndex + 1}
      totalRounds={questionCount}
      timeLeftSec={revealed ? 0 : 90}
      score={score}
      streak={streak}
      onExit={() => navigate("/modes")}
      scoreboard={
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-3 text-sm",
                r.isCorrect ? "border-emerald-300/20 bg-emerald-300/5" : "border-rose-300/20 bg-rose-300/5",
              )}
            >
              <div className="text-white/50 text-xs font-bold uppercase tracking-wider">Вопрос {i + 1}</div>
              <div className="mt-1 text-white/85 line-clamp-2">{r.question}</div>
              <div className={cn("mt-1 text-xs", r.isCorrect ? "text-emerald-200" : "text-rose-200")}>
                {r.isCorrect ? "Верно +10" : "Ошибка +0"}
              </div>
            </div>
          ))}
          {roundIndex >= results.length && (
            <div className="rounded-lg border border-violet-300/40 bg-violet-300/10 p-3 text-sm">
              <div className="text-white/50 text-xs font-bold uppercase tracking-wider">Вопрос {roundIndex + 1}</div>
              <div className="mt-1 text-white/85 line-clamp-2">
                {currentQuestion ? currentQuestion.topic : "Загрузка…"}
              </div>
            </div>
          )}
        </div>
      }
      hud={
        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/45 font-bold">Прогресс</div>
            <Progress value={progress} className="h-1.5 mt-2" />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-violet-100 font-bold text-sm">
              <Lightbulb className="h-4 w-4" />
              Сложность
            </div>
            <p className="text-sm text-white/65 mt-2">
              {getDifficultyTier(roundIndex, questionCount) === "factoid" && "Фактология — базовые знания"}
              {getDifficultyTier(roundIndex, questionCount) === "procedure" && "Процедуры — порядок действий"}
              {getDifficultyTier(roundIndex, questionCount) === "edge_case" && "Нюансы — пограничные случаи"}
              {getDifficultyTier(roundIndex, questionCount) === "strategic" && "Стратегия — комплексные решения"}
            </p>
          </div>
          {aiError && (
            <div className="rounded-lg border border-amber-200/20 bg-amber-200/10 p-3 text-xs text-amber-50">
              AI недоступен — используется запасной вопрос
            </div>
          )}
        </div>
      }
      main={
        <div className="space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-8 w-8 text-violet-300 animate-spin" />
              <p className="text-white/55">Генерация вопроса…</p>
            </div>
          ) : currentQuestion ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 md:p-7 shadow-2xl shadow-black/20">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="rounded-full bg-violet-300/15 px-3 py-1 text-xs font-bold text-violet-100">
                    {currentQuestion.topic}
                  </span>
                  {currentQuestion.law && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/60">
                      {currentQuestion.law}
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <HelpCircle className="h-6 w-6 text-violet-200 shrink-0 mt-1" />
                  <h2 className="font-display text-2xl md:text-4xl font-bold leading-tight text-white">
                    {currentQuestion.question}
                  </h2>
                </div>
              </div>

              <div className="grid gap-3">
                {currentQuestion.options.map((option, optionIndex) => {
                  const selected = selectedOption === optionIndex;
                  const showCorrect = revealed && option.isCorrect;
                  const showWrong = revealed && selected && !option.isCorrect;

                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      disabled={revealed}
                      onClick={() => setSelectedOption(optionIndex)}
                      className={cn(
                        "min-h-16 rounded-xl border px-4 py-3 text-left text-sm md:text-base font-semibold transition-colors",
                        "border-white/10 bg-white/[0.04] text-white/78 hover:bg-white/[0.075]",
                        selected && "border-violet-200/50 bg-violet-200/12 text-white",
                        showCorrect && "border-emerald-200/50 bg-emerald-200/12 text-emerald-50",
                        showWrong && "border-rose-200/50 bg-rose-200/12 text-rose-50",
                      )}
                    >
                      <span className="mr-2 text-white/35">{optionIndex + 1}.</span>
                      {option.text}
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div
                  className={cn(
                    "rounded-xl border p-5",
                    isCorrect ? "border-emerald-200/20 bg-emerald-200/10" : "border-rose-200/20 bg-rose-200/10",
                  )}
                >
                  <div className={cn("flex items-center gap-2 font-bold", isCorrect ? "text-emerald-100" : "text-rose-100")}>
                    {isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    {isCorrect ? "Верно (+10 баллов)" : "Неверно"}
                  </div>
                  {correctAnswer && !isCorrect && (
                    <p className="text-sm text-emerald-200/80 mt-2">Правильный ответ: {correctAnswer.text}</p>
                  )}
                  {currentQuestion.explanation && (
                    <p className="text-sm md:text-base text-white/78 mt-3 leading-relaxed">{currentQuestion.explanation}</p>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      }
      footer={
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-white/55">
            {CATEGORY_LABELS[category]} — вопрос {roundIndex + 1} из {questionCount}
          </div>
          {!revealed ? (
            <Button
              type="button"
              className="h-12 bg-white text-slate-950 hover:bg-white/90"
              disabled={selectedOption === null || loading}
              onClick={submit}
            >
              Проверить
            </Button>
          ) : isComplete ? (
            <Button
              type="button"
              className="h-12 bg-white text-slate-950 hover:bg-white/90"
              onClick={finishQuiz}
            >
              <Trophy className="h-4 w-4 mr-1.5" />
              Результаты
            </Button>
          ) : (
            <Button
              type="button"
              className="h-12 bg-white text-slate-950 hover:bg-white/90"
              onClick={nextRound}
            >
              Следующий вопрос
            </Button>
          )}
        </div>
      }
    />
  );
}
