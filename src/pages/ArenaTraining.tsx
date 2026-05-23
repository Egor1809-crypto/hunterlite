import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { arenaQuestions } from "@/lib/arena-questions";
import { cn } from "@/lib/utils";
import { CheckCircle2, HelpCircle, Lightbulb, RotateCcw, ShieldAlert, XCircle } from "lucide-react";

export default function ArenaTraining() {
  const navigate = useNavigate();
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [roundScores, setRoundScores] = useState<number[]>([]);

  const round = arenaQuestions[roundIndex];
  const selectedAnswer = selectedOption === null ? null : round.options[selectedOption];
  const isCorrect = Boolean(selectedAnswer?.isCorrect);
  const roundScore = revealed && isCorrect ? 100 : 0;
  const complete = roundIndex >= arenaQuestions.length - 1 && revealed;
  const progress = Math.round(((roundIndex + (revealed ? 1 : 0)) / arenaQuestions.length) * 100);
  const correctAnswer = round.options.find((option) => option.isCorrect);

  const submit = () => {
    if (selectedOption === null || revealed) return;

    setScore((current) => current + (isCorrect ? 25 : 0));
    setStreak((current) => (isCorrect ? current + 1 : 0));
    setRoundScores((current) => [...current, isCorrect ? 100 : 0]);
    setRevealed(true);
  };

  const nextRound = () => {
    if (roundIndex >= arenaQuestions.length - 1) return;
    setRoundIndex((current) => current + 1);
    setSelectedOption(null);
    setRevealed(false);
  };

  const reset = () => {
    setRoundIndex(0);
    setSelectedOption(null);
    setScore(0);
    setStreak(0);
    setRevealed(false);
    setRoundScores([]);
  };

  return (
    <ArenaShell
      title="Арена: тесты по БФЛ"
      subtitle="Выверенные вопросы"
      round={roundIndex + 1}
      totalRounds={arenaQuestions.length}
      timeLeftSec={revealed ? 0 : 90}
      score={score}
      streak={streak}
      onExit={() => navigate("/modes")}
      scoreboard={
        <div className="space-y-2">
          {arenaQuestions.map((item, index) => {
            const done = index < roundScores.length;
            const active = index === roundIndex;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  active ? "border-violet-300/40 bg-violet-300/10" : "border-white/10 bg-white/[0.03]",
                )}
              >
                <div className="text-white/50 text-xs font-bold uppercase tracking-wider">Раунд {index + 1}</div>
                <div className="mt-1 text-white/85">{item.topic}</div>
                {done ? (
                  <div className={cn("mt-1 text-xs", roundScores[index] === 100 ? "text-emerald-200" : "text-rose-200")}>
                    {roundScores[index] === 100 ? "Верно" : "Ошибка"}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      }
      hud={
        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/45 font-bold">Прогресс матча</div>
            <Progress value={progress} className="h-1.5 mt-2" />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-violet-100 font-bold">
              <Lightbulb className="h-4 w-4" />
              Источник
            </div>
            <p className="text-sm text-white/65 mt-2">
              Вопрос N {round.sourceQuestionNumber} из выверенного docx. Неправильные варианты взяты из {round.source}.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200/20 bg-amber-200/10 p-4 text-sm text-amber-50">
            <ShieldAlert className="h-4 w-4 mb-2" />
            Сейчас в арене только вопросы, которые удалось строго сопоставить со старшим проектом.
          </div>
        </div>
      }
      main={
        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 md:p-7 shadow-2xl shadow-black/20">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="rounded-full bg-violet-300/15 px-3 py-1 text-xs font-bold text-violet-100">
                {round.topic}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/60">
                {round.law}
              </span>
            </div>
            <div className="flex gap-3">
              <HelpCircle className="h-6 w-6 text-violet-200 shrink-0 mt-1" />
              <h2 className="font-display text-2xl md:text-4xl font-bold leading-tight text-white">
                {round.question}
              </h2>
            </div>
          </div>

          <div className="grid gap-3">
            {round.options.map((option, optionIndex) => {
              const selected = selectedOption === optionIndex;
              const showCorrect = revealed && option.isCorrect;
              const showWrong = revealed && selected && !option.isCorrect;

              return (
                <button
                  key={option.text}
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

          {revealed ? (
            <div
              className={cn(
                "rounded-xl border p-5",
                isCorrect ? "border-emerald-200/20 bg-emerald-200/10" : "border-rose-200/20 bg-rose-200/10",
              )}
            >
              <div className={cn("flex items-center gap-2 font-bold", isCorrect ? "text-emerald-100" : "text-rose-100")}>
                {isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                {isCorrect ? "Верно" : "Неверно"}
              </div>
              <p className="text-sm md:text-base text-white/78 mt-3 leading-relaxed">{correctAnswer?.text}</p>
              <div className="mt-4 text-sm text-white/65">
                Результат раунда: <span className="text-pixel-inline">{roundScore}%</span>
              </div>
            </div>
          ) : null}

          {complete ? (
            <div className="rounded-xl border border-violet-200/20 bg-violet-200/10 p-5">
              <h3 className="font-display text-xl font-bold text-white">Арена завершена</h3>
              <p className="text-white/65 mt-2">
                Итоговый счёт: <span className="text-pixel-inline">{score}</span>. Следующий шаг — расширить банк только подтверждёнными совпадениями из старшего проекта.
              </p>
            </div>
          ) : null}
        </div>
      }
      footer={
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-white/55">
            Выберите один вариант ответа. Неправильные варианты перенесены из ошибок старшего проекта.
          </div>
          {!revealed ? (
            <Button
              type="button"
              className="h-12 bg-white text-slate-950 hover:bg-white/90"
              disabled={selectedOption === null}
              onClick={submit}
            >
              Проверить
            </Button>
          ) : complete ? (
            <Button type="button" className="h-12 bg-white text-slate-950 hover:bg-white/90" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Заново
            </Button>
          ) : (
            <Button type="button" className="h-12 bg-white text-slate-950 hover:bg-white/90" onClick={nextRound}>
              Следующий раунд
            </Button>
          )}
        </div>
      }
    />
  );
}
