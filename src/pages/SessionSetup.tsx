import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { ApiState } from "@/components/ApiState";
import { frontendApi } from "@/lib/frontend-api";
import {
  Check,
  Sparkles,
  BookOpen,
  Gauge,
  MessageSquare,
  Users,
  ArrowRight,
  Shield,
  Flame,
  AlertTriangle,
  Eye,
  Timer,
  Mic,
  FileText,
  ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiClientCharacterDto, TrainingDifficultyDto, TrainingFormatDto, TrainingModeDto } from "@/lib/api-contracts";

const modeMap: Record<string, TrainingModeDto> = {
  talk: "talk",
  exam: "exam",
  chat: "chat_test",
};

type OptionMeta = { label: string; desc: string; icon: typeof Shield; color: string; iconBg: string };

const difficultyMeta: Record<string, OptionMeta> = {
  basic: {
    label: "Базовый",
    desc: "Клиент задаёт простые вопросы, не спорит. Мягкая оценка ответов.",
    icon: Shield,
    color: "text-emerald-500",
    iconBg: "bg-emerald-500/15",
  },
  medium: {
    label: "Средний",
    desc: "Клиент уточняет детали, иногда сомневается. Стандартная оценка.",
    icon: Gauge,
    color: "text-amber-500",
    iconBg: "bg-amber-500/15",
  },
  hard: {
    label: "Сложный",
    desc: "Юридически подкованный клиент. Ловит на противоречиях, цитирует законы. Строгая оценка.",
    icon: Flame,
    color: "text-red-500",
    iconBg: "bg-red-500/15",
  },
};

const formatMeta: Record<string, { label: string; desc: string; icon: typeof FileText }> = {
  text: { label: "Текст", desc: "Печатайте ответы в чат. Подходит для первых тренировок.", icon: FileText },
  voice: { label: "Голос", desc: "Говорите в микрофон — как настоящий звонок с клиентом.", icon: Mic },
  sequence: { label: "Последовательность", desc: "Пошаговый сценарий с чёткой структурой диалога.", icon: ListOrdered },
};

const characterMeta: Record<string, OptionMeta> = {
  anxious: {
    label: "Тревожный",
    desc: "Переживает, боится потерять всё, часто переспрашивает",
    icon: AlertTriangle,
    color: "text-amber-500",
    iconBg: "bg-amber-500/15",
  },
  aggressive: {
    label: "Агрессивный",
    desc: "Раздражён, говорит резко, требует гарантий",
    icon: Flame,
    color: "text-red-500",
    iconBg: "bg-red-500/15",
  },
  skeptical: {
    label: "Скептичный",
    desc: "Сомневается во всём, просит доказательства",
    icon: Eye,
    color: "text-blue-500",
    iconBg: "bg-blue-500/15",
  },
  distrustful: {
    label: "Недоверчивый",
    desc: "Подозревает юриста в корысти, перепроверяет мотивы",
    icon: Shield,
    color: "text-violet-500",
    iconBg: "bg-violet-500/15",
  },
  rushed: {
    label: "Торопливый",
    desc: "Спешит, просит короткие ответы, перебивает",
    icon: Timer,
    color: "text-orange-500",
    iconBg: "bg-orange-500/15",
  },
};

