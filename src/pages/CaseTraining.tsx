import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { cn } from "@/lib/utils";
import { ArrowDownUp, BriefcaseBusiness, CheckCircle2, GripVertical, RotateCcw } from "lucide-react";

const caseScenario = {
  title: "Ипотечная квартира и просрочки по кредитам",
  client:
    "Клиент платит ипотеку без просрочек, но перестал справляться с потребительскими кредитами. Есть автомобиль, алименты и перевод денег родственнику за 2 месяца до обращения.",
  steps: [
    {
      question: "Что нужно уточнить в первую очередь?",
      options: [
        "Только сумму долга по потребительским кредитам",
        "Состав долгов, имущество, алименты, сделки за последние годы и статус ипотеки",
        "Готов ли клиент сразу перестать платить ипотеку",
      ],
      correct: 1,
      explanation: "Для оценки банкротства важно собрать полную картину: долги, имущество, обязательства, сделки и залоговые риски.",
    },
    {
      question: "Как безопасно ответить про ипотечную квартиру?",
      options: [
        "Ипотечную квартиру точно сохранят, если клиент платит банку",
        "Залоговое жильё всегда продают без исключений",
        "Ипотека требует отдельного анализа: залоговый кредитор имеет особый статус, риск реализации нужно объяснить заранее",
      ],
      correct: 2,
      explanation: "Нельзя обещать сохранение ипотечного жилья. Нужно обозначить риск и анализировать документы.",
    },
    {
      question: "Что сказать про алименты?",
      options: [
        "Алименты не списываются при банкротстве",
        "Алименты можно списать вместе с кредитами",
        "Алименты списываются, если нет имущества",
      ],
      correct: 0,
      explanation: "Алиментные обязательства относятся к долгам, которые не прекращаются банкротством.",
    },
    {
      question: "Какой риск есть в переводе денег родственнику перед процедурой?",
      options: [
        "Никакого риска, личные переводы не проверяются",
        "Сделку могут проверить и оспорить, если она нарушает права кредиторов",
        "Этот перевод автоматически делает банкротство невозможным",
      ],
      correct: 1,
      explanation: "Подозрительные сделки перед банкротством могут быть предметом проверки и оспаривания.",
    },
  ],
  procedure: [
    "Первичная консультация и сбор документов",
    "Анализ долгов, имущества и сделок",
    "Подготовка заявления в арбитражный суд",
    "Принятие заявления и введение процедуры",
    "Работа финансового управляющего и формирование конкурсной массы",
    "Завершение процедуры и решение о списании долгов",
  ],
};

const initialOrder = [
  caseScenario.procedure[2],
  caseScenario.procedure[0],
  caseScenario.procedure[4],
  caseScenario.procedure[1],
  caseScenario.procedure[5],
  caseScenario.procedure[3],
];

