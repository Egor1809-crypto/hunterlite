import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { Trophy, RotateCcw, Home, Sparkles, Check, AlertTriangle, X, Award, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { frontendApi } from "@/lib/frontend-api";
import { isPassingScore, passingScore } from "@/lib/training-logic";
import { useQuery } from "@tanstack/react-query";

function generateCertificate(studentName: string, topic: string, score: number, date: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 850;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, 1200, 850);

  const grad = ctx.createLinearGradient(0, 0, 1200, 850);
  grad.addColorStop(0, "rgba(59, 130, 246, 0.08)");
  grad.addColorStop(1, "rgba(139, 92, 246, 0.08)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 850);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 40, 1120, 770);
  ctx.strokeRect(50, 50, 1100, 750);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "bold 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("HUNTERLITE · LEGAL AI TRAINER", 600, 100);

  ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
  ctx.font = "bold 14px system-ui";
  ctx.fillText("✦", 600, 140);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "400 18px system-ui";
  ctx.fillText("СЕРТИФИКАТ", 600, 200);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px system-ui";
  ctx.fillText("Экзамен сдан", 600, 280);

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(450, 310, 300, 1);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "400 16px system-ui";
  ctx.fillText("Настоящим удостоверяется, что", 600, 370);

  ctx.fillStyle = "#60a5fa";
  ctx.font = "bold 32px system-ui";
  ctx.fillText(studentName, 600, 420);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "400 16px system-ui";
  ctx.fillText("успешно сдал(а) аттестационный экзамен по теме", 600, 480);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui";
  ctx.fillText(`«${topic}»`, 600, 520);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "400 16px system-ui";
  ctx.fillText(`с результатом ${score}/100 и допущен(а) к консультациям клиентов.`, 600, 570);

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "400 14px system-ui";
  ctx.fillText(`Дата: ${date}`, 600, 660);

  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = "400 12px system-ui";
  ctx.fillText("Сертификат сгенерирован платформой HUNTERLITE", 600, 780);

  const link = document.createElement("a");
  link.download = `certificate-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export default function SessionResult() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");
  const isExam = params.get("mode") === "exam";
  const { data: sessionDetail } = useQuery({
    queryKey: ["training-session-detail", sessionId],
    queryFn: () => frontendApi.trainingSessionDetail(sessionId || ""),
    enabled: Boolean(sessionId),
    retry: false,
  });
  const scoreParam = Number(params.get("score"));
  const score = sessionDetail?.score ?? (
    params.has("score") && Number.isInteger(scoreParam) && scoreParam >= 0 && scoreParam <= 100 ? scoreParam : 76
  );
  const passed = isPassingScore(score);
  
  const { state } = useLocation();
  const mistakes: string[] = sessionDetail?.mistakes || state?.mistakes || ["Ошибок не обнаружено"];
  const recommendations: string[] = sessionDetail?.recommendations || state?.recommendations || ["Повторить слабые темы"];
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => frontendApi.currentUser(),
  });
  const resultMode = sessionDetail?.mode ?? (isExam ? "Экзамен" : "Тренировка");
  const resultTopic = sessionDetail?.topic ?? "Имущество должника";
  const today = new Date().toLocaleDateString("ru-RU");
  
  const dynamicTimeline = mistakes.map((m, idx) => ({
    idx: idx + 1,
    type: m === "Ошибок не обнаружено" ? "ok" : "warn",
    q: "Анализ ответа",
    t: m,
  }));
  
  // Add AI recommendation to the end
  dynamicTimeline.push({
    idx: dynamicTimeline.length + 1,
    type: "ai",
    q: "ИИ-рекомендация",
    t: recommendations[0],
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <BackButton label="Назад к предыдущему шагу" fallback="/dashboard" className="mb-4" />

      {/* Header card */}
      <Card className={cn(
        "p-6 md:p-8 border-0 text-white relative overflow-hidden shadow-elevated",
        passed ? "bg-gradient-hero" : "bg-gradient-to-br from-destructive to-destructive/70"
      )}>
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid md:grid-cols-2 gap-6 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-xs font-medium">
              {resultMode} · {resultTopic}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mt-4 tracking-tight">
              {passed ? (isExam ? "Экзамен сдан" : "Сессия завершена") : (isExam ? "Экзамен не сдан" : "Тренировка не пройдена")}
            </h1>
            <p className="text-white/70 mt-2">
              {passed
                ? isExam
                  ? `Вы превысили проходной порог ${passingScore}% и подтвердили допуск.`
                  : "Сессия сохранена, рекомендации добавлены в план подготовки."
                : "Назначен обязательный курс подготовки."}
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              {passed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-success text-white">
                  <Trophy className="h-3.5 w-3.5" /> Допущен к консультациям
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-white/15 backdrop-blur">
                  <AlertTriangle className="h-3.5 w-3.5" /> Требуется курс подготовки
                </span>
              )}
            </div>
          </div>
          <div className="flex md:justify-end">
            <div className="text-center md:text-right">
              <div className="text-xs uppercase tracking-wider text-white/60 font-semibold">Общий балл</div>
              <div className="text-pixel-number text-7xl tabular-nums leading-none mt-1">
                {score}<span className="text-2xl text-white/50 font-normal">/100</span>
              </div>
              <div className="text-xs text-white/60 mt-2">Проходной порог · {passingScore}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Certificate */}
      {passed && isExam && (
        <Card className="mt-4 p-5 shadow-card border-l-4 border-l-success">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <Award className="h-6 w-6 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-lg text-primary">Сертификат готов</div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Вы успешно сдали экзамен. Скачайте сертификат о прохождении аттестации.
              </p>
            </div>
            <Button
              onClick={() => generateCertificate(
                currentUser?.name ?? "Сотрудник",
                resultTopic,
                score,
                today,
              )}
              className="bg-success hover:bg-success/90 text-white shrink-0 rounded-xl"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Скачать сертификат
            </Button>
          </div>
        </Card>
      )}

      {/* Strong / weak */}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Check className="h-4 w-4 text-success" />
            <h3 className="font-display font-bold text-primary">Сильные темы</h3>
          </div>
          <div className="space-y-2">
            {["Последствия банкротства", "Тон коммуникации с клиентом", "Условия процедуры"].map((t) => (
              <div key={t} className="flex items-center justify-between p-2.5 rounded-lg bg-success-soft/40 border border-success/20">
                <span className="text-sm">{t}</span>
                <StatusBadge variant="success">90+</StatusBadge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-display font-bold text-primary">Слабые темы</h3>
          </div>
          <div className="space-y-2">
            {[{ t: "Имущество должника", v: "62" }, { t: "Ипотечное жильё", v: "58" }, { t: "Долги, которые не списываются", v: "65" }].map((x) => (
              <div key={x.t} className="flex items-center justify-between p-2.5 rounded-lg bg-warning-soft/40 border border-warning/20">
                <span className="text-sm">{x.t}</span>
                <StatusBadge variant="warning">{x.v}</StatusBadge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="p-5 mt-4 shadow-card">
        <h3 className="font-display font-bold text-primary mb-4">Таймлайн разбора</h3>
        <div className="relative pl-6 border-l-2 border-border space-y-4">
          {dynamicTimeline.map((t) => {
            const palette = {
              ok: { ring: "bg-success", icon: <Check className="h-3 w-3 text-white" />, badge: "success" as const, label: "Безопасно" },
              warn: { ring: "bg-warning", icon: <AlertTriangle className="h-3 w-3 text-white" />, badge: "warning" as const, label: "Ошибка" },
              ai: { ring: "bg-ai", icon: <Sparkles className="h-3 w-3 text-white" />, badge: "ai" as const, label: "ИИ-рекомендация" },
            }[t.type as "ok" | "warn" | "ai"];
            
            if (!palette) return null;
            
            return (
              <div key={t.idx} className="relative">
                <div className={cn("absolute -left-[33px] h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-card", palette.ring)}>
                  {palette.icon}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">#{t.idx}</span>
                  <span className="font-semibold text-sm">{t.q}</span>
                  <StatusBadge variant={palette.badge}>{palette.label}</StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{t.t}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recommendations + transcript */}
      <Card className="p-5 mt-4 bg-ai-soft border-ai/20">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-lg bg-ai text-white flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4" /></div>
          <div>
            <div className="font-semibold text-ai-soft-foreground">Рекомендация ИИ</div>
            <p className="text-sm text-ai-soft-foreground/90 mt-1">
              {recommendations[0]}
            </p>
          </div>
        </div>
      </Card>

      {sessionDetail?.messages.length ? (
        <Card className="p-5 mt-4 shadow-card">
          <h3 className="font-display font-bold text-primary mb-4">Расшифровка диалога</h3>
          <div className="space-y-3">
            {sessionDetail.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-xl border p-3",
                  message.from === "ai" ? "bg-card border-border" : "bg-primary/10 border-primary/20"
                )}
              >
                <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  {message.from === "ai" ? "Клиент" : "Сотрудник"}
                </div>
                <div className="text-sm leading-relaxed">{message.text}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-end">
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <Home className="h-4 w-4 mr-1.5" /> Вернуться в кабинет
        </Button>
        {!passed ? (
          <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/remedial-course")}>
            Перейти к обязательному курсу подготовки
          </Button>
        ) : (
          <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/weak-topics")}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Повторить слабые темы
          </Button>
        )}
      </div>
    </div>
  );
}
