import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { frontendApi, frontendFallbacks, useApiData } from "@/lib/frontend-api";
import { Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiClientCharacterDto, TrainingDifficultyDto, TrainingFormatDto, TrainingModeDto } from "@/lib/api-contracts";

const modeMap: Record<string, TrainingModeDto> = {
  talk: "talk",
  exam: "exam",
  chat: "chat_test",
};

const difficultyMap: Record<string, TrainingDifficultyDto> = {
  Базовый: "basic",
  Средний: "medium",
  Сложный: "hard",
};

const formatMap: Record<string, TrainingFormatDto> = {
  Текст: "text",
  Голос: "voice",
  Последовательность: "sequence",
};

const characterMap: Record<string, AiClientCharacterDto> = {
  Спокойный: "skeptical",
  Тревожный: "anxious",
  Агрессивный: "aggressive",
  Сомневающийся: "skeptical",
  Недоверчивый: "distrustful",
  Конфликтный: "aggressive",
  Торопится: "rushed",
};

export default function SessionSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") ?? "talk";
  const { data: sessionOptions, isFetching, isError } = useApiData({
    queryKey: ["session-options"],
    request: frontendApi.sessionOptions,
    fallback: frontendFallbacks.sessionOptions,
  });
  const { topics, difficulties, characters, formats } = sessionOptions;

  const [topic, setTopic] = useState(topics[2]);
  const [diff, setDiff] = useState("Средний");
  const [fmt, setFmt] = useState("Текст");
  const [char, setChar] = useState("Тревожный");
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState(false);

  const target = mode === "exam" ? "/session/exam" : mode === "chat" ? "/session/chat-test" : "/session/talk";
  const startSession = async () => {
    setIsStarting(true);
    setStartError(false);

    try {
      const session = await frontendApi.createTrainingSession({
        topic,
        mode: modeMap[mode] ?? "talk",
        difficulty: difficultyMap[diff] ?? "medium",
        format: formatMap[fmt] ?? "text",
        character: characterMap[char] ?? "anxious",
      });

      navigate(`${target}?sessionId=${encodeURIComponent(session.id)}&topic=${encodeURIComponent(topic)}`);
    } catch {
      setStartError(true);
      navigate(`${target}?sessionId=demo-session&topic=${encodeURIComponent(topic)}`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <BackButton label="Назад к режимам" fallback="/modes" className="mb-3" />
        <div className="flex items-start gap-4">
          <IconBadge icon={SlidersHorizontal} />
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {mode === "exam" ? "Экзамен юриста" : mode === "chat" ? "Чат-тест" : "Тренировка"}
            </div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-tight mt-1">Настройка сессии</h1>
            <p className="text-muted-foreground mt-2">Выберите параметры тренировки. Их можно поменять перед каждой сессией.</p>
          </div>
        </div>
      </div>

      <ApiState
        isFetching={isFetching}
        isError={isError || startError}
        isEmpty={topics.length === 0}
        errorText={startError ? "Backend-сессия недоступна. Открыли тренировку в demo-режиме." : undefined}
        emptyText="Темы тренировок пока не настроены."
      />

      <div className="space-y-6">
        <Section title="Тема">
          <div className="grid sm:grid-cols-2 gap-2">
            {topics.map((t) => (
              <Choice key={t} active={topic === t} onClick={() => setTopic(t)} label={t} />
            ))}
          </div>
        </Section>

        <Section title="Уровень сложности">
          <div className="grid grid-cols-3 gap-2">
            {difficulties.map((d) => (
              <Choice key={d} active={diff === d} onClick={() => setDiff(d)} label={d} />
            ))}
          </div>
        </Section>

        <Section title="Формат ответа">
          <div className="grid grid-cols-2 gap-2">
            {formats.map((f) => (
              <Choice key={f} active={fmt === f} onClick={() => setFmt(f)} label={f} />
            ))}
          </div>
        </Section>

        <Section title="Характер ИИ-клиента">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {characters.map((c) => (
              <Choice key={c} active={char === c} onClick={() => setChar(c)} label={c} />
            ))}
          </div>
        </Section>
      </div>

      <div className="mt-8 flex items-center justify-between p-4 rounded-xl bg-card border border-border shadow-card">
        <div className="text-sm">
          <div className="font-semibold">{topic}</div>
          <div className="text-muted-foreground text-xs mt-0.5">
            {diff} · {fmt} · клиент: {char.toLowerCase()}
          </div>
        </div>
        <Button onClick={startSession} disabled={isStarting || topics.length === 0} className="bg-primary hover:bg-primary/90 px-6">
          {isStarting ? "Создаём..." : "Начать сессию"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 shadow-card">
      <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">{title}</div>
      {children}
    </Card>
  );
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left text-sm px-3.5 py-2.5 rounded-lg border transition-all flex items-center justify-between gap-2",
        active
          ? "border-accent bg-accent/5 text-foreground font-medium"
          : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      )}
    >
      <span>{label}</span>
      {active && <Check className="h-4 w-4 text-accent shrink-0" />}
    </button>
  );
}