export default function SessionSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") ?? "talk";
  const { data: sessionOptions, isFetching, isError, isLoading } = useQuery({
    queryKey: ["session-options"],
    queryFn: frontendApi.sessionOptions,
  });

  const topics = sessionOptions?.topics ?? [];
  const difficulties = sessionOptions?.difficulties ?? [];
  const characters = sessionOptions?.characters ?? [];
  const formats = sessionOptions?.formats ?? [];

  const [topic, setTopic] = useState("");
  const [diff, setDiff] = useState<TrainingDifficultyDto>("medium");
  const [fmt, setFmt] = useState<TrainingFormatDto>("text");
  const [char, setChar] = useState<AiClientCharacterDto>("anxious");
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (!initialized && topics.length > 0) {
    setTopic(topics[2] ?? topics[0]);
    setInitialized(true);
  }

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Загрузка...</div>;
  }

  const target = mode === "exam" ? "/session/exam" : "/session/talk";
  const startSession = async () => {
    setIsStarting(true);
    setStartError(false);

    try {
      const session = await frontendApi.createTrainingSession({
        topic,
        mode: modeMap[mode] ?? "talk",
        difficulty: diff,
        format: fmt,
        character: char,
      });

      navigate(`${target}?sessionId=${encodeURIComponent(session.id)}&topic=${encodeURIComponent(topic)}&difficulty=${encodeURIComponent(diff)}&character=${encodeURIComponent(char)}&format=${encodeURIComponent(fmt)}`);
    } catch {
      setStartError(true);
    } finally {
      setIsStarting(false);
    }
  };

  const modeLabel = mode === "exam" ? "Экзамен юриста" : "Тренировка";
  const diffLabel = difficultyMeta[diff]?.label ?? diff;
  const fmtLabel = formatMeta[fmt]?.label ?? fmt;
  const charLabel = characterMeta[char]?.label ?? char;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-10 animate-slide-up">
        <BackButton label="Назад к режимам" fallback="/modes" className="mb-4" />
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-ai flex items-center justify-center text-white shadow-glow shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{modeLabel}</div>
            <h1 className="font-display text-3xl md:text-[2.5rem] font-bold text-primary tracking-tight mt-1">Настройка сессии</h1>
            <p className="text-muted-foreground mt-1 text-[15px]">Выберите параметры тренировки. Каждый выбор влияет на поведение ИИ-клиента.</p>
          </div>
        </div>
        <div className="section-divider mt-6" />
      </div>

      <ApiState
        isFetching={isFetching}
        isError={isError || startError}
        isEmpty={topics.length === 0}
        errorText={startError ? "Не удалось создать сессию. Попробуйте ещё раз." : undefined}
        emptyText="Темы тренировок пока не настроены."
      />

      <div className="space-y-8 stagger-in">
        <Section icon={BookOpen} title="Тема консультации" desc="О чём клиент будет спрашивать вас">
          <div className="grid sm:grid-cols-2 gap-2">
            {topics.map((t) => (
              <TopicChoice key={t} active={topic === t} onClick={() => setTopic(t)} label={t} />
            ))}
          </div>
        </Section>

        <Section icon={Gauge} title="Уровень сложности" desc="Определяет поведение клиента и строгость оценки">
          <div className="grid md:grid-cols-3 gap-3">
            {difficulties.map((d) => {
              const meta = difficultyMeta[d];
              if (!meta) return null;
              return (
                <CardChoice
                  key={d}
                  active={diff === d}
                  onClick={() => setDiff(d as TrainingDifficultyDto)}
                  label={meta.label}
                  desc={meta.desc}
                  Icon={meta.icon}
                  color={meta.color}
                  iconBg={meta.iconBg}
                />
              );
            })}
          </div>
        </Section>

        <Section icon={MessageSquare} title="Формат ответа" desc="Как вы будете отвечать клиенту">
          <div className="grid md:grid-cols-3 gap-3">
            {formats.map((f) => {
              const meta = formatMeta[f];
              if (!meta) return null;
              return (
                <CardChoice
                  key={f}
                  active={fmt === f}
                  onClick={() => setFmt(f as TrainingFormatDto)}
                  label={meta.label}
                  desc={meta.desc}
                  Icon={meta.icon}
                  color="text-muted-foreground"
                  iconBg="bg-muted/50"
                />
              );
            })}
          </div>
        </Section>

        <Section icon={Users} title="Характер ИИ-клиента" desc="Эмоциональный тип собеседника — влияет на стиль диалога">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {characters.map((c) => {
              const meta = characterMeta[c];
              if (!meta) return null;
              return (
                <CardChoice
                  key={c}
                  active={char === c}
                  onClick={() => setChar(c as AiClientCharacterDto)}
                  label={meta.label}
                  desc={meta.desc}
                  Icon={meta.icon}
                  color={meta.color}
                  iconBg={meta.iconBg}
                />
              );
            })}
          </div>
        </Section>
      </div>

      <div className="mt-10 glass-card-solid rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-display font-bold text-lg text-primary truncate">{topic || "Выберите тему"}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
            <span>{diffLabel}</span>
            <span className="text-border">·</span>
            <span>{fmtLabel}</span>
            <span className="text-border">·</span>
            <span>Клиент: {charLabel.toLowerCase()}</span>
          </div>
        </div>
        <Button
          onClick={startSession}
          disabled={isStarting || topics.length === 0 || !topic}
          className="bg-primary hover:bg-primary/90 px-8 h-12 text-base font-bold shrink-0 group"
        >
          {isStarting ? (
            "Создаём..."
          ) : (
            <>
              Начать сессию
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: typeof BookOpen; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 rounded-2xl border-border/60 card-hover">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="font-display font-bold text-base text-primary">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      {children}
    </Card>
  );
}

function TopicChoice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left text-sm px-4 py-3 rounded-xl border transition-all flex items-center justify-between gap-2",
        active
          ? "border-accent bg-accent/8 text-foreground font-medium shadow-sm"
          : "border-border/60 hover:border-muted-foreground/30 hover:bg-muted/20"
      )}
    >
      <span>{label}</span>
      {active && <Check className="h-4 w-4 text-accent shrink-0" />}
    </button>
  );
}

function CardChoice({
  active, onClick, label, desc, Icon, color, iconBg,
}: {
  active: boolean; onClick: () => void; label: string; desc: string;
  Icon: typeof Shield; color: string; iconBg: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left p-4 rounded-xl border transition-all",
        active
          ? "border-accent bg-accent/8 shadow-sm"
          : "border-border/60 hover:border-muted-foreground/30 hover:bg-muted/20"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        {active && <Check className="h-4 w-4 text-accent" />}
      </div>
      <div className="font-bold text-sm text-primary">{label}</div>
      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</div>
    </button>
  );
}
