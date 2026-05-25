import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { cn } from "@/lib/utils";
import { frontendApi } from "@/lib/frontend-api";
import type { CaseTemplateDto, CaseStepDto } from "@/lib/api-contracts";
import { BriefcaseBusiness, CheckCircle2, RotateCcw } from "lucide-react";

type CaseOption = { id: string; text: string };

function parseOptions(step: CaseStepDto): CaseOption[] {
  if (!step.options) return [];
  if (Array.isArray(step.options)) {
    return (step.options as Array<{ id: string; text: string }>).map((o) => ({
      id: String(o.id),
      text: String(o.text),
    }));
  }
  return [];
}

function CaseSelection({
  cases,
  onSelect,
}: {
  cases: CaseTemplateDto[];
  onSelect: (c: CaseTemplateDto) => void;
}) {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <BackButton label="Назад к режимам" fallback="/modes" />

      <div className="flex items-start gap-4">
        <IconBadge icon={BriefcaseBusiness} />
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Практическая тренировка</div>
          <h1 className="font-display text-3xl font-bold text-primary tracking-tight mt-1">Кейсы по банкротству</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">Выберите кейс для прохождения.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <Card key={c.id} className="p-5 shadow-card hover:border-accent transition-colors cursor-pointer" onClick={() => onSelect(c)}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusBadge variant="info">{c.difficulty}</StatusBadge>
              {c.tags.map((tag) => (
                <StatusBadge key={tag} variant="warning">{tag}</StatusBadge>
              ))}
            </div>
            <h3 className="font-display font-bold text-primary">{c.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{c.introText}</p>
            {c.steps && (
              <p className="text-xs text-muted-foreground mt-2">{c.steps.length} шагов</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function CaseQuiz({ caseData }: { caseData: CaseTemplateDto }) {
  const navigate = useNavigate();
  const steps = caseData.steps || [];
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const correctAnswers = steps.filter((step, index) => {
    if (!step.correctOptionId) return false;
    return answers[index] === step.correctOptionId;
  }).length;

  const totalTasks = steps.length;
  const answeredCount = Object.keys(answers).length;
  const canSubmit = answeredCount === totalTasks && totalTasks > 0;
  const finalScore = totalTasks > 0 ? Math.round((correctAnswers / totalTasks) * 100) : 0;

  const progress = useMemo(() => {
    if (submitted) return 100;
    if (totalTasks === 0) return 0;
    return Math.round((answeredCount / totalTasks) * 100);
  }, [answeredCount, submitted, totalTasks]);

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
              Ответьте на вопросы кейса, выбирая юридически безопасный вариант.
            </p>
          </div>
        </div>
        <Card className="p-4 min-w-[220px]">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Итоговый балл</div>
          <div className="text-pixel-number text-3xl mt-1">{submitted ? finalScore : "--"}</div>
          <Progress value={progress} className="h-1.5 mt-3" />
        </Card>
      </div>

      <Card className="p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusBadge variant="info">Ситуация клиента</StatusBadge>
          {caseData.tags.map((tag) => (
            <StatusBadge key={tag} variant="warning">{tag}</StatusBadge>
          ))}
        </div>
        <h2 className="font-display font-bold text-xl text-primary">{caseData.title}</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{caseData.introText}</p>
      </Card>

      <Card className="p-5 shadow-card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display font-bold text-primary">Ответы по шагам кейса</h3>
            <p className="text-sm text-muted-foreground mt-1">Выберите юридически безопасный вариант на каждом шаге.</p>
          </div>
          {submitted && <StatusBadge variant="success">{correctAnswers}/{totalTasks}</StatusBadge>}
        </div>

        <div className="space-y-4">
          {steps.map((step, stepIndex) => {
            const options = parseOptions(step);
            const selected = answers[stepIndex];
            const isCorrect = selected === step.correctOptionId;
            const isRedFlag = step.isRedFlag;

            return (
              <div key={step.id} className={cn("rounded-lg border border-border p-4", isRedFlag && "border-destructive/30")}>
                <div className="flex items-start gap-2">
                  <div className="font-semibold text-sm text-primary flex-1">
                    {stepIndex + 1}. {step.question}
                  </div>
                  {isRedFlag && <StatusBadge variant="destructive">Red flag</StatusBadge>}
                </div>
                {step.answerFormat === "options" && options.length > 0 && (
                  <div className="grid gap-2 mt-3">
                    {options.map((option) => {
                      const active = selected === option.id;
                      const showCorrect = submitted && option.id === step.correctOptionId;
                      const showWrong = submitted && active && !isCorrect;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={submitted}
                          onClick={() => setAnswers((current) => ({ ...current, [stepIndex]: option.id }))}
                          className={cn(
                            "text-left text-sm rounded-lg border px-3 py-2 transition-colors",
                            active ? "border-accent bg-accent/10" : "border-border hover:bg-muted/40",
                            showCorrect && "border-success bg-success/10",
                            showWrong && "border-destructive bg-destructive/10",
                          )}
                        >
                          {option.text}
                        </button>
                      );
                    })}
                  </div>
                )}
                {step.answerFormat === "text" && (
                  <div className="mt-3">
                    <textarea
                      disabled={submitted}
                      placeholder="Введите ваш ответ..."
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-card resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-accent"
                      value={typeof answers[stepIndex] === "string" ? answers[stepIndex] : ""}
                      onChange={(e) => setAnswers((current) => ({ ...current, [stepIndex]: e.target.value }))}
                    />
                    {submitted && step.referenceAnswer && (
                      <p className="text-xs mt-2 text-muted-foreground">
                        Эталонный ответ: {step.referenceAnswer}
                      </p>
                    )}
                  </div>
                )}
                {submitted && step.answerFormat === "options" && (
                  <p className={cn("text-xs mt-3", isCorrect ? "text-success" : "text-destructive")}>
                    {isCorrect ? "Верно." : "Неправильный ответ."}
                    {step.referenceAnswer && ` ${step.referenceAnswer}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {!submitted && (
            <Button onClick={() => setSubmitted(true)} disabled={!canSubmit} className="bg-primary hover:bg-primary/90">
              Проверить ответы
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" /> Пройти заново
          </Button>
        </div>
      </Card>

      {submitted && (
        <Card className="p-5 shadow-card bg-ai-soft border-ai/20">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-ai-soft-foreground shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display font-bold text-ai-soft-foreground">Разбор завершён</h3>
              <p className="text-sm text-ai-soft-foreground/90 mt-1">
                {finalScore >= 80
                  ? "Хорошая работа: логика кейса в целом собрана правильно."
                  : "Повторите книгу БФЛ по имуществу, неснимаемым долгам и этапам судебной процедуры."}
              </p>
              <Button onClick={() => navigate("/bfl-book")} variant="outline" className="mt-3 bg-card">
                Открыть книгу БФЛ
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function CaseTraining() {
  const [selectedCase, setSelectedCase] = useState<CaseTemplateDto | null>(null);

  const { data: cases, isFetching, isError, isLoading } = useQuery({
    queryKey: ["caseTemplates"],
    queryFn: frontendApi.getCaseTemplates,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
        <BackButton label="Назад к режимам" fallback="/modes" />
        <ApiState isFetching loadingText="Загружаем кейсы..." />
      </div>
    );
  }

  if (isError || !cases) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
        <BackButton label="Назад к режимам" fallback="/modes" />
        <ApiState isError errorText="Не удалось загрузить кейсы. Попробуйте позже." />
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
        <BackButton label="Назад к режимам" fallback="/modes" />
        <ApiState isEmpty emptyText="Пока нет доступных кейсов для тренировки." />
      </div>
    );
  }

  if (selectedCase) {
    return <CaseQuiz caseData={selectedCase} />;
  }

  if (cases.length === 1) {
    return <CaseQuiz caseData={cases[0]} />;
  }

  return (
    <>
      {isFetching && <ApiState isFetching loadingText="Обновляем список кейсов..." />}
      <CaseSelection cases={cases} onSelect={setSelectedCase} />
    </>
  );
}
