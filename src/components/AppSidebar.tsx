import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, MessageSquare, History, AlertTriangle, Bell,
  Users, BarChart3, Settings, Shield, LogOut, FileText, Briefcase, MessageCircleWarning, PhoneCall
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { BrandLogo } from "@/components/BrandLogo";
import { useDemoAuth } from "@/lib/demo-auth";
import { canAccessRoute } from "@/lib/access-control";
import { cn } from "@/lib/utils";

const employeeNav = [
  { title: "Главная", url: "/dashboard", icon: LayoutDashboard },
  { title: "Режимы", url: "/modes", icon: MessageSquare },
  { title: "История", url: "/history", icon: History },
  { title: "Слабые темы", url: "/weak-topics", icon: AlertTriangle },
  { title: "Уведомления", url: "/notifications", icon: Bell },
];
const managerNav = [
  { title: "Обзор", url: "/manager", icon: LayoutDashboard },
  { title: "Сотрудники", url: "/manager", icon: Users },
  { title: "Отчёты", url: "/manager/reports", icon: BarChart3 },
];
const adminNav = [
  { title: "Система", url: "/admin", icon: Shield },
  { title: "Банк тестов", url: "/admin/tests", icon: FileText },
  { title: "Сит. кейсы", url: "/admin/cases", icon: Briefcase },
  { title: "Возражения", url: "/admin/objections", icon: MessageCircleWarning },
  { title: "Скрипты", url: "/admin/scripts", icon: PhoneCall },
  { title: "Пользователи", url: "/admin/users", icon: Users },
  { title: "Настройки", url: "/admin/settings", icon: Settings },
];

const roleNavigation = {
  employee: { label: "Сотрудник", items: employeeNav },
  manager: { label: "Руководитель", items: managerNav },
  admin: { label: "Администратор", items: adminNav },
  client: { label: "Клиент", items: [] },
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useDemoAuth();
  const nav = roleNavigation[user.role];
  const visibleItems = nav.items.filter((item) => canAccessRoute(user.role, item.url));

  const isActive = (url: string) =>
    url === pathname || (url !== "/" && pathname.startsWith(url));

  const renderGroup = (label: string, items: typeof employeeNav) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title + item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <NavLink to={item.url} className={cn(
                  "flex items-center gap-3",
                  isActive(item.url) && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <BrandLogo className="h-8 w-8 shrink-0" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground tracking-tight">HUNTERLITE</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Legal NAVI Trainer</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup(nav.label, visibleItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Выйти</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
