"use client";
import { Home, History, Settings, ClipboardCheck, Award } from "@/components/ui/RuneIcons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Crosshair, BookOpen, LogOut, ChevronDown, PanelLeftClose, PanelLeft, Briefcase, Library, Trophy, Sun, Moon } from "lucide-react";
import { useState, useEffect, useRef, useId } from "react";
import { useTheme } from "next-themes";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAuthStore } from "@/stores/useAuthStore";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { sanitizeText } from "@/lib/sanitize";

const SIDEBAR_EXPANDED = 260;
const SIDEBAR_COLLAPSED = 76;
const STORAGE_KEY = "lh-sidebar-collapsed";
const navItems = [
  { href: "/home", label: "Центр", icon: Home },
  { href: "/training", label: "Обучение", icon: Crosshair },
  { href: "/cases", label: "Кейсы", icon: Briefcase },
  { href: "/exam", label: "Экзамен", icon: ClipboardCheck },
  { href: "/certificate", label: "Сертификат", icon: Award },
  { href: "/championship", label: "Чемпионат", icon: Trophy },
  { href: "/history", label: "История", icon: History },
  { href: "/knowledge", label: "База знаний", icon: BookOpen },
  { href: "/courses", label: "Курсы", icon: Library },
];
export interface AppSidebarProps { collapsed: boolean; onToggle: () => void; onNavigate?: () => void; drawer?: boolean; }
export default function AppSidebar({ collapsed, onToggle, onNavigate, drawer = false }: AppSidebarProps) {
  const menuId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const { resolvedTheme, setTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = sanitizeText(user?.full_name || "Профиль");
  const roleLabel = user?.role === "admin" ? "Администратор" : user?.role === "rop" || user?.role === "methodologist" ? "РОП" : user ? "Менеджер" : "";
  const isDark = resolvedTheme === "dark";
  const ThemeIcon = isDark ? Sun : Moon;
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  useEffect(() => { setUserMenuOpen(false); }, [pathname, collapsed]);
  useEffect(() => {
    if (!userMenuOpen) return;
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const outside = (event: PointerEvent) => { if (!profileRef.current?.contains(event.target as Node)) setUserMenuOpen(false); };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setUserMenuOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard); };
  }, [userMenuOpen]);

  return <aside className="workspace-sidebar" data-collapsed={collapsed} data-drawer={drawer} aria-label="Боковая панель">
    <div className="workspace-brand">
      <Link href="/home" onClick={onNavigate} aria-label="LegalHunter — центр обучения"><BrandLogo compact={collapsed} size={collapsed ? "sm" : "md"} /></Link>
      <button type="button" className="workspace-icon-button workspace-collapse" onClick={onToggle} aria-label={drawer ? "Закрыть меню" : collapsed ? "Развернуть панель" : "Свернуть панель"} aria-expanded={!collapsed}>
        {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
      </button>
    </div>
    <Tooltip.Provider delayDuration={200}>
      <nav className="workspace-navigation" aria-label="Основная навигация">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const link = <Link href={item.href} onClick={onNavigate} className="workspace-nav-link" aria-label={item.label} aria-current={active ? "page" : undefined}>
            <Icon size={21} /><span className={collapsed ? "sr-only" : "workspace-nav-label"}>{item.label}</span>
          </Link>;
          return collapsed ? <Tooltip.Root key={item.href}><Tooltip.Trigger asChild>{link}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content side="right" sideOffset={12} className="workspace-tooltip">{item.label}<Tooltip.Arrow /></Tooltip.Content></Tooltip.Portal></Tooltip.Root> : <div key={item.href}>{link}</div>;
        })}
      </nav>
    </Tooltip.Provider>
    {!collapsed && <Link href="/championship" onClick={onNavigate} className="workspace-promo"><Trophy size={20} /><span><strong>Чемпионат сезона</strong><small>Условия и призы</small></span></Link>}
    <div ref={profileRef} className="workspace-profile" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setUserMenuOpen(false); }}>
      <div className="workspace-profile-row">
        <button type="button" ref={triggerRef} onClick={() => setUserMenuOpen(open => !open)} className="workspace-profile-trigger" aria-label={`Меню пользователя: ${displayName}`} aria-expanded={userMenuOpen} aria-controls={menuId}>
          <UserAvatar avatarUrl={user?.avatar_url} fullName={displayName} size={34} />
          {!collapsed && <><span className="workspace-profile-name"><strong>{displayName}</strong><small>{roleLabel}</small></span><ChevronDown size={14} /></>}
        </button>
        <button type="button" className="workspace-icon-button workspace-profile-theme" onClick={toggleTheme} aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"} title={isDark ? "Светлая тема" : "Тёмная тема"}><ThemeIcon size={18} /></button>
      </div>
      {userMenuOpen && <div ref={menuRef} id={menuId} className="workspace-profile-menu" role="group" aria-label="Действия профиля">
        <Link href="/settings" onClick={() => { setUserMenuOpen(false); onNavigate?.(); }}><Settings size={17} />Настройки</Link>
        <button type="button" onClick={async () => { setUserMenuOpen(false); onNavigate?.(); await logout(); router.replace("/"); }}><LogOut size={17} />Выйти</button>
        <button type="button" onClick={toggleTheme}><ThemeIcon size={17} />Поменять тему<span>{isDark ? "Светлая" : "Тёмная"}</span></button>
      </div>}
    </div>
  </aside>;
}
export { SIDEBAR_EXPANDED, SIDEBAR_COLLAPSED, STORAGE_KEY };
