import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { frontendApi } from "@/lib/frontend-api";
import { FileClock, Search, ExternalLink } from "lucide-react";

export default function History() {
  const { data: history, isFetching, isError, isLoading } = useQuery({
    queryKey: ["training-history"],
    queryFn: frontendApi.trainingHistory,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const items = history ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((h) => {
      const matchesSearch =
        !searchQuery || h.topic.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMode = !modeFilter || h.mode === modeFilter;
      const matchesStatus = !statusFilter || h.status === statusFilter;
      return matchesSearch && matchesMode && matchesStatus;
    });
  }, [items, searchQuery, modeFilter, statusFilter]);

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Загрузка...</div>;
  }

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
        isEmpty={items.length === 0}
        emptyText="История пока пустая. После первой тренировки здесь появятся результаты."
      />

      <Card className="p-4 mb-4 shadow-card flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по теме…"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
        >
          <option value="">Все режимы</option>
          <option value="Тренировка">Тренировка</option>
          <option value="Экзамен">Экзамен</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="Завершено">Завершено</option>
          <option value="Не сдан">Не сдан</option>
          <option value="Сдан">Сдан</option>
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
              {filteredItems.map((h) => (
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
