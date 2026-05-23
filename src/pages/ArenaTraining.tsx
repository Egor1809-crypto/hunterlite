import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CheckCircle2, HelpCircle, Lightbulb, RotateCcw, Send, ShieldAlert } from "lucide-react";

const arenaRounds = [
  {
    topic: "Имущество должника",
    question: "Клиент спрашивает: единственную квартиру точно не заберут?",
    answer: "Нельзя обещать точно. Обычно единственное жильё защищено, но ипотека и злоупотребления требуют отдельной проверки.",
    keywords: ["единственное жильё", "ипотека", "провер"],
    hint: "Убери гарантию и добавь оговорку про документы.",
  },
  {
    topic: "Несгораемые долги",
    question: "Клиент хочет списать алименты вместе с кредитами. Что ответить?",
    answer: "Алименты не списываются банкротством. Нужно отделить их от кредитных долгов и объяснить порядок дальнейших платежей.",
    keywords: ["алименты", "не спис", "кредит"],
    hint: "Назови исключение и не смешивай алименты с кредитами.",
  },
  {
    topic: "Сделки перед процедурой",
    question: "Клиент подарил машину родственнику за месяц до банкротства. Что важно сказать?",
    answer: "Сделку могут проверить и оспорить, если она нарушает права кредиторов. Нужно заранее раскрыть факт и изучить документы.",
    keywords: ["оспор", "кредитор", "документ"],
    hint: "Сфокусируйся на риске оспаривания и прозрачности.",
  },
  {
    topic: "Финансовый управляющий",
    question: "Клиент боится, что управляющий сразу заблокирует всю жизнь. Как ответить безопасно?",
    answer: "Управляющий контролирует процедуру и имущество, но базовые жизненные расходы учитываются. Нужно объяснить ограничения без запугивания.",
    keywords: ["управляющ", "расход", "огранич"],
    hint: "Баланс: контроль есть, но не драматизируем.",
  },
];

const normalize = (value: string) => value.toLowerCase().replace(/ё/g, "е");

const scoreAnswer = (answer: string, keywords: string[]) => {
  const normalizedAnswer = normalize(answer);
  const hits = keywords.filter((keyword) => normalizedAnswer.includes(normalize(keyword))).length;
  return Math.round((hits / keywords.length) * 100);
};

export default function ArenaTraining() {
  const navigate = useNavigate();
  const [roundIndex, setRoundIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [roundScores, setRoundScores] = useState<number[]>([]);

  const round = arenaRounds[roundIndex];
  const roundScore = useMemo(() => scoreAnswer(answer, round.keywords), [answer, round.keywords]);
  const complete = roundIndex >= arenaRounds.length - 1 && revealed;
  const progress = Math.round(((roundIndex + (revealed ? 1 : 0)) / arenaRounds.length) * 100);

  const submit = () => {
    if (!answer.trim() || revealed) return;
    const earned = roundScore >= 67 ? 25 : roundScore >= 34 ? 12 : 0;
    setScore((current) => current + earned);
    setStreak((current) => (earned >= 25 ? current + 1 : 0));
    setRoundScores((current) => [...current, roundScore]);
    setRevealed(true);
  };

  const nextRound = () => {
    if (roundIndex >= arenaRounds.length - 1) return;
    setRoundIndex((current) => current + 1);
    setAnswer("");
    setRevealed(false);
  };

  const reset = () => {
    setRoundIndex(0);
    setAnswer("");
    setScore(0);
    setStreak(0);
    setRevealed(false);
    setRoundScores([]);
  };

  return (
    <ArenaShell
      title="Арена: тесты по БФЛ"
      subtitle="Быстрые раунды"
      round={roundIndex + 1}
      totalRounds={arenaRounds.length}
      timeLeftSec={Math.max(0, 90 - answer.length)}
      score={score}
      streak={streak}
      onExit={() => navigate("/modes")}
      scoreboard={
        <div className="space-y-2">
          {arenaRounds.map((item, index) => {
            const done = index < roundScores.length;
            const active = index === roundIndex;
            return (
              <div
                key={item.question}
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  active ? "border-violet-300/40 bg-violet-300/10" : "border-white/10 bg-white/[0.03]",
                )}
              >
                <div className="text-white/50 text-xs font-bold uppercase tracking-wider">Раунд {index + 1}</div>
                <div className="mt-1 text-white/85">{item.topic}</div>
                {done ? <div className="mt-1 text-xs text-emerald-200">{roundScores[index]}%</div> : null}
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
              Подсказка
            </div>
            <p className="text-sm text-white/65 mt-2">{round.hint}</p>
          </div>
          <div className="rounded-lg border border-amber-200/20 bg-amber-200/10 p-4 text-sm text-amber-50">
            <ShieldAlert className="h-4 w-4 mb-2" />
            Арена оценивает не красоту текста, а наличие юридически важных опор.
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
                Ответ одним сообщением
              </span>
            </div>
            <div className="flex gap-3">
              <HelpCircle className="h-6 w-6 text-violet-200 shrink-0 mt-1" />
              <h2 className="font-display text-2xl md:text-4xl font-bold leading-tight text-white">
                {round.question}
              </h2>
            </div>
          </div>

          {revealed ? (
            <div className="rounded-xl border border-emerald-200/20 bg-emerald-200/10 p-5">
              <div className="flex items-center gap-2 text-emerald-100 font-bold">
                <CheckCircle2 className="h-5 w-5" />
                Эталонный ответ
              </div>
              <p className="text-sm md:text-base text-white/78 mt-3 leading-relaxed">{round.answer}</p>
              <div className="mt-4 text-sm text-white/65">
                Ваше покрытие ключевых опор: <span className="text-pixel-inline">{roundScore}%</span>
              </div>
            </div>
          ) : null}

          {complete ? (
            <div className="rounded-xl border border-violet-200/20 bg-violet-200/10 p-5">
              <h3 className="font-display text-xl font-bold text-white">Арена завершена</h3>
              <p className="text-white/65 mt-2">
                Итоговый счёт: <span className="text-pixel-inline">{score}</span>. Следующий шаг — подключить сюда вопросы из админки и AI-разбор через NAVY.
              </p>
            </div>
          ) : null}
        </div>
      }
      footer={
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-3">
          <Input
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={revealed}
            className="h-12 bg-black/30 border-white/10 text-white placeholder:text-white/35"
            placeholder="Введите юридически безопасный ответ..."
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          {!revealed ? (
            <Button type="button" className="h-12 bg-white text-slate-950 hover:bg-white/90" onClick={submit}>
              <Send className="h-4 w-4 mr-1.5" />
              Ответить
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