export default function CaseTraining() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submittedSteps, setSubmittedSteps] = useState(false);
  const [order, setOrder] = useState(initialOrder);
  const [submittedOrder, setSubmittedOrder] = useState(false);

  const correctAnswers = caseScenario.steps.filter((step, index) => answers[index] === step.correct).length;
  const orderScore = order.filter((item, index) => item === caseScenario.procedure[index]).length;
  const totalTasks = caseScenario.steps.length + caseScenario.procedure.length;
  const totalCorrect = (submittedSteps ? correctAnswers : 0) + (submittedOrder ? orderScore : 0);
  const finalScore = Math.round((totalCorrect / totalTasks) * 100);
  const answeredCount = Object.keys(answers).length;

  const canSubmitSteps = answeredCount === caseScenario.steps.length;
  const canSubmitOrder = submittedSteps;
  const finished = submittedSteps && submittedOrder;

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length || submittedOrder) return;

    setOrder((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const progress = useMemo(() => {
    if (finished) return 100;
    return Math.round(((submittedSteps ? caseScenario.steps.length : answeredCount) / totalTasks) * 100);
  }, [answeredCount, finished, submittedSteps, totalTasks]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <BackButton label="Назад к режимам" fallback="/modes" />

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconBadge icon={BriefcaseBusiness} />
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Практическая тренировка</div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-tight mt-1">Кейсы по банкротству</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Ответьте на шаги ситуации, затем соберите процедуру банкротства в правильной хронологии.
            </p>
          </div>
        </div>
        <Card className="p-4 min-w-[220px]">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Итоговый балл</div>
          <div className="text-pixel-number text-3xl mt-1">{finished ? finalScore : "--"}</div>
          <Progress value={progress} className="h-1.5 mt-3" />
        </Card>
      </div>

      <Card className="p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusBadge variant="info">Ситуация клиента</StatusBadge>
          <StatusBadge variant="warning">Ипотека</StatusBadge>
          <StatusBadge variant="warning">Сделка с родственником</StatusBadge>
        </div>
        <h2 className="font-display font-bold text-xl text-primary">{caseScenario.title}</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{caseScenario.client}</p>
      </Card>

      <Card className="p-5 shadow-card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display font-bold text-primary">1. Ответы по шагам кейса</h3>
            <p className="text-sm text-muted-foreground mt-1">Выберите юридически безопасный вариант на каждом шаге.</p>
          </div>
          {submittedSteps ? <StatusBadge variant="success">{correctAnswers}/{caseScenario.steps.length}</StatusBadge> : null}
        </div>

        <div className="space-y-4">
          {caseScenario.steps.map((step, stepIndex) => {
            const selected = answers[stepIndex];
            const isCorrect = selected === step.correct;

            return (
              <div key={step.question} className="rounded-lg border border-border p-4">
                <div className="font-semibold text-sm text-primary">{stepIndex + 1}. {step.question}</div>
                <div className="grid gap-2 mt-3">
                  {step.options.map((option, optionIndex) => {
                    const active = selected === optionIndex;
                    const showCorrect = submittedSteps && optionIndex === step.correct;
                    const showWrong = submittedSteps && active && !isCorrect;

                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={submittedSteps}
                        onClick={() => setAnswers((current) => ({ ...current, [stepIndex]: optionIndex }))}
                        className={cn(
                          "text-left text-sm rounded-lg border px-3 py-2 transition-colors",
                          active ? "border-accent bg-accent/10" : "border-border hover:bg-muted/40",
                          showCorrect && "border-success bg-success/10",
                          showWrong && "border-destructive bg-destructive/10",
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {submittedSteps ? (
                  <p className={cn("text-xs mt-3", isCorrect ? "text-success" : "text-destructive")}>
                    {isCorrect ? "Верно. " : "Нужно исправить логику. "}{step.explanation}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {!submittedSteps ? (
          <Button onClick={() => setSubmittedSteps(true)} disabled={!canSubmitSteps} className="mt-4 bg-primary hover:bg-primary/90">
            Проверить ответы
          </Button>
        ) : null}
      </Card>

      <Card className={cn("p-5 shadow-card", !submittedSteps && "opacity-60")}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display font-bold text-primary">2. Хронология процедуры</h3>
            <p className="text-sm text-muted-foreground mt-1">Расставьте этапы банкротства физлица в правильном порядке.</p>
          </div>
          {submittedOrder ? <StatusBadge variant="success">{orderScore}/{caseScenario.procedure.length}</StatusBadge> : null}
        </div>

        <div className="space-y-2">
          {order.map((item, index) => {
            const isCorrect = submittedOrder && item === caseScenario.procedure[index];

            return (
              <div
                key={item}
                className={cn(
                  "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border p-3 bg-card",
                  submittedOrder && (isCorrect ? "border-success bg-success/10" : "border-warning bg-warning-soft/40"),
                )}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                  <span className="text-xs font-mono">{index + 1}</span>
                </div>
                <div className="text-sm">{item}</div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={!canSubmitOrder || submittedOrder || index === 0} onClick={() => moveItem(index, -1)}>
                    ↑
                  </Button>
                  <Button variant="ghost" size="sm" disabled={!canSubmitOrder || submittedOrder || index === order.length - 1} onClick={() => moveItem(index, 1)}>
                    ↓
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {!submittedOrder ? (
            <Button onClick={() => setSubmittedOrder(true)} disabled={!canSubmitOrder} className="bg-primary hover:bg-primary/90">
              <ArrowDownUp className="h-4 w-4 mr-1.5" /> Проверить порядок
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              setAnswers({});
              setSubmittedSteps(false);
              setSubmittedOrder(false);
              setOrder(initialOrder);
            }}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" /> Пройти заново
          </Button>
        </div>
      </Card>

      {finished ? (
        <Card className="p-5 shadow-card bg-ai-soft border-ai/20">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-ai-soft-foreground shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display font-bold text-ai-soft-foreground">Разбор завершён</h3>
              <p className="text-sm text-ai-soft-foreground/90 mt-1">
                {finalScore >= 80
                  ? "Хорошая работа: логика кейса и порядок процедуры в целом собраны правильно."
                  : "Повторите книгу БФЛ по имуществу, неснимаемым долгам и этапам судебной процедуры."}
              </p>
              <Button onClick={() => navigate("/bfl-book")} variant="outline" className="mt-3 bg-card">
                Открыть книгу БФЛ
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
