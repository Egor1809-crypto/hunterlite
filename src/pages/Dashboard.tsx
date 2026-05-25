import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiState } from "@/components/ApiState";
import { frontendApi } from "@/lib/frontend-api";
import { mergeNotifications, useLiveNotifications } from "@/lib/live-notifications";
import {
  MessageSquare, GraduationCap, RotateCcw, BriefcaseBusiness,
  TrendingUp, Calendar, AlertTriangle, ArrowRight,
  Sparkles, Zap, Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function Dashboard() {
  const { data: dashboard, isFetching, isError, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => frontendApi.dashboard(),
  });

  const { data: scripts } = useQuery({
    queryKey: ["call-scripts"],
    queryFn: () => frontendApi.getTrainingCallScripts(),
  });

  const { data: liveNotifications } = useLiveNotifications(dashboard?.notifications);

  if (isLoading || !dashboard) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-ai animate-pulse-soft" />
          <span className="text-sm text-muted-foreground">Загрузка...</span>
        </div>
      </div>
    );
  }

  const { user, weakTopics, notifications: baseNotifications, lastSession, nextTask } = dashboard;

  const dynamicNotifications = mergeNotifications(baseNotifications, liveNotifications ?? []);
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Hero greeting ── */}
      <div className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-ai flex items-center justify-center text-white shadow-glow shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-[2.5rem] font-bold text-primary tracking-tight">
                Здравствуйте, {user.firstName}
              </h1>
              <p className="text-muted-foreground mt-1 text-[15px]">
                Ваш кабинет обучения и аттестации
              </p>
            </div>
          </div>
        </div>
        <div className="section-divider mt-6" />
      </div>

      <ApiState isFetching={isFetching} isError={isError} />

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-in">
        {[
          { to: "/session/setup?mode=talk", icon: MessageSquare, title: "Поговорить с ИИ-клиентом", accent: "from-blue-500/90 to-indigo-600/90", glow: "hsl(217 91% 60% / 0.3)" },
          { to: "/session/setup?mode=exam", icon: GraduationCap, title: "Начать экзамен", accent: "from-slate-700/95 to-slate-900/95", glow: "hsl(222 47% 20% / 0.3)" },
          { to: "/session/cases", icon: BriefcaseBusiness, title: "Кейсы", accent: "from-amber-500/90 to-orange-600/90", glow: "hsl(38 92% 50% / 0.3)" },
          { to: "/weak-topics", icon: RotateCcw, title: "Повторить слабые темы", accent: "from-emerald-500/90 to-teal-600/90", glow: "hsl(160 84% 39% / 0.3)" },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="group">
            <div
              className="relative rounded-2xl p-5 h-full flex flex-col justify-between text-white overflow-hidden card-hover"
              style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))`, boxShadow: `0 4px 24px ${a.glow}` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${a.accent}`} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(0_0%_100%_/_0.12),_transparent_60%)]" />
              <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-8">
                  <a.icon className="h-5 w-5" />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <span className="font-semibold text-sm leading-tight">{a.title}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-70 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-in">
        <StatCard label="Средний балл" value={user.avgScore} suffix="/100" icon={TrendingUp} />
        <StatCard label="Экзамен" value={user.examPassed ? "Сдан" : "Не сдан"} icon={GraduationCap} sub={lastSession?.mode === "Экзамен" ? `${lastSession.score}/100 · ${lastSession.date}` : undefined} subVariant={user.examPassed ? "muted" : "warning"} />
        <StatCard label="Тренировок за неделю" value={user.weeklyTrainings} icon={Calendar} sub={user.weeklyTrainings >= 3 ? "Норма выполнена" : `${user.weeklyTrainings} из 3`} subVariant={user.weeklyTrainings >= 3 ? "success" : "warning"} />
        <StatCard label="Слабая тема" value={weakTopics[0]?.topic.split(" ")[0] || "Нет"} icon={AlertTriangle} sub={weakTopics[0] ? `${weakTopics[0].errors}% ошибок` : "Без ошибок"} subVariant="warning" />
      </div>

      {/* ── Main content row ── */}
      <div className="grid lg:grid-cols-3 gap-4 stagger-in">
        {/* Last session */}
        <Card className="p-6 lg:col-span-2 glass-card-solid rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-display font-bold text-lg text-primary">Последняя тренировка</h3>
            </div>
            <Link to="/history" className="text-xs font-semibold text-accent hover:underline">Вся история →</Link>
          </div>
          {lastSession ? (
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 shrink-0">Тема</span>
                  <span className="font-medium">{lastSession.topic}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 shrink-0">Режим</span>
                  <span className="font-medium">{lastSession.mode}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 shrink-0">Балл</span>
                  <span className="text-pixel-inline text-success">{lastSession.score}<span className="text-pixel-inline-muted">/100</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 shrink-0">Дата</span>
                  <span>{lastSession.date}</span>
                </div>
              </div>
              {weakTopics[0] && (
                <div className="bg-muted/40 rounded-xl p-4 border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Рекомендация</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {weakTopics[0].recommendation}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Нет данных о последней тренировке.</div>
          )}
        </Card>

        {/* Next task */}
        <Card className="relative p-6 rounded-2xl bg-gradient-hero text-white border-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(217_91%_60%_/_0.2),_transparent_60%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="relative">
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-bold">Ближайшая задача</div>
            <h3 className="font-display font-bold text-xl mt-3 leading-tight">
              {nextTask?.title ?? "Нет задач"}
            </h3>
            {nextTask && (
              <>
                <p className="text-sm text-white/60 mt-2">
                  {nextTask.title}. Срок — {nextTask.dueDate}.
                </p>
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>Готовность</span><span className="text-pixel-inline">{nextTask.readiness}<span className="text-pixel-inline-muted">%</span></span>
                  </div>
                  <Progress value={nextTask.readiness} className="h-1.5" />
                </div>
              </>
            )}
            <Button asChild className="mt-6 w-full bg-white text-slate-950 hover:bg-white/90 font-bold rounded-xl h-11">
              <Link to="/session/setup?mode=exam">Подготовиться</Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* ── Assigned scripts ── */}
      {scripts && scripts.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Target className="h-4 w-4 text-primary-foreground" />
            </div>
            <h3 className="font-display font-bold text-xl text-primary">Назначенные вам тесты и скрипты</h3>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-in">
            {scripts.map(s => (
              <Card key={s.id} className="p-5 glass-card-solid rounded-2xl flex flex-col justify-between border-l-4 border-l-primary">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-1">Обязательно</div>
                  <h4 className="font-bold text-lg mb-2 leading-tight">{s.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    Клиент: {s.clientProfile?.name || "Не указан"}.
                    {s.nodes?.length ? ` Шагов: ${s.nodes.length}` : ""}
                  </p>
                </div>
                <Button asChild className="mt-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-10">
                  <Link to={`/session/talk?scriptId=${s.id}`}>Пройти тест</Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}


      {/* ── Bottom row ── */}
      <div className="grid lg:grid-cols-2 gap-4 stagger-in">
        {/* Weak topics */}
        <Card className="p-6 glass-card-solid rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              <h3 className="font-display font-bold text-lg text-primary">Слабые темы</h3>
            </div>
            <Link to="/weak-topics" className="text-xs font-semibold text-accent hover:underline">Все темы →</Link>
          </div>
          <div className="space-y-2">
            {weakTopics.length === 0 && (
              <div className="text-sm text-muted-foreground">Нет данных</div>
            )}
            {weakTopics.map((w) => (
              <div key={w.topic} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 hover:bg-muted/30 hover:border-border transition-all duration-200">
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
        <Card className="p-6 glass-card-solid rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-ai/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-ai" />
              </div>
              <h3 className="font-display font-bold text-lg text-primary">Уведомления</h3>
            </div>
            <Link to="/notifications" className="text-xs font-semibold text-accent hover:underline">Все →</Link>
          </div>
          <div className="space-y-2">
            {dynamicNotifications.length === 0 && (
              <div className="text-sm text-muted-foreground">Нет уведомлений</div>
            )}
            {dynamicNotifications.map((n) => (
              <div key={n.id} className="flex gap-3 p-3 rounded-xl border border-border/60 hover:bg-muted/30 hover:border-border transition-all duration-200">
                <div className="mt-0.5">
                  <StatusBadge variant={n.tone} dot> </StatusBadge>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div>
                  <div className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium">{n.time}</div>
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
    <Card className="p-5 glass-card-solid rounded-2xl group">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.12em]">{label}</span>
        <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center group-hover:bg-muted transition-colors">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={typeof value === "number" || /^\d/.test(String(value)) ? "text-pixel-number text-3xl" : "font-display text-2xl font-bold text-primary"}>
          {value}
        </span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {sub && (
        <div className="mt-2.5">
          <StatusBadge variant={subVariant}>{sub}</StatusBadge>
        </div>
      )}
    </Card>
  );
}
