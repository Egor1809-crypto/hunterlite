import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { useDemoAuth } from "@/lib/demo-auth";
import { frontendApi, frontendFallbacks, useApiData } from "@/lib/frontend-api";
import { mergeNotifications, useLiveNotifications } from "@/lib/live-notifications";
import {
  MessageSquare, GraduationCap, ListChecks, RotateCcw,
  TrendingUp, Calendar, Sparkles, AlertTriangle, ArrowRight, Home,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function Dashboard() {
  const { user: authUser } = useDemoAuth();
  const { data: dashboard, isFetching, isError } = useApiData({
    queryKey: ["dashboard", authUser.role],
    request: () => frontendApi.dashboard(authUser.role),
    fallback: () => frontendFallbacks.dashboard(authUser.role),
  });
  
  const { data: scripts, isFetching: isFetchingScripts } = useApiData({
    queryKey: ["call-scripts"],
    request: () => frontendApi.getTrainingCallScripts(),
    fallback: () => [],
  });

  const { user, weakTopics, notifications: baseNotifications, lastSession, nextTask } = dashboard;
  const { data: liveNotifications } = useLiveNotifications(baseNotifications);
  const weakestTopic = weakTopics[0];
  
  // Создаем динамическое уведомление для нового скрипта, если он есть
  const dynamicNotifications = mergeNotifications(baseNotifications, liveNotifications);
  if (scripts && scripts.length > 0) {
    const latestScript = scripts[scripts.length - 1];
    dynamicNotifications.unshift({
      id: "script-notif-" + latestScript.id,
      tone: "warning",
      title: "Назначен новый тест-скрипт",
      body: `Вам назначен новый скрипт: «${latestScript.title}». Рекомендуется пройти его сегодня.`,
      time: "Только что",
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconBadge icon={Home} />
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight">
              Здравствуйте, {user.firstName}
            </h1>
            <p className="text-muted-foreground mt-1.5">
              Сегодня хороший день, чтобы потренировать сложный кейс. NAVI-клиент уже ждёт.
            </p>
          </div>
        </div>
        <StatusBadge variant="success" dot className="text-sm py-1.5 px-3">
          {user.status === "Допущен" ? "Допущен к консультациям" : user.status}
        </StatusBadge>
      </div>

      <ApiState isFetching={isFetching} isError={isError} />

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { to: "/session/setup?mode=talk", icon: MessageSquare, title: "Поговорить с NAVI-клиентом", accent: "bg-accent text-accent-foreground" },
          { to: "/session/setup?mode=exam", icon: GraduationCap, title: "Начать экзамен", accent: "bg-primary text-primary-foreground" },
          { to: "/session/setup?mode=chat", icon: ListChecks, title: "Пройти тест", accent: "bg-ai text-ai-foreground" },
          { to: "/weak-topics", icon: RotateCcw, title: "Повторить слабые темы", accent: "bg-card text-foreground border border-border" },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="group">
            <div className={`${a.accent} rounded-xl p-4 h-full flex flex-col justify-between shadow-card hover:shadow-elevated transition-all hover:-translate-y-0.5`}>
              <a.icon className="h-5 w-5 mb-6 opacity-90" />
              <div className="flex items-end justify-between gap-2">
                <span className="font-semibold text-sm leading-tight">{a.title}</span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Средний балл" value={user.avgScore} suffix="/100" icon={TrendingUp} sub="+4 за неделю" subVariant="success" />
        <StatCard label="Экзамен" value={user.examPassed ? "Сдан" : "Не сдан"} icon={GraduationCap} sub="76/100 · 28.04" subVariant={user.examPassed ? "muted" : "warning"} />
        <StatCard label="Тренировок за неделю" value={user.weeklyTrainings} icon={Calendar} sub="Норма выполнена" subVariant="success" />
        <StatCard label="Слабая тема" value={weakestTopic?.topic.split(" ")[0] || "Нет"} icon={AlertTriangle} sub={weakestTopic ? `${weakestTopic.errors}% ошибок` : "Без ошибок"} subVariant="warning" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Last session */}
        <Card className="p-5 lg:col-span-2 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg text-primary">Последняя тренировка</h3>
            <Link to="/history" className="text-xs text-accent hover:underline">Вся история →</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Тема:</span>
                <span className="font-medium">{lastSession.topic}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Режим:</span>
                <span className="font-medium">{lastSession.mode}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Балл:</span>
                <span className="text-pixel-inline text-success">{lastSession.score}<span className="text-pixel-inline-muted">/100</span></span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Дата:</span>
                <span>{lastSession.date}</span>
              </div>
            </div>
            <div className="bg-ai-soft rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-ai-soft-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-ai-soft-foreground">NAVI-рекомендация</span>
              </div>
              <p className="text-sm text-ai-soft-foreground">
                Повторите блок про имущество должника — особенно нюансы с ипотечным жильём. Это ваша зона роста.
              </p>
            </div>
          </div>
        </Card>

        {/* Next task */}
        <Card className="p-5 shadow-card bg-gradient-hero text-white border-0 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wider text-white/60 font-semibold">Ближайшая задача</div>
            <h3 className="font-display font-bold text-xl mt-2 leading-tight">
              {nextTask.title}
            </h3>
            <p className="text-sm text-white/70 mt-2">
              Назначен экзамен. Срок — {nextTask.dueDate}.
            </p>
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-white/70">
                <span>Готовность</span><span className="text-pixel-inline">{nextTask.readiness}<span className="text-pixel-inline-muted">%</span></span>
              </div>
              <Progress value={nextTask.readiness} className="h-1.5" />
            </div>
            <Button asChild className="mt-5 w-full bg-white text-slate-950 hover:bg-white/90">
              <Link to="/session/setup?mode=exam">Подготовиться</Link>
            </Button>
          </div>
        </Card>
      </div>

      {scripts && scripts.length > 0 && (
        <div className="mb-6">
          <h3 className="font-display font-bold text-xl text-primary mb-4">Назначенные вам тесты и скрипты</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scripts.map(s => (
              <Card key={s.id} className="p-5 shadow-card flex flex-col justify-between border-l-4 border-l-primary">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Обязательно</div>
                  <h4 className="font-bold text-lg mb-2 leading-tight">{s.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    Клиент: {s.clientProfile?.name || "Не указан"}. 
                    {s.nodes?.length ? ` Шагов: ${s.nodes.length}` : ""}
                  </p>
                </div>
                <Button asChild className="mt-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link to={`/session/chat-test?scriptId=${s.id}`}>Пройти тест</Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Weak topics */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg text-primary">Слабые темы</h3>
            <Link to="/weak-topics" className="text-xs text-accent hover:underline">Все темы →</Link>
          </div>
          <div className="space-y-3">
            {weakTopics.map((w) => (
              <div key={w.topic} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{w.topic}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{w.recommendation}</div>
                </div>
                <StatusBadge variant={w.errors > 30 ? "destructive" : "warning"}>
                  <span className="text-pixel-inline">{w.errors}<span className="text-pixel-inline-muted">% </span></span>ошибок
                </StatusBadge>
              </div>
            ))}
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg text-primary">Уведомления</h3>
            <Link to="/notifications" className="text-xs text-accent hover:underline">Все →</Link>
          </div>
          <div className="space-y-3">
            {dynamicNotifications.map((n) => (
              <div key={n.id} className="flex gap-3 p-3 rounded-lg border border-border">
                <div className="mt-0.5">
                  <StatusBadge variant={n.tone} dot> </StatusBadge>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-1">{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

type StatusBadgeVariant = React.ComponentProps<typeof StatusBadge>["variant"];

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  sub,
  subVariant,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  sub?: string;
  subVariant?: StatusBadgeVariant;
}) {
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={typeof value === "number" || /^\d/.test(String(value)) ? "text-pixel-number text-2xl" : "font-display text-2xl font-bold text-primary"}>
          {value}
        </span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {sub && (
        <div className="mt-2">
          <StatusBadge variant={subVariant}>{sub}</StatusBadge>
        </div>
      )}
    </Card>
  );
}
