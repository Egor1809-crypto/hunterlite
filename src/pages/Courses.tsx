import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { IconBadge } from "@/components/IconBadge";
import { frontendApi } from "@/lib/frontend-api";
import {
  GraduationCap, BookOpen, Clock, CheckCircle2, Lock, ArrowRight,
  Scale, Home, FileText, AlertTriangle, Shield, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const topicIcons: Record<string, { icon: typeof Scale; color: string; iconBg: string }> = {
  "Основания для банкротства": { icon: Scale, color: "text-emerald-500", iconBg: "bg-emerald-500/15" },
  "Имущество должника": { icon: Home, color: "text-blue-500", iconBg: "bg-blue-500/15" },
  "Долги, которые не списываются": { icon: AlertTriangle, color: "text-amber-500", iconBg: "bg-amber-500/15" },
  "Последствия процедуры": { icon: FileText, color: "text-violet-500", iconBg: "bg-violet-500/15" },
  "Коммуникация с клиентом": { icon: Shield, color: "text-slate-400", iconBg: "bg-slate-500/15" },
};

const defaultIcon = { icon: BookOpen, color: "text-primary", iconBg: "bg-primary/15" };

type CourseStatus = "available" | "in_progress" | "completed" | "locked";

const statusConfig = {
  completed: { label: "Пройден", variant: "success" as const, icon: CheckCircle2 },
  in_progress: { label: "В процессе", variant: "info" as const, icon: BookOpen },
  available: { label: "Доступен", variant: "warning" as const, icon: ArrowRight },
  locked: { label: "Заблокирован", variant: "muted" as const, icon: Lock },
};

export default function Courses() {
  const { data: sessionOptions, isLoading: loadingOptions } = useQuery({
    queryKey: ["sessionOptions"],
    queryFn: () => frontendApi.sessionOptions(),
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["trainingHistory"],
    queryFn: () => frontendApi.trainingHistory(),
  });

  const isLoading = loadingOptions || loadingHistory;

  const courses = (sessionOptions?.topics ?? []).map((topic, idx) => {
    const topicHistory = (history ?? []).filter((h) => h.topic === topic);
    const completedSessions = topicHistory.filter((h) => h.status === "Сдан" || h.status === "Завершено").length;
    const totalNeeded = 5;
    const progress = Math.min(100, Math.round((completedSessions / totalNeeded) * 100));

    let status: CourseStatus = "available";
    if (progress >= 100) status = "completed";
    else if (progress > 0) status = "in_progress";

    const iconConfig = topicIcons[topic] ?? defaultIcon;

    return {
      id: `topic-${idx}`,
      title: topic,
      progress,
      status,
      sessionsCompleted: completedSessions,
      ...iconConfig,
    };
  });

  const completedCount = courses.filter((c) => c.status === "completed").length;
  const overallProgress = courses.length > 0
    ? Math.round(courses.reduce((s, c) => s + c.progress, 0) / courses.length)
    : 0;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
        <div className="flex items-start gap-4">
          <IconBadge icon={GraduationCap} />
          <div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Курсы подготовки</h1>
            <p className="text-muted-foreground mt-1">
              Пройдите обучение перед тренировками и экзаменами.
            </p>
          </div>
        </div>
        <Card className="p-8 shadow-card text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground mt-4">Курсы пока не добавлены. Обратитесь к руководителю.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconBadge icon={GraduationCap} />
          <div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Курсы подготовки</h1>
            <p className="text-muted-foreground mt-1">
              Пройдите обучение перед тренировками и экзаменами. Каждый курс — практические знания для работы с клиентами.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-5 shadow-card">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{completedCount}/{courses.length}</div>
              <div className="text-xs text-muted-foreground">Курсов пройдено</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{courses.length}</div>
              <div className="text-xs text-muted-foreground">Тем всего</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{overallProgress}%</div>
              <div className="text-xs text-muted-foreground">Общий прогресс</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {courses.map((course) => {
          const cfg = statusConfig[course.status];
          const isLocked = course.status === "locked";

          return (
            <Card
              key={course.id}
              className={cn(
                "p-5 shadow-card rounded-2xl transition-all",
                isLocked ? "opacity-60" : "card-hover",
              )}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0", course.iconBg)}>
                  <course.icon className={cn("h-6 w-6", course.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display font-bold text-lg text-primary">{course.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {course.sessionsCompleted} тренировок завершено
                      </p>
                    </div>
                    <StatusBadge variant={cfg.variant}>
                      <cfg.icon className="h-3 w-3 mr-1" />
                      {cfg.label}
                    </StatusBadge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    {course.progress > 0 && course.status !== "completed" && (
                      <div className="flex items-center gap-2 flex-1 min-w-[120px] max-w-[200px]">
                        <Progress value={course.progress} className="h-1.5" />
                        <span className="text-xs font-semibold text-muted-foreground">{course.progress}%</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="sm:self-center shrink-0 w-full sm:w-[150px]">
                  {!isLocked && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-xl w-full justify-center h-9"
                    >
                      <Link to={`/session/setup?topic=${encodeURIComponent(course.title)}`}>
                        {course.status === "completed" ? "Повторить" : course.status === "in_progress" ? "Продолжить" : "Начать"}
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Link>
                    </Button>
                  )}
                  {isLocked && (
                    <Button variant="outline" size="sm" disabled className="rounded-xl w-full justify-center h-9">
                      <Lock className="h-4 w-4 mr-1.5" />
                      Недоступен
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
