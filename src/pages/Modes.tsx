import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/IconBadge";
import { MessageSquare, GraduationCap, ListChecks, ArrowRight, Clock, Target, BookOpen, BriefcaseBusiness } from "lucide-react";

const modes = [
  {
    to: "/session/setup?mode=talk",
    icon: MessageSquare,
    title: "Поговорить",
    desc: "Свободная тренировка с ИИ-клиентом по теме банкротства физических лиц.",
    cta: "Начать тренировку",
    accent: "bg-info-soft text-info-soft-foreground",
    meta: [{ icon: Clock, t: "10–20 мин" }, { icon: BookOpen, t: "Любая тема" }],
  },
  {
    to: "/session/setup?mode=exam",
    icon: GraduationCap,
    title: "Экзамен юриста",
    desc: "Аттестация с таймером, проходным баллом 88% и итоговым статусом допуска.",
    cta: "Начать экзамен",
    accent: "bg-primary text-primary-foreground",
    meta: [{ icon: Clock, t: "30 мин" }, { icon: Target, t: "Порог 88%" }],
  },
  {
    to: "/session/setup?mode=chat",
    icon: ListChecks,
    title: "Чат: вопросы и тесты",
    desc: "Письменные вопросы, тесты и короткие клиентские кейсы для закрепления знаний.",
    cta: "Перейти к вопросам",
    accent: "bg-ai-soft text-ai-soft-foreground",
    meta: [{ icon: Clock, t: "5–15 мин" }, { icon: BookOpen, t: "10 вопросов" }],
  },
  {
    to: "/session/cases",
    icon: BriefcaseBusiness,
    title: "Кейсы",
    desc: "Практические ситуации: ответьте по шагам и соберите процедуру банкротства по порядку.",
    cta: "Решить кейс",
    accent: "bg-warning-soft text-warning-soft-foreground",
    meta: [{ icon: Clock, t: "15–25 мин" }, { icon: Target, t: "Логика + порядок" }],
  },
];

export default function Modes() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-start gap-4">
        <IconBadge icon={MessageSquare} />
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight">Выберите режим</h1>
          <p className="text-muted-foreground mt-2">Форматы тренировки: разговор, экзамен, тесты и практические кейсы.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {modes.map((m) => (
          <Link key={m.to} to={m.to} className="group">
            <Card className="p-6 h-full flex flex-col shadow-card hover:shadow-elevated transition-all hover:-translate-y-1 border-border">
              <div className={`h-12 w-12 rounded-xl ${m.accent} flex items-center justify-center mb-5`}>
                <m.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-primary">{m.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed flex-1">{m.desc}</p>
              <div className="flex flex-wrap gap-3 mt-4 mb-5">
                {m.meta.map((x) => (
                  <div key={x.t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <x.icon className="h-3.5 w-3.5" />
                    {x.t}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border text-sm font-semibold text-accent">
                {m.cta}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
