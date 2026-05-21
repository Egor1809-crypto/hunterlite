import { Link, Outlet, useLocation } from "react-router-dom";
import { AlarmClock, Bell, CalendarCheck2, ChevronRight, Home, Sparkles } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppSidebar } from "./AppSidebar";
import { useDemoAuth } from "@/lib/demo-auth";
import { getRoleHome } from "@/lib/demo-auth-state";
import { frontendApi, frontendFallbacks, useApiData } from "@/lib/frontend-api";
import { StatusBadge } from "./StatusBadge";

const notificationIcons = [AlarmClock, CalendarCheck2, Sparkles];

export default function AppLayout() {
  const { pathname } = useLocation();
  const { user: authUser } = useDemoAuth();
  const { data: user } = useApiData({
    queryKey: ["current-user", authUser.role],
    request: () => frontendApi.currentUser(authUser.role),
    fallback: () => frontendFallbacks.currentUser(authUser.role),
  });
  const { data: notifications } = useApiData({
    queryKey: ["notifications"],
    request: frontendApi.notifications,
    fallback: frontendFallbacks.notifications,
  });
  const trainingNotifications = notifications.slice(0, 3);
  const homePath = getRoleHome(user.role);
  const isHome = pathname === homePath;
  const unreadCount = trainingNotifications.filter((item) => item.unread).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-transparent">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-3 md:px-6 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              {!isHome && (
                <Link
                  to={homePath}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Перейти на главную"
                >
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Главная</span>
                </Link>
              )}
              <div className="hidden md:block text-sm text-muted-foreground">
                Платформа аттестации юристов по банкротству физических лиц
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Открыть уведомления">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={10} className="w-[340px] p-0 overflow-hidden shadow-elevated">
                  <div className="border-b border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-display font-bold text-primary">Уведомления</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Ежедневные тренировки и рекомендации</div>
                      </div>
                      <StatusBadge variant="destructive">{unreadCount} новых</StatusBadge>
                    </div>
                  </div>
                  <div className="p-2">
                    {trainingNotifications.map((item, index) => {
                      const NotificationIcon = notificationIcons[index] || Bell;

                      return (
                      <Link
                        key={item.title}
                        to={item.actionUrl || "/notifications"}
                        className="group flex gap-3 rounded-lg p-3 transition-colors hover:bg-muted/70"
                      >
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground shrink-0">
                          <NotificationIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-sm text-foreground truncate">{item.title}</div>
                            <StatusBadge variant={item.tone} className="px-2 py-0.5">{item.time}</StatusBadge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.body}</p>
                        </div>
                      </Link>
                      );
                    })}
                  </div>
                  <div className="border-t border-border p-2">
                    <Link
                      to="/notifications"
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-muted/70"
                    >
                      Все уведомления
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </PopoverContent>
              </Popover>
              <Link
                to="/profile"
                className="flex items-center gap-2.5 pl-3 border-l border-border rounded-lg py-1 pr-1 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Открыть профиль пользователя"
              >
                <div className="hidden sm:block text-right leading-tight">
                  <div className="text-sm font-semibold text-foreground">{user.name}</div>
                  <div className="text-[11px] text-muted-foreground">{user.roleLabel}</div>
                </div>
                <div className="h-9 w-9 rounded-full bg-gradient-ai flex items-center justify-center text-white text-sm font-semibold">
                  {user.firstName[0]}{user.name.split(" ")[1]?.[0] || ""}
                </div>
                <StatusBadge variant="success" dot className="hidden md:inline-flex">{user.status}</StatusBadge>
              </Link>
            </div>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
