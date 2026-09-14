"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { LandingNavbar } from "./LandingNavbar";
import { LandingFooter } from "./LandingFooter";
import { LandingAuthContext, type Panel } from "./LandingAuthContext";
const AuthCard = dynamic(() => import("@/components/auth/AuthCard"), {loading:()=> <p className="auth-preparing" role="status">Открываем форму входа…</p>});

export function LandingLayout({children}:{children:React.ReactNode}) {
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!panel || !element) return;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previousOverflow; trigger?.focus(); };
  }, [panel]);
  useEffect(()=>setPanel(null),[pathname]);
  const context = useMemo(()=>({openLogin:()=>setPanel("login"),openRegister:()=>setPanel("register")}),[]);
  return <LandingAuthContext.Provider value={context}>
    <div style={{background:"var(--bg-primary)",minHeight:"100dvh"}}>
      {pathname !== "/" && <LandingNavbar onLogin={context.openLogin} onRegister={context.openRegister} />}
      {children}<LandingFooter />
      <dialog ref={dialog} className="auth-dialog" aria-label="Аккаунт LegalHunter" onCancel={event=>{event.preventDefault();setPanel(null);}} onClick={event=>{if(event.target===event.currentTarget)setPanel(null);}}>
        {panel && <AuthCard key={panel} initialMode={panel} onClose={()=>setPanel(null)} />}
      </dialog>
    </div>
  </LandingAuthContext.Provider>;
}
