import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { BarChart3, Download } from "lucide-react";

const dist = [
  { range: "0–40", v: 5, c: "destructive" },
  { range: "40–60", v: 12, c: "destructive" },
  { range: "60–70", v: 18, c: "warning" },
  { range: "70–85", v: 35, c: "success" },
  { range: "85–100", v: 30, c: "success" },
] satisfies Array<{ range: string; v: number; c: React.ComponentProps<typeof StatusBadge>["variant"] }>;

export default function ManagerReports() {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <BackButton label="Назад к обзору команды" fallback="/manager" />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconBadge icon={BarChart3} />
          <div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Отчёты</h1>
            <p className="text-muted-foreground mt-1">Выгрузка статистики команды по периодам.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option>Апрель 2026</option><option>Март 2026</option><option>Q1 2026</option>
          </select>
          <Button className="bg-primary hover:bg-primary/90"><Download className="h-4 w-4 mr-1.5" /> Экспорт XLSX</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "Сдали экзамен", v: "18" },
          { l: "Не сдали", v: "3" },
          { l: "На пересдаче", v: "3" },
          { l: "Средний балл", v: "78" },
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
          {dist.map((d) => (
            <div key={d.range}>
              <div className="flex justify-between text-sm mb-1">
                <span>{d.range}</span>
                <StatusBadge variant={d.c}>{d.v}% сотрудников</StatusBadge>
              </div>
              <Progress value={d.v * 2.5} className="h-2" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 shadow-card">
        <h3 className="font-display font-bold text-primary mb-4">Слабые темы команды</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { t: "Имущество должника", v: 38 },
            { t: "Ипотечное жильё", v: 34 },
            { t: "Долги без списания", v: 29 },
            { t: "Сроки процедуры", v: 22 },
          ].map((w) => (
            <div key={w.t} className="flex items-center justify-between p-3 rounded-lg bg-warning-soft/40 border border-warning/20">
              <span className="text-sm">{w.t}</span>
              <StatusBadge variant="warning">{w.v}%</StatusBadge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
