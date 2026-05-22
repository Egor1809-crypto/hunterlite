import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { IconBadge } from "@/components/IconBadge";
import { Activity, Users, GraduationCap, AlertCircle, Shield } from "lucide-react";

export default function Admin() {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <div className="flex items-start gap-4">
        <IconBadge icon={Shield} />
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Администратор</div>
          <h1 className="font-display text-3xl font-bold text-primary tracking-tight mt-1">Состояние системы</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "Активных пользователей", v: "187", icon: Users },
          { l: "Экзаменов сегодня", v: "34", icon: GraduationCap },
          { l: "Аптайм", v: "99.98%", icon: Activity },
          { l: "Ошибок за сутки", v: "2", icon: AlertCircle },
        ].map((s) => (
          <Card key={s.l} className="p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{s.l}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-pixel-number text-2xl mt-2">{s.v}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5 shadow-card">
        <h3 className="font-display font-bold text-primary mb-3">Системные уведомления</h3>
        <div className="space-y-2 text-sm">
          {[
            { t: "Обновление ИИ-модуля оценки до v2.4", time: "сегодня, 09:14", v: "info" as const },
            { t: "Плановое обслуживание БД 02.05 03:00–03:30 МСК", time: "вчера", v: "warning" as const },
            { t: "Все юридические шаблоны актуализированы", time: "3 дня назад", v: "success" as const },
          ].map((n, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <StatusBadge variant={n.v} dot> </StatusBadge>
                <span>{n.t}</span>
              </div>
              <span className="text-xs text-muted-foreground">{n.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
