import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { Check, X, Sparkles, ShieldAlert, ThumbsUp, FileCheck2 } from "lucide-react";

interface AnswerReviewState {
  question?: string;
  userAnswer?: string;
  referenceAnswer?: string;
  score?: number;
  feedback?: {
    positive?: string[];
    improvements?: string[];
    recommendation?: string;
  };
  criteria?: Array<{ name: string; score: number; maxScore: number }>;
}

export default function AnswerReview() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: AnswerReviewState | null };

  if (!state || (!state.question && !state.userAnswer)) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
        <BackButton label="Назад" fallback="/dashboard" className="mb-4" />
        <Card className="p-8 text-center shadow-card">
          <p className="text-muted-foreground">Нет данных для отображения</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Назад</Button>
        </Card>
      </div>
    );
  }

  const totalScore = state.score ?? 0;
  const criteria = state.criteria ?? [];
  const positives = state.feedback?.positive ?? [];
  const improvements = state.feedback?.improvements ?? [];
  const recommendation = state.feedback?.recommendation;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <BackButton label="Вернуться к сессии" fallback="/session/talk" className="mb-4" />

      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-ai flex items-center justify-center text-white">
          <FileCheck2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Разбор ответа</h1>
          <p className="text-sm text-muted-foreground">Оценка формулировок, полноты и юридической безопасности.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-1 bg-gradient-hero text-white border-0 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wider text-white/60 font-semibold">Общий балл за ответ</div>
            <div className="text-pixel-number text-6xl mt-2 tabular-nums">{totalScore}<span className="text-2xl text-white/50 font-normal">/100</span></div>
            <StatusBadge variant={totalScore >= 70 ? "success" : "warning"} className="mt-4">
              {totalScore >= 70 ? "Безопасный ответ" : "Требует доработки"}
            </StatusBadge>
            {criteria.length > 0 && (
              <div className="mt-6 space-y-3">
                {criteria.map((s) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">{s.name}</span>
                      <span className="font-semibold">{s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0}</span>
                    </div>
                    <Progress value={s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0} className="h-1 mt-1" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 shadow-card">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Вопрос ИИ-клиента</div>
            <div className="text-sm bg-muted/40 rounded-lg p-4 border border-border italic">
              {state.question}
            </div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mt-5 mb-2">Ваш ответ</div>
            <div className="text-sm bg-info-soft/40 rounded-lg p-4 border border-info/20">
              {state.userAnswer}
            </div>
          </Card>

          {(positives.length > 0 || improvements.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-4">
              {positives.length > 0 && (
                <Card className="p-5 shadow-card border-success/30 bg-success-soft/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-full bg-success text-white flex items-center justify-center"><ThumbsUp className="h-3.5 w-3.5" /></div>
                    <h4 className="font-display font-bold text-success-soft-foreground">Что хорошо</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-success-soft-foreground/90">
                    {positives.map((t) => (
                      <li key={t} className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" />{t}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {improvements.length > 0 && (
                <Card className="p-5 shadow-card border-warning/30 bg-warning-soft/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-full bg-warning text-white flex items-center justify-center"><ShieldAlert className="h-3.5 w-3.5" /></div>
                    <h4 className="font-display font-bold text-warning-soft-foreground">Что улучшить</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-warning-soft-foreground/90">
                    {improvements.map((t) => (
                      <li key={t} className="flex gap-2"><X className="h-4 w-4 text-warning shrink-0 mt-0.5" />{t}</li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {state.referenceAnswer && (
            <Card className="p-5 shadow-card">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Эталонный ответ</div>
              <p className="text-sm leading-relaxed text-foreground">
                {state.referenceAnswer}
              </p>
            </Card>
          )}

          {recommendation && (
            <Card className="p-5 bg-ai-soft border-ai/20">
              <div className="flex gap-3">
                <div className="h-9 w-9 rounded-lg bg-ai text-white flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-ai-soft-foreground">ИИ-рекомендация</div>
                  <p className="text-sm text-ai-soft-foreground/90 mt-1">
                    {recommendation}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Продолжить сессию</Button>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/session/result")}>Завершить и увидеть итог</Button>
      </div>
    </div>
  );
}
