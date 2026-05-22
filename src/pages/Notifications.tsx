import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { frontendFallbacks } from "@/lib/frontend-api";
import { useLiveNotifications } from "@/lib/live-notifications";
import { AlertTriangle, Bell, CalendarCheck2, CheckCircle2, Sparkles } from "lucide-react";

const notificationIcons = {
  info: CalendarCheck2,
  warning: Sparkles,
  success: CheckCircle2,
  destructive: AlertTriangle,
} as const;

const notificationIconStyles = {
  info: "bg-info-soft text-info-soft-foreground border-info/20",
  warning: "bg-warning-soft text-warning-soft-foreground border-warning/20",
  success: "bg-success-soft text-success-soft-foreground border-success/20",
  destructive: "bg-destructive-soft text-destructive-soft-foreground border-destructive/20",
} as const;

export default function Notifications() {
  const { data: notifications, isFetching, isError } = useLiveNotifications(frontendFallbacks.notifications());

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-start gap-4">
        <IconBadge icon={Bell} />
        <div>
          <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Уведомления</h1>
          <p className="text-muted-foreground mt-1">Назначенные курсы, рекомендации ИИ и сообщения руководителя. Лента обновляется автоматически.</p>
        </div>
      </div>

      <ApiState
        isFetching={isFetching}
        isError={isError}
        isEmpty={notifications.length === 0}
        emptyText="Новых уведомлений пока нет."
      />

      <div className="space-y-3">
        {notifications.map((n) => {
          const NotificationIcon = notificationIcons[n.tone];

          return (
          <Card key={n.id} className="p-4 shadow-card flex gap-3">
            <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${notificationIconStyles[n.tone]}`}>
              <NotificationIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.time}</div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
            </div>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
