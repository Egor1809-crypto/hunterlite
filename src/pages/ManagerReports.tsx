import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { frontendApi, frontendFallbacks, useApiData } from "@/lib/frontend-api";
import { passingScore } from "@/lib/training-logic";
import { AlertTriangle, BarChart3, Download, ListChecks } from "lucide-react";

export default function ManagerReports() {
  const { data: report, isFetching, isError } = useApiData({
    queryKey: ["manager-reports"],
    request: frontendApi.managerReports,
    fallback: frontendFallbacks.managerReports,
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <BackButton label="Назад к обзору команды" fallback="/manager" />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconBadge icon={BarChart3} />
          <div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Отчёты</h1>
            <p className="text-muted-foreground mt-1">
              {isError ? "Показаны резервные данные." : isFetching ? "Обновляем статистику команды..." : `Период: ${report.periodLabel}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={report.periodLabel} disabled>
            <option>{report.periodLabel}</option>
          </select>
          <Button className="bg-primary hover:bg-primary/90"><Download className="h-4 w-4 mr-1.5" /> Экспорт XLSX</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { l: "Сдали экзамен", v: String(report.summary.passedExams) },
          { l: "Не сдали", v: String(report.summary.failedExams) },
          { l: "На проверке", v: String(report.summary.reviewExams) },
          { l: "Средний балл", v: String(report.summary.avgScore) },
          { l: "Тренировок", v: String(report.summary.completedTrainings) },
          { l: "Активных", v: String(report.summary.activeEmployees) },
        ].map((s) => (
          <Card key={s.l} className="p-4 shadow-card">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{s.l}</div>
            <div className="text-pixel-number text-3xl mt-1 tabular-nums">{s.v}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5 shadow-card">
        <h3 className="font-display font-bold text-primary mb-4">Распределение баллов</h3>
        <div className="space-y-3">
          {report.scoreDistribution.map((d) => (
            <div key={d.range}>
              <div className="flex justify-between text-sm mb-1">
                <span>{d.range}</span>
                <StatusBadge variant={d.status}>{d.percent}% / {d.employees} чел.</StatusBadge>
              </div>
              <Progress value={d.percent} className="h-2" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 shadow-card">
        <h3 className="font-display font-bold text-primary mb-4">Слабые темы команды</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {report.weakTopics.map((w) => (
            <div key={w.topic} className="p-3 rounded-lg bg-warning-soft/40 border border-warning/20">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{w.topic}</span>
                <StatusBadge variant="warning">{w.errors} ошибок</StatusBadge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{w.recommendation}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-3">
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-display font-bold text-primary">Зона внимания</h3>
          </div>
          <div className="space-y-2">
            {report.attention.length ? report.attention.map((item) => (
              <div key={item.employeeId} className="grid sm:grid-cols-[1fr_auto] gap-2 p-3 rounded-lg border bg-card">
                <div>
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.issue}</div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <StatusBadge variant={item.score >= passingScore ? "warning" : "destructive"}>{item.score} баллов</StatusBadge>
                  <span className="text-xs text-muted-foreground">{item.action}</span>
                </div>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground">Критичных отклонений по команде нет.</div>
            )}
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="h-4 w-4 text-success" />
            <h3 className="font-display font-bold text-primary">Рекомендации</h3>
          </div>
          <div className="space-y-2">
            {report.recommendations.map((recommendation) => (
              <div key={recommendation} className="text-sm p-3 rounded-lg border bg-muted/30">
                {recommendation}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
