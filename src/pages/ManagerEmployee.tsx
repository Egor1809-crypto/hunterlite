import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { frontendApi, frontendFallbacks, useApiData } from "@/lib/frontend-api";
import { Sparkles } from "lucide-react";

export default function ManagerEmployee() {
  const { id } = useParams();
  const { data: profile } = useApiData({
    queryKey: ["employee-profile", id || "1"],
    request: () => frontendApi.employeeProfile(id),
    fallback: () => frontendFallbacks.employeeProfile(id),
  });
  const { employee: e, history, weakTopics, strongTopics, recommendation } = profile;
  const latestResultId = history[0]?.id;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <BackButton label="Назад к команде" fallback="/manager" />

      <Card className="p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-ai text-white flex items-center justify-center text-lg font-bold">
              {e.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-primary">{e.name}</h1>
              <div className="text-sm text-muted-foreground">Юрист-консультант · банкротство физлиц</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant={e.status === "Допущен" ? "success" : "destructive"} dot>{e.status}</StatusBadge>
            <Button variant="outline" asChild disabled={!latestResultId}>
              <Link to={latestResultId ? `/session/result?sessionId=${encodeURIComponent(latestResultId)}` : "/manager"}>
                Последний разбор
              </Link>
            </Button>
            <Button className="bg-primary hover:bg-primary/90">Назначить курс</Button>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-3">
        {[
          { l: "Средний балл", v: `${e.score}/100` },
          { l: "Экзамен", v: e.exam },
          { l: "Тренировок за месяц", v: "21" },
        ].map((s) => (
          <Card key={s.l} className="p-4 shadow-card">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{s.l}</div>
            <div className={/^\d/.test(s.v) ? "text-pixel-number text-2xl mt-1" : "font-display text-2xl font-bold text-primary mt-1"}>
              {s.v}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-card">
          <h3 className="font-display font-bold text-primary mb-3">История экзаменов и тренировок</h3>
          <div className="divide-y divide-border">
            {history.slice(0, 4).map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="font-medium">{h.topic}</div>
                  <div className="text-xs text-muted-foreground"><span className="text-pixel-inline text-pixel-inline-muted">{h.date}</span> · {h.mode}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-pixel-inline tabular-nums">{h.score}</span>
                  <StatusBadge variant={h.status === "Не сдан" ? "destructive" : h.status === "Сдан" ? "success" : "info"}>
                    {h.status}
                  </StatusBadge>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/session/result?sessionId=${encodeURIComponent(h.id)}`}>Разбор</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="font-display font-bold text-primary mb-3">Слабые темы</h3>
          <div className="space-y-3">
            {weakTopics.map((w) => (
              <div key={w.topic}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{w.topic}</span><span className="text-pixel-inline">{w.errors}<span className="text-pixel-inline-muted">%</span></span>
                </div>
                <Progress value={w.errors * 2.5} className="h-1.5" />
              </div>
            ))}
          </div>
          <h3 className="font-display font-bold text-primary mt-5 mb-2">Сильные темы</h3>
          <div className="flex flex-wrap gap-2">
            {strongTopics.map((t) => (
              <StatusBadge key={t} variant="success">{t}</StatusBadge>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 bg-ai-soft border-ai/20">
        <div className="flex gap-3">
          <Sparkles className="h-5 w-5 text-ai-soft-foreground shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-ai-soft-foreground">Рекомендация AI</div>
            <p className="text-sm text-ai-soft-foreground/90 mt-1">
              {recommendation}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
