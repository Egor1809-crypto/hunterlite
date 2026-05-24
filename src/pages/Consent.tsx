import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ShieldAlert, FileText, Mic } from "lucide-react";
import { useState } from "react";
import { useDemoAuth } from "@/lib/demo-auth";
import { getRoleHome } from "@/lib/demo-auth-state";
import { frontendApi } from "@/lib/frontend-api";

export default function Consent() {
  const navigate = useNavigate();
  const { role, setRole } = useDemoAuth();
  const [a, setA] = useState(true);
  const [b, setB] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4 sm:p-8">
      <Card className="max-w-2xl w-full p-6 sm:p-10 shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-info-soft flex items-center justify-center">
            <FileText className="h-5 w-5 text-info-soft-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-primary">Согласие на обработку данных</h1>
            <p className="text-sm text-muted-foreground">Перед использованием платформы ознакомьтесь с условиями.</p>
          </div>
        </div>

        <div className="mt-7 space-y-3">
          <label className="flex gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 cursor-pointer transition-colors">
            <Checkbox checked={a} onCheckedChange={(v) => setA(!!v)} className="mt-0.5" />
            <div>
              <div className="font-semibold text-sm">Согласие на обработку персональных данных</div>
              <div className="text-xs text-muted-foreground mt-1">
                В соответствии с 152-ФЗ платформа обрабатывает учётные данные сотрудника, результаты тренировок и экзаменов.
              </div>
            </div>
          </label>

          <label className="flex gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 cursor-pointer transition-colors">
            <Checkbox checked={b} onCheckedChange={(v) => setB(!!v)} className="mt-0.5" />
            <div>
              <div className="font-semibold text-sm">Согласие на обработку расшифровки диалога</div>
              <div className="text-xs text-muted-foreground mt-1">
                Текст ваших ответов используется для оценки качества консультации и подготовки персональных рекомендаций.
              </div>
            </div>
          </label>
        </div>

        <div className="mt-5 flex gap-3 p-4 rounded-xl bg-warning-soft border border-warning/20">
          <Mic className="h-5 w-5 text-warning-soft-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-warning-soft-foreground">
            <span className="font-semibold">Аудио не сохраняется.</span> Сохраняется только текстовая расшифровка и результаты оценки.
          </div>
        </div>

        <div className="mt-5 flex gap-3 p-4 rounded-xl bg-muted/50 border border-border">
          <ShieldAlert className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            Данные используются исключительно в целях обучения и аттестации сотрудников. Передача третьим лицам не осуществляется.
          </div>
        </div>

        <div className="mt-7 flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => navigate("/login")}>Отмена</Button>
          <Button
            disabled={!a || !b}
            onClick={() => {
              void frontendApi.session().then((session) => {
                setRole(session.user.role);
                navigate(session.homePath);
              }).catch(() => {
                navigate(getRoleHome(role));
              });
            }}
            className="bg-primary hover:bg-primary/90 px-6"
          >
            Продолжить
          </Button>
        </div>
      </Card>
    </div>
  );
}
