import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { frontendApi } from "@/lib/frontend-api";
import { Lock, Check, BookOpen, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function RemedialCourse() {
  const { data: weakTopics, isLoading } = useQuery({
    queryKey: ["weakTopics"],
    queryFn: () => frontendApi.weakTopics(),
  });

  const { data: history } = useQuery({
    queryKey: ["trainingHistory"],
    queryFn: () => frontendApi.trainingHistory(),
  });

  const tasks = (weakTopics ?? []).map((wt) => {
    const completed = (history ?? []).some(
      (h) => h.topic === wt.topic && (h.status === "Сдан" || h.status === "Завершено"),
    );
    return {
      id: wt.id,
      title: `Пройти тренировку по теме: ${wt.topic}`,
      topic: wt.topic,
      done: completed,
    };
  });

  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
        <BackButton label="Назад к результату" fallback="/session/result" className="mb-4" />
        <Card className="p-8 shadow-card text-center">
          <Check className="h-12 w-12 text-success mx-auto" />
          <h2 className="font-display text-2xl font-bold text-primary mt-4">Слабых тем не найдено</h2>
          <p className="text-muted-foreground mt-2">Вы можете перейти к экзамену.</p>
          <Button asChild className="mt-6 bg-primary hover:bg-primary/90">
            <Link to="/modes">Перейти к режимам</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <BackButton label="Назад к результату" fallback="/session/result" className="mb-4" />

      <Card className="p-6 md:p-8 bg-gradient-to-br from-warning-soft to-warning-soft/40 border-warning/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <IconBadge icon={BookOpen} className="bg-warning text-warning-foreground" />
            <div>
              <StatusBadge variant="destructive">Экзамен не сдан</StatusBadge>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-warning-soft-foreground mt-3 tracking-tight">
                Назначен курс подготовки
              </h1>
              <p className="text-warning-soft-foreground/80 mt-2 max-w-xl">
                Чтобы получить право на пересдачу экзамена, выполните все задания подготовки. Мы подобрали их по вашим слабым темам.
              </p>
            </div>
          </div>
          <div className="text-center md:text-right">
            <div className="text-xs uppercase tracking-wider text-warning-soft-foreground/70 font-semibold">Прогресс</div>
            <div className="text-pixel-number text-5xl mt-1 tabular-nums">{pct}%</div>
            <div className="text-sm text-warning-soft-foreground/80">Выполнено {done} из {total} заданий</div>
          </div>
        </div>
        <Progress value={pct} className="h-2 mt-6" />
      </Card>

      <Card className="p-5 mt-4 shadow-card">
        <h3 className="font-display font-bold text-primary mb-4">Задания курса</h3>
        <div className="space-y-2">
          {tasks.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                t.done ? "bg-success-soft/30 border-success/20" : "bg-card border-border"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                  t.done ? "bg-success text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {t.done ? <Check className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.done ? "Выполнено" : "Не начато"}
                  </div>
                </div>
              </div>
              {!t.done && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/session/setup?topic=${encodeURIComponent(t.topic)}`}>Начать</Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
        <Button variant="outline" asChild><Link to="/dashboard">В кабинет</Link></Button>
        <Button asChild={allDone} disabled={!allDone} className="bg-primary hover:bg-primary/90 disabled:opacity-50">
          {allDone ? (
            <Link to="/modes">Пересдать экзамен</Link>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-1.5" />
              Пересдать экзамен
            </>
          )}
        </Button>
      </div>
      {!allDone && (
        <p className="text-xs text-muted-foreground text-right mt-2">
          Кнопка станет активной после выполнения всех заданий.
        </p>
      )}
    </div>
  );
}
