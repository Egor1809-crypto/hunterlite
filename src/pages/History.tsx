import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { frontendApi, frontendFallbacks, useApiData } from "@/lib/frontend-api";
import { FileClock, Search, ExternalLink } from "lucide-react";

export default function History() {
  const { data: history, isFetching, isError } = useApiData({
    queryKey: ["training-history"],
    request: frontendApi.trainingHistory,
    fallback: frontendFallbacks.trainingHistory,
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-start gap-4">
        <IconBadge icon={FileClock} />
        <div>
          <h1 className="font-display text-3xl font-bold text-primary tracking-tight">История тренировок</h1>
          <p className="text-muted-foreground mt-1">Все ваши сессии, экзамены и тесты.</p>
        </div>
      </div>

      <ApiState
        isFetching={isFetching}
        isError={isError}
        isEmpty={history.length === 0}
        emptyText="История пока пустая. После первой тренировки здесь появятся результаты."
      />

      <Card className="p-4 mb-4 shadow-card flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск по теме…" className="pl-9" />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option>Все режимы</option><option>Тренировка</option><option>Экзамен</option><option>Чат-тест</option>
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option>За месяц</option><option>За неделю</option><option>За всё время</option>
        </select>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-semibold">Дата</th>
                <th className="text-left p-3 font-semibold">Режим</th>
                <th className="text-left p-3 font-semibold">Тема</th>
                <th className="text-left p-3 font-semibold">Балл</th>
                <th className="text-left p-3 font-semibold">Статус</th>
                <th className="text-right p-3 font-semibold">Действие</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-muted-foreground tabular-nums"><span className="text-pixel-inline text-pixel-inline-muted">{h.date}</span></td>
                  <td className="p-3">{h.mode}</td>
                  <td className="p-3 font-medium">{h.topic}</td>
                  <td className="p-3 font-semibold tabular-nums"><span className="text-pixel-inline">{h.score}</span></td>
                  <td className="p-3">
                    <StatusBadge variant={h.status === "Не сдан" ? "destructive" : h.status === "Сдан" ? "success" : "info"}>
                      {h.status}
                    </StatusBadge>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/session/result?sessionId=${encodeURIComponent(h.id)}`}>
                        <ExternalLink className="h-4 w-4 mr-1.5" /> Открыть разбор
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
