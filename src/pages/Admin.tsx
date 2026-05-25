import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { IconBadge } from "@/components/IconBadge";
import { ApiState } from "@/components/ApiState";
import { frontendApi } from "@/lib/frontend-api";
import { Users, GraduationCap, Shield, FileText, MessageSquareWarning, PhoneCall } from "lucide-react";

export default function Admin() {
  const { data: users, isFetching: usersFetching, isError: usersError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => frontendApi.getAdminUsers(),
  });

  const { data: tests, isFetching: testsFetching, isError: testsError } = useQuery({
    queryKey: ["admin-tests"],
    queryFn: () => frontendApi.getTestQuestions(),
  });

  const { data: cases, isFetching: casesFetching, isError: casesError } = useQuery({
    queryKey: ["admin-cases"],
    queryFn: () => frontendApi.getCaseTemplates(),
  });

  const { data: objections, isFetching: objectionsFetching, isError: objectionsError } = useQuery({
    queryKey: ["admin-objections"],
    queryFn: () => frontendApi.getObjectionTemplates(),
  });

  const { data: scripts, isFetching: scriptsFetching, isError: scriptsError } = useQuery({
    queryKey: ["admin-scripts"],
    queryFn: () => frontendApi.getCallScripts(),
  });

  const { data: notifications, isFetching: notifFetching, isError: notifError } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => frontendApi.notifications(),
  });

  const isFetching = usersFetching || testsFetching || casesFetching || objectionsFetching || scriptsFetching || notifFetching;
  const isError = usersError || testsError || casesError || objectionsError || scriptsError || notifError;

  const metrics = [
    { l: "Пользователей", v: users ? String(users.length) : "—", icon: Users },
    { l: "Тестовых вопросов", v: tests ? String(tests.length) : "—", icon: GraduationCap },
    { l: "Кейсов", v: cases ? String(cases.length) : "—", icon: FileText },
    { l: "Возражений", v: objections ? String(objections.length) : "—", icon: MessageSquareWarning },
    { l: "Скриптов звонков", v: scripts ? String(scripts.length) : "—", icon: PhoneCall },
  ];

  const recentNotifications = (notifications ?? []).slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-5">
      <div className="flex items-start gap-4">
        <IconBadge icon={Shield} />
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Администратор</div>
          <h1 className="font-display text-3xl font-bold text-primary tracking-tight mt-1">Состояние системы</h1>
        </div>
      </div>

      <ApiState isFetching={isFetching} isError={isError} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {metrics.map((s) => (
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
          {recentNotifications.length === 0 && !notifFetching && (
            <p className="text-muted-foreground py-2">Нет уведомлений</p>
          )}
          {recentNotifications.map((n, i) => (
            <div key={n.id ?? i} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <StatusBadge variant={n.tone === "destructive" ? "destructive" : n.tone === "warning" ? "warning" : n.tone === "success" ? "success" : "info"} dot> </StatusBadge>
                <span>{n.title}</span>
              </div>
              <span className="text-xs text-muted-foreground">{n.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
