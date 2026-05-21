import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { BackButton } from "@/components/BackButton";
import { Check, X, Sparkles, ShieldAlert, ThumbsUp, FileCheck2 } from "lucide-react";

const scores = [
  { l: "Правильность", v: 88, c: "success" as const },
  { l: "Полнота", v: 72, c: "warning" as const },
  { l: "Понятность", v: 90, c: "success" as const },
  { l: "Тон коммуникации", v: 86, c: "success" as const },
  { l: "Безопасность формулировок", v: 80, c: "info" as const },
];

export default function AnswerReview() {
  const navigate = useNavigate();
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
        {/* Score */}
        <Card className="p-6 lg:col-span-1 bg-gradient-hero text-white border-0 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wider text-white/60 font-semibold">Общий балл за ответ</div>
            <div className="text-pixel-number text-6xl mt-2 tabular-nums">84<span className="text-2xl text-white/50 font-normal">/100</span></div>
            <StatusBadge variant="success" className="mt-4">Безопасный ответ</StatusBadge>
            <div className="mt-6 space-y-3">
              {scores.map((s) => (
                <div key={s.l}>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70">{s.l}</span>
                    <span className="font-semibold">{s.v}</span>
                  </div>
                  <Progress value={s.v} className="h-1 mt-1" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {/* Question + answer */}
          <Card className="p-5 shadow-card">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Вопрос NAVI-клиента</div>
            <div className="text-sm bg-muted/40 rounded-lg p-4 border border-border italic">
              «Я боюсь, что после банкротства у меня заберут вообще всё имущество. Это правда?»
            </div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mt-5 mb-2">Ваш ответ</div>
            <div className="text-sm bg-info-soft/40 rounded-lg p-4 border border-info/20">
              «Нет, не всё имущество подлежит реализации. Например, единственное жильё, если оно не в ипотеке, защищено законом. Но всё зависит от вашей конкретной ситуации.»
            </div>
          </Card>

          {/* Good / improve */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-5 shadow-card border-success/30 bg-success-soft/40">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-full bg-success text-white flex items-center justify-center"><ThumbsUp className="h-3.5 w-3.5" /></div>
                <h4 className="font-display font-bold text-success-soft-foreground">Что хорошо</h4>
              </div>
              <ul className="space-y-2 text-sm text-success-soft-foreground/90">
                {["Корректно объяснили, что не всё имущество забирается", "Не дали ложных гарантий", "Использовали спокойный тон"].map((t) => (
                  <li key={t} className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" />{t}</li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 shadow-card border-warning/30 bg-warning-soft/40">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-full bg-warning text-white flex items-center justify-center"><ShieldAlert className="h-3.5 w-3.5" /></div>
                <h4 className="font-display font-bold text-warning-soft-foreground">Что улучшить</h4>
              </div>
              <ul className="space-y-2 text-sm text-warning-soft-foreground/90">
                {["Добавить уточнение про ипотечное жильё (залог банка)", "Объяснить, что каждый кейс требует анализа документов", "Упомянуть имущество для профессиональной деятельности"].map((t) => (
                  <li key={t} className="flex gap-2"><X className="h-4 w-4 text-warning shrink-0 mt-0.5" />{t}</li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Reference answer */}
          <Card className="p-5 shadow-card">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Эталонный ответ</div>
            <p className="text-sm leading-relaxed text-foreground">
              «Нет, в процедуре банкротства реализуется не всё имущество. Закон защищает определённые категории — единственное жильё (кроме ипотечного), предметы обихода, имущество для профессиональной деятельности в пределах лимитов. Ипотечная квартира является залогом банка и обычно включается в конкурсную массу. Точный состав защищённого имущества зависит от вашей ситуации и требует анализа документов.»
            </p>
          </Card>

          {/* NAVI rec */}
          <Card className="p-5 bg-ai-soft border-ai/20">
            <div className="flex gap-3">
              <div className="h-9 w-9 rounded-lg bg-ai text-white flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-ai-soft-foreground">NAVI-рекомендация</div>
                <p className="text-sm text-ai-soft-foreground/90 mt-1">
                  Пройдите 2 кейса по теме «Ипотечное жильё при банкротстве» — это поднимет балл по полноте ответов.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Продолжить сессию</Button>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/session/result")}>Завершить и увидеть итог</Button>
      </div>
    </div>
  );
}
