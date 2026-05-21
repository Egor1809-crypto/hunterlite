import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { frontendApi } from "@/lib/frontend-api";
import { Mic, Send, X, ShieldAlert, Sparkles, Bot, User, Clock, Target, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { CallScriptDto } from "@/lib/api-contracts";

type Props = { mode: "talk" | "exam" | "chat-test" };
type Msg = { from: "ai" | "user"; text: string; isSystem?: boolean };
const DEFAULT_SCRIPT_TOPIC = "Имущество должника";

type SessionInfoPanelProps = {
  mode: Props["mode"];
  topic: string;
  step: number;
  total: number;
  score: number;
  secs: number;
  fmt: (seconds: number) => string;
};

export default function SessionChat({ mode }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionIdParam = params.get("sessionId");
  const scriptId = params.get("scriptId");
  const topic = params.get("topic") ?? (mode === "chat-test" ? "Условия банкротства" : "Имущество должника");
  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ["employee", "callScripts"],
    queryFn: () => frontendApi.getTrainingCallScripts(),
  });
  const selectedScriptId = scriptId ?? (
    sessionIdParam && scripts.some((script) => script.id === sessionIdParam) ? sessionIdParam : undefined
  );
  const sessionId = selectedScriptId === sessionIdParam ? undefined : sessionIdParam;
  const activeScript = (
    selectedScriptId ? scripts.find((script) => script.id === selectedScriptId) : scripts[0]
  ) as CallScriptDto | undefined;
  const nodes = activeScript?.nodes || [];

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const [aiTyping, setAiTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(mode === "exam" ? 30 * 60 : 0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [score, setScore] = useState(100);
  const [sessionMistakes, setSessionMistakes] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState(sessionId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<string | null>(null);

  const total = nodes.length > 0 ? nodes.length : 5;

  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionId(sessionId);
    }
  }, [activeSessionId, sessionId]);

  useEffect(() => {
    if (isLoading || scripts.length === 0 || messages.length > 0 || aiTyping || step !== 0) return;

    const startKey = `${activeScript?.id ?? "fallback"}:${sessionId ?? "new"}`;
    if (startRef.current === startKey) return;
    startRef.current = startKey;

    let cancelled = false;

    const startScript = async () => {
      setAiTyping(true);

      let backendSessionId = sessionId && sessionId !== "demo-session" ? sessionId : undefined;

      if (!backendSessionId && selectedScriptId && activeScript) {
        const createSession = (sessionTopic: string) => frontendApi.createTrainingSession({
          topic: sessionTopic,
          mode: mode === "exam" ? "exam" : mode === "chat-test" ? "chat_test" : "talk",
          difficulty: "medium",
          format: "text",
          character: "anxious",
        });

        try {
          const created = await createSession(topic);
          backendSessionId = created.id;
        } catch {
          try {
            const created = await createSession(DEFAULT_SCRIPT_TOPIC);
            backendSessionId = created.id;
          } catch {
            backendSessionId = undefined;
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (cancelled) return;

      const initialMessage = nodes[0]?.clientReplica || "Здравствуйте!";
      setActiveSessionId(backendSessionId);
      setMessages([{ from: "ai", text: initialMessage }]);
      setAiTyping(false);

      if (backendSessionId) {
        void frontendApi.addTrainingMessage(backendSessionId, { from: "ai", text: initialMessage }).catch(() => undefined);
      }
    };

    void startScript();

    return () => {
      cancelled = true;
    };
  }, [
    activeScript,
    aiTyping,
    isLoading,
    messages.length,
    mode,
    nodes,
    scripts.length,
    selectedScriptId,
    sessionId,
    step,
    topic,
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, aiTyping]);

  useEffect(() => {
    if (mode !== "exam") return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [mode]);

  const send = (overrideText?: string) => {
    if (sessionEnded) return;
    const text = overrideText || input.trim();
    if (!text) return;

    const sessionForPersistence = activeSessionId && activeSessionId !== "demo-session" ? activeSessionId : undefined;
    const userMessage: Msg = { from: "user", text };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setAiTyping(true);
    if (sessionForPersistence) {
      void frontendApi.addTrainingMessage(sessionForPersistence, { from: "user", text }).catch(() => undefined);
    }

    // Smart evaluation logic based on keywordRules
    let penalty = 0;
    const newMistakes: string[] = [];
    const currentNode = nodes[step];
    
    if (currentNode?.keywordRules) {
      const rules = currentNode.keywordRules as { requires?: string[]; forbids?: string[] };
      const lowerText = text.toLowerCase();
      
      if (rules.requires && rules.requires.length > 0) {
        let missing = 0;
        rules.requires.forEach(word => {
          if (!lowerText.includes(word)) {
            missing++;
            newMistakes.push(`Пропущено обязательное слово: "${word}" на шаге ${step + 1}`);
          }
        });
        penalty += missing * 10;
      }
      
      if (rules.forbids && rules.forbids.length > 0) {
        rules.forbids.forEach(word => {
          if (lowerText.includes(word)) {
            penalty += 15;
            newMistakes.push(`Использовано запрещенное слово: "${word}" на шаге ${step + 1}`);
          }
        });
      }
    } else {
      // Fallback simple rules
      if (text.length < 5) penalty += 5;
      if (text.toLowerCase().includes("не знаю")) {
        penalty += 20;
        newMistakes.push(`Использована неуверенная формулировка "не знаю" на шаге ${step + 1}`);
      }
    }

    if (newMistakes.length > 0) {
      setSessionMistakes(prev => [...prev, ...newMistakes]);
    }

    setTimeout(() => {
      if (penalty > 0) {
        setScore(s => Math.max(0, s - penalty));
      }

      const nextStep = step + 1;
      const nextNode = nodes[nextStep];
      const aiMessage = nextNode?.clientReplica || "Спасибо за консультацию, до свидания!";

      if (nextNode) {
        setMessages((m) => [...m, { from: "ai", text: aiMessage }]);
        setStep(nextStep);
      } else {
        setMessages((m) => [...m, { from: "ai", text: aiMessage, isSystem: true }]);
        setSessionEnded(true);
      }
      if (sessionForPersistence) {
        void frontendApi.addTrainingMessage(sessionForPersistence, { from: "ai", text: aiMessage }).catch(() => undefined);
      }
      setAiTyping(false);
    }, 1100);
  };

  const finish = async () => {
    const resultSessionId = activeSessionId && activeSessionId !== "demo-session" ? activeSessionId : undefined;

    if (resultSessionId) {
      await frontendApi.completeTrainingSession(resultSessionId, {
        score,
        criteria: [
          { criterion: "legal_accuracy", score: score > 80 ? 90 : 70, comment: "Оценка сформирована автоматически." },
          { criterion: "safe_wording", score: score > 60 ? 80 : 50, comment: "Проверено по ключевым словам." },
        ],
        mistakes: sessionMistakes.length > 0 ? sessionMistakes : ["Ошибок не обнаружено"],
        recommendations: sessionMistakes.length > 0 ? ["Повторить скрипт и использовать обязательные ключевые слова"] : ["Отличная работа"],
      }).catch(() => undefined);
    }

    navigate(`${mode === "exam" ? "/session/result?mode=exam" : "/session/result"}${resultSessionId ? `${mode === "exam" ? "&" : "?"}sessionId=${encodeURIComponent(resultSessionId)}&score=${score}` : ""}`, {
      state: {
        mistakes: sessionMistakes.length > 0 ? sessionMistakes : ["Ошибок не обнаружено"],
        recommendations: sessionMistakes.length > 0 ? ["Повторить скрипт и использовать обязательные ключевые слова"] : ["Отличная работа"],
      }
    });
  };

  const title = activeScript?.title || "Симуляция звонка";

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border bg-background">
        {/* Top bar */}
        <div className="px-4 md:px-6 py-3 border-b border-border bg-card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {mode === "exam" ? "Экзамен" : mode === "chat-test" ? "Чат-тест" : "Тренировка"}
            </div>
            <div className="font-display font-bold text-primary truncate">{title}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mode === "exam" && (
              <StatusBadge variant={secs < 300 ? "destructive" : "info"} className="font-mono">
                <Clock className="h-3 w-3" /> {fmt(secs)}
              </StatusBadge>
            )}
            <button
              className="lg:hidden p-2 rounded-lg border border-border"
              onClick={() => setPanelOpen(true)}
              aria-label="Информация о сессии"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <Button variant="ghost" size="sm" onClick={() => void finish()} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4 mr-1" /> Завершить
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Загрузка сценария...
            </div>
          ) : scripts.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Скрипты звонков не найдены. Создайте их в панели администратора.
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <Bubble key={i} m={m} />
              ))}
          {aiTyping && (
            <div className="flex gap-3 max-w-3xl">
              <Avatar from="ai" />
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-card">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse-soft" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse-soft [animation-delay:0.2s]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse-soft [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
          {sessionEnded && (
            <div className="max-w-3xl mx-auto flex justify-center">
              <Button onClick={() => void finish()} className="bg-primary text-primary-foreground shadow-lg">
                Посмотреть результаты симуляции
              </Button>
            </div>
          )}
          </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border bg-card p-3 md:p-4">
          <div className="flex items-end gap-2 max-w-3xl">
            <button
              onClick={() => setRecording((r) => !r)}
              className={cn(
                "h-11 w-11 rounded-xl border flex items-center justify-center transition-colors shrink-0",
                recording
                  ? "bg-destructive text-destructive-foreground border-destructive animate-pulse-soft"
                  : "border-border hover:bg-muted"
              )}
              aria-label="Микрофон"
            >
              <Mic className="h-4 w-4" />
            </button>
            <Input
              placeholder={recording ? "Говорите…" : "Ответьте клиенту…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="h-11 bg-black/50"
              disabled={aiTyping || sessionEnded || isLoading}
            />
            <Button onClick={() => send()} className="h-11 bg-primary hover:bg-primary/90 px-4" disabled={aiTyping || sessionEnded || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2 max-w-3xl">
            {recording && (
              <span className="flex items-center gap-1.5 text-destructive font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" /> Идёт запись
              </span>
            )}
            <span>Аудио не сохраняется. В оценку идёт только расшифровка.</span>
          </div>
        </div>
      </div>

      {/* Right panel desktop */}
      <aside className="hidden lg:flex w-[340px] shrink-0 flex-col bg-card overflow-y-auto">
        <SessionInfoPanel mode={mode} topic={topic} step={step} total={total} score={score} secs={secs} fmt={fmt} />
      </aside>

      {/* Mobile drawer */}
      {panelOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur" onClick={() => setPanelOpen(false)}>
          <div className="absolute bottom-0 inset-x-0 max-h-[80vh] overflow-y-auto bg-card rounded-t-2xl border-t border-border shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 flex justify-center"><div className="h-1 w-10 rounded-full bg-muted" /></div>
            <SessionInfoPanel mode={mode} topic={topic} step={step} total={total} score={score} secs={secs} fmt={fmt} />
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const isAi = m.from === "ai";
  return (
    <div className={cn("flex gap-3 max-w-3xl", !isAi && "ml-auto flex-row-reverse")}>
      <Avatar from={m.from} />
      <div
        className={cn(
          "rounded-2xl px-4 py-3 shadow-card",
          m.isSystem 
            ? "bg-transparent border border-dashed border-white/20 text-center mx-auto" 
            : isAi
              ? "bg-card border border-border rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
        )}
      >
        {!m.isSystem && (
          <div className={cn("text-[11px] font-semibold uppercase tracking-wider mb-1", isAi ? "text-muted-foreground" : "text-primary-foreground/60")}>
            {isAi ? "Клиент" : "Вы"}
          </div>
        )}
        <div className="text-sm leading-relaxed">{m.text}</div>
      </div>
    </div>
  );
}

function Avatar({ from }: { from: "ai" | "user" }) {
  return (
    <div
      className={cn(
        "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
        from === "ai" ? "bg-ai-soft text-ai-soft-foreground" : "bg-primary text-primary-foreground"
      )}
    >
      {from === "ai" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
    </div>
  );
}

function SessionInfoPanel({ mode, topic, step, total, score, secs, fmt }: SessionInfoPanelProps) {
  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Тема</div>
        <div className="font-semibold text-primary mt-1">{topic}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Уровень: средний</div>
      </div>

      {mode === "exam" && (
        <Card className="p-4 bg-primary text-primary-foreground border-0">
          <div className="text-xs uppercase tracking-wider opacity-70 font-semibold">Таймер экзамена</div>
          <div className="text-pixel-number text-3xl mt-1 tabular-nums">{fmt(secs)}</div>
          <div className="text-xs opacity-70 mt-1">Проходной балл — <span className="text-pixel-inline">70<span className="text-pixel-inline-muted">%</span></span></div>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Прогресс</span>
          <span className="text-xs font-semibold">{Math.min(step, total)} из {total}</span>
        </div>
        <Progress value={(Math.min(step, total) / total) * 100} className="h-1.5" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Текущий балл</span>
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-pixel-number text-3xl">{score}</span>
          <span className="text-pixel-inline-muted text-sm">/100</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            { l: "Правильность", v: 88 },
            { l: "Полнота", v: 72 },
            { l: "Понятность", v: 84 },
            { l: "Тон", v: 90 },
            { l: "Безопасность", v: 70 },
          ].map((s) => (
            <div key={s.l}>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{s.l}</span><span>{s.v}</span>
              </div>
              <Progress value={s.v} className="h-1" />
            </div>
          ))}
        </div>
      </Card>

      <div>
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Статус AI-клиента</div>
        <StatusBadge variant="warning" dot>Тревожный · сомневается</StatusBadge>
      </div>

      <Card className="p-3 bg-ai-soft border-ai/20">
        <div className="flex gap-2">
          <Sparkles className="h-4 w-4 text-ai-soft-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-ai-soft-foreground">
            <span className="font-semibold">AI:</span> добавьте уточнение про залоговое имущество и единственное жильё.
          </div>
        </div>
      </Card>
    </div>
  );
}
