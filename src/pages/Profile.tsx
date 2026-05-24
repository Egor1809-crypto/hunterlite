import { Link } from "react-router-dom";
import { Award, Calendar, CheckCircle2, Mail, ShieldCheck, TrendingUp, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { useDemoAuth } from "@/lib/demo-auth";
import { getRoleHome } from "@/lib/demo-auth-state";
import { frontendApi } from "@/lib/frontend-api";

export default function Profile() {
  const { role } = useDemoAuth();
  const { data: profile, isFetching, isError, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => frontendApi.profile(),
  });

  const homePath = getRoleHome(role);

  if (isLoading || !profile) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Загрузка...</div>;
  }

  const { user, weakTopics } = profile;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <BackButton label="Назад" fallback={homePath} />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconBadge icon={UserRound} />
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight">
              Профиль пользователя
            </h1>
            <p className="text-muted-foreground mt-1.5">
              Данные сотрудника, статус допуска и текущий прогресс аттестации.
            </p>
          </div>
        </div>
      </div>

      <ApiState isFetching={isFetching} isError={isError} />

      <div className="grid lg:grid-cols-[360px_1fr] gap-4">
        <Card className="p-6 shadow-card">
          <div className="flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-ai flex items-center justify-center text-white text-3xl font-bold shadow-elevated">
              {user.firstName[0]}{user.name.split(" ")[1]?.[0] || ""}
            </div>
            <h2 className="font-display text-2xl font-bold text-primary mt-4">{user.name}</h2>
            <p className="text-muted-foreground">{user.roleLabel}</p>
          </div>

          <div className="mt-6 space-y-3">
            <ProfileLine icon={Mail} label="Email" value={user.email} />
            <ProfileLine icon={UserRound} label="Роль" value={user.roleLabel} />
            <ProfileLine icon={ShieldCheck} label="Доступ" value="Консультации клиентов" />
            <ProfileLine icon={Calendar} label="Активность" value="Сегодня" />
          </div>

          <Button asChild className="mt-6 w-full">
            <Link to={homePath}>Вернуться на главную</Link>
          </Button>
        </Card>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <MetricCard icon={TrendingUp} label="Средний балл" value={`${user.avgScore}/100`} />
            <MetricCard icon={Award} label="Экзамен" value={user.examPassed ? "Сдан" : "Не сдан"} />
            <MetricCard icon={CheckCircle2} label="Тренировок" value={`${user.weeklyTrainings} за неделю`} />
          </div>

          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-primary">Прогресс допуска</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Минимальный проходной балл для самостоятельных консультаций — 88/100.
                </p>
              </div>
              <StatusBadge variant="success">{user.avgScore}%</StatusBadge>
            </div>
            <Progress value={user.avgScore} className="h-2" />
          </Card>

          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-primary">Слабые темы</h3>
              <Button asChild variant="outline" size="sm">
                <Link to="/weak-topics">Открыть</Link>
              </Button>
            </div>
            <div className="space-y-3">
              {weakTopics.length === 0 && (
                <div className="text-sm text-muted-foreground">Нет данных</div>
              )}
              {weakTopics.map((topic) => (
                <div key={topic.topic} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{topic.topic}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{topic.recommendation}</div>
                  </div>
                  <StatusBadge variant={topic.errors > 30 ? "destructive" : "warning"}>
                    <span className="text-pixel-inline">{topic.errors}<span className="text-pixel-inline-muted">% </span></span>ошибок
                  </StatusBadge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground truncate">{value}</div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={/^\d/.test(value) ? "text-pixel-number text-xl mt-3" : "font-display text-xl font-bold text-primary mt-3"}>
        {value}
      </div>
    </Card>
  );
}
