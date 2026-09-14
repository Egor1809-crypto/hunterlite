"use client";
import { useState, useEffect, useCallback, useRef, type ReactNode, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { isFocusedWorkspace } from "@/lib/workspaceRoutes";
import { Menu } from "lucide-react";
import AppSidebar, { SIDEBAR_EXPANDED, SIDEBAR_COLLAPSED, STORAGE_KEY } from "./AppSidebar";
import { EnergyStatus } from "./EnergyStatus";
import { WorkspaceLoading } from "./WorkspaceLoading";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const focused = isFocusedWorkspace(pathname);
  const Main = focused ? "div" : "main";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === "true"); } catch {}
    setMounted(true);
  }, []);
  const toggleCollapse = useCallback(() => setCollapsed(previous => {
    const next = !previous;
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
    return next;
  }), []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const media = matchMedia("(min-width: 768px)");
    const resized = () => { if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", resized);
    return () => media.removeEventListener("change", resized);
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (mobileOpen) dialog?.showModal();
    else if (dialog?.open) { dialog.close(); menuTriggerRef.current?.focus(); }
  }, [mobileOpen]);
  return <div className="editorial-app workspace-shell" data-focused={focused} style={{"--workspace-sidebar-width":`${focused ? 0 : collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED}px`} as CSSProperties}>
    <div className="workspace-desktop-sidebar">{mounted && !focused && <AppSidebar collapsed={collapsed} onToggle={toggleCollapse} />}</div>
    <dialog ref={dialogRef} className="workspace-drawer" aria-label="Меню платформы" onCancel={e => { e.preventDefault(); setMobileOpen(false); }} onClick={e => { if (e.target === e.currentTarget) setMobileOpen(false); }}>
      {mobileOpen && <AppSidebar collapsed={false} drawer onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />}
    </dialog>
    <header className="workspace-topbar">
      {!focused && <button type="button" ref={menuTriggerRef} className="workspace-icon-button workspace-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Открыть меню" aria-expanded={mobileOpen}><Menu size={21} /></button>}
      <EnergyStatus />
    </header>
    <Main className="workspace-main" id="workspace-main">
      {mounted ? <div className="workspace-content" key={pathname}>{children}</div> : <WorkspaceLoading />}
    </Main>
  </div>;
}
