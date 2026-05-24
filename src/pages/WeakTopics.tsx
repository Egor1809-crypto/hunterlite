import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { useQuery } from "@tanstack/react-query";
import { frontendApi } from "@/lib/frontend-api";
import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function WeakTopics() {
  const { data: weakTopics, isFetching, isError, isLoading } = useQuery({
    queryKey: ["weak-topics"],
    queryFn: frontendApi.weakTopics,
  });

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Загрузка...</div>;
  }

  const topics = weakTopics ?? [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-start gap-4">
        <IconBadge icon={AlertTriangle} />
        <div>
          <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Слабые темы</h1>
          <p className="text-muted-foreground mt-1">Темы с наибольшим процентом ошибок. Повторите их перед экзаменом.</p>
        </div>
      </div>

      <ApiState
        isFetching={isFetching}
        isError={isError}
        isEmpty={topics.length === 0}
        emptyText="Слабых тем пока нет. После тренировок здесь появятся зоны роста."
      />

      <div className="space-y-3">
        {topics.map((w) => (
          <Card key={w.topic} className="p-5 shadow-card">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-primary">{w.topic}</h3>
                  <StatusBadge variant={w.errors > 30 ? "destructive" : "warning"}>
                    <span className="font-extrabold tabular-nums">{w.errors}%</span> ошибок
                  </StatusBadge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-ai-soft-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> {w.recommendation}
                </div>
                <Progress value={100 - w.errors} className="h-1.5 mt-3" />
              </div>
              <Button asChild className="bg-primary hover:bg-primary/90 shrink-0">
                <Link to="/session/setup?mode=talk"><RotateCcw className="h-4 w-4 mr-1.5" /> Повторить тему</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
