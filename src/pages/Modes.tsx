import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { MessageSquare, GraduationCap, ArrowRight, Clock, Target, BookOpen, BriefcaseBusiness, Trophy } from "lucide-react";
import { Sparkles } from "lucide-react";

const modes = [
  {
    to: "/session/setup?mode=talk",
    icon: MessageSquare,
    title: "Поговорить",
    desc: "Свободная тренировка с ИИ-клиентом по теме банкротства физических лиц.",
    cta: "Начать тренировку",
    gradient: "from-blue-500/12 to-indigo-500/6",
    iconBg: "bg-blue-500/15 text-blue-600",
    glowColor: "hsl(217 91% 60% / 0.12)",
    borderHover: "hover:border-blue-400/30",
    meta: [{ icon: Clock, t: "10–20 мин" }, { icon: BookOpen, t: "Любая тема" }],
  },
  {
    to: "/session/setup?mode=exam",
    icon: GraduationCap,
    title: "Экзамен юриста",
    desc: "Аттестация с таймером, проходным баллом 88% и итоговым статусом допуска.",
    cta: "Начать экзамен",
    gradient: "from-slate-500/12 to-slate-700/8",
    iconBg: "bg-slate-800/15 text-slate-700",
    glowColor: "hsl(222 30% 30% / 0.1)",
    borderHover: "hover:border-slate-400/30",
    meta: [{ icon: Clock, t: "30 мин" }, { icon: Target, t: "Порог 88%" }],
  },
  {
    to: "/session/cases",
    icon: BriefcaseBusiness,
    title: "Кейсы",
    desc: "Практические ситуации: ответьте по шагам и соберите процедуру банкротства по порядку.",
    cta: "Решить кейс",
    gradient: "from-amber-500/12 to-orange-500/6",
    iconBg: "bg-amber-500/15 text-amber-600",
    glowColor: "hsl(38 92% 50% / 0.1)",
    borderHover: "hover:border-amber-400/30",
    meta: [{ icon: Clock, t: "15–25 мин" }, { icon: Target, t: "Логика + порядок" }],
  },
  {
    to: "/session/arena",
    icon: Trophy,
    title: "Арена / тесты",
    desc: "Быстрые раунды с таймером, счётом, серией правильных ответов и разбором по ключевым опорам.",
    cta: "Войти на арену",
    gradient: "from-emerald-500/12 to-green-500/6",
    iconBg: "bg-emerald-500/15 text-emerald-600",
    glowColor: "hsl(142 71% 36% / 0.1)",
    borderHover: "hover:border-emerald-400/30",
    meta: [{ icon: Clock, t: "5–10 мин" }, { icon: Target, t: "Раунды" }],
  },
];

export default function Modes() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-10 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-ai flex items-center justify-center text-white shadow-glow shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-[2.5rem] font-bold text-primary tracking-tight">Выберите режим</h1>
            <p className="text-muted-foreground mt-1 text-[15px]">Форматы тренировки: разговор, экзамен, тесты и практические кейсы.</p>
          </div>
        </div>
        <div className="section-divider mt-6" />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 stagger-in">
        {modes.map((m) => (
          <Link key={m.to} to={m.to} className="group">
            <Card
              className={`relative p-6 h-full flex flex-col rounded-2xl overflow-hidden border-border/60 ${m.borderHover} card-hover transition-all duration-350`}
              style={{ "--mode-glow-color": m.glowColor } as React.CSSProperties}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative flex flex-col h-full">
                <div className={`h-12 w-12 rounded-xl ${m.iconBg} flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110`}>
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
                <div className="flex items-center justify-between pt-4 border-t border-border/60 text-sm font-bold text-accent">
                  {m.cta}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
