import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { frontendApi } from "@/lib/frontend-api";
import { Users, CheckCircle2, XCircle, TrendingUp, GraduationCap, AlertTriangle, Search, Download, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

export default function Manager() {
  const { data: manager, isFetching, isError, isLoading } = useQuery({
    queryKey: ["manager-summary"],
    queryFn: frontendApi.managerSummary,
  });

  if (isLoading || !manager) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Загрузка...</div>;
  }

  const { employees, kpi, scoreTrend, topWeakTopics } = manager;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconBadge icon={Users} />
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Кабинет руководителя</div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight mt-1">Обзор команды</h1>
            <p className="text-muted-foreground mt-1">Допуски, экзамены и слабые темы юристов отдела.</p>
          </div>
        </div>
        <Button variant="outline"><Download className="h-4 w-4 mr-1.5" /> Экспорт отчёта</Button>
      </div>

      <ApiState
        isFetching={isFetching}
        isError={isError}
        isEmpty={employees.length === 0}
        emptyText="В команде пока нет сотрудников для отчёта."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard icon={Users} label="Сотрудников" value={String(kpi.totalEmployees)} />
        <KpiCard icon={CheckCircle2} label="Допущены" value={String(kpi.allowedEmployees)} tone="success" />
        <KpiCard icon={XCircle} label="Не допущены" value={String(kpi.blockedEmployees)} tone="destructive" />
        <KpiCard icon={TrendingUp} label="Средний балл" value={String(kpi.avgScore)} />
        <KpiCard icon={GraduationCap} label="Экзаменов / нед" value={String(kpi.weeklyExams)} />
        <KpiCard icon={AlertTriangle} label="Слабая тема №1" value={kpi.weakestTopic} small />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="p-5 lg:col-span-2 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-primary">Динамика среднего балла</h3>
            <SelectBox size="sm" options={["За 12 недель", "За месяц", "За квартал"]} />
          </div>
          <ChartContainer
            config={{
              score: {
                label: "Средний балл",
                color: "hsl(var(--accent))",
              },
            }}
            className="h-56 w-full"
          >
            <LineChart data={scoreTrend} margin={{ top: 12, right: 18, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                domain={[55, 90]}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                width={34}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--color-score)"
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--color-score)", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "var(--color-score)", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </LineChart>
          </ChartContainer>
        </Card>

        {/* Top weak */}
        <Card className="p-5 shadow-card">
          <h3 className="font-display font-bold text-primary mb-4">Топ-5 слабых тем</h3>
          <div className="space-y-3">
            {topWeakTopics.length === 0 && (
              <div className="text-sm text-muted-foreground">Нет данных</div>
            )}
            {topWeakTopics.map((x) => (
              <div key={x.topic}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{x.topic}</span><span className="text-pixel-inline tabular-nums">{x.errors}<span className="text-pixel-inline-muted">%</span></span>
                </div>
                <Progress value={x.errors * 2} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-card flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск сотрудника…" className="pl-9" />
        </div>
        <SelectBox options={["За месяц", "За неделю", "За квартал", "За всё время"]} />
        <SelectBox options={["Все статусы", "Допущен", "Не допущен", "Требуется курс"]} />
      </Card>

      {/* Employees */}
      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-semibold">Сотрудник</th>
                <th className="text-left p-3 font-semibold">Балл</th>
                <th className="text-left p-3 font-semibold">Экзамен</th>
                <th className="text-left p-3 font-semibold">Допуск</th>
                <th className="text-left p-3 font-semibold">Слабые темы</th>
                <th className="text-left p-3 font-semibold">Активность</th>
                <th className="text-right p-3 font-semibold">Действие</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const sv = e.status === "Допущен" ? "success" : e.status === "Не допущен" ? "destructive" : e.status === "Требуется курс" ? "warning" : "info";
                const ev = e.exam === "Сдан" ? "success" : e.exam === "Не сдан" ? "destructive" : "info";
                return (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-ai text-white flex items-center justify-center text-xs font-semibold">
                          {e.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <span className="font-medium">{e.name}</span>
                      </div>
                    </td>
                    <td className="p-3 font-semibold tabular-nums"><span className="text-pixel-inline">{e.score}</span></td>
                    <td className="p-3"><StatusBadge variant={ev}>{e.exam}</StatusBadge></td>
                    <td className="p-3"><StatusBadge variant={sv} dot>{e.status}</StatusBadge></td>
                    <td className="p-3 text-muted-foreground text-xs">{e.weak}</td>
                    <td className="p-3 text-muted-foreground text-xs">{e.lastActive}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/manager/employee/${e.id}`}>{e.exam === "Не сдан" ? "Назначить курс" : "Открыть"}</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SelectBox({ options, size = "default" }: { options: string[]; size?: "default" | "sm" }) {
  return (
    <div className="relative shrink-0">
      <select
        className={
          size === "sm"
            ? "h-9 w-36 appearance-none rounded-md border border-input bg-background px-4 pr-8 text-center text-xs font-medium text-foreground"
            : "h-10 w-40 appearance-none rounded-md border border-input bg-background px-4 pr-8 text-center text-sm text-foreground"
        }
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  small,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "success" | "destructive";
  small?: boolean;
}) {
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <Icon className={`h-4 w-4 ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <div className={`mt-2 tabular-nums ${/^\d/.test(String(value)) ? "text-pixel-number" : "font-display font-bold text-primary"} ${small ? "text-lg" : "text-2xl"}`}>
        {value}
      </div>
    </Card>
  );
}
