"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, resetAuthCircuitBreaker } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useAuthStore } from "@/stores/useAuthStore";
import { resetConsentCache } from "@/lib/consentCache";
import { loginDestination } from "@/lib/loginDestination";

function OAuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (params.get("error")) { setError("Вход через Яндекс отменён. Можно попробовать снова или войти по email."); return; }
    const code = params.get("code"), state = params.get("state");
    if (!code || !state?.startsWith("yandex:")) { setError("Ссылка для входа недействительна. Начните вход заново."); return; }
    api.post<{access_token:string;refresh_token:string;csrf_token?:string;must_change_password?:boolean}>("/auth/yandex/callback", {code,state}, {timeoutMs:15000})
      .then(data=>{
        setTokens(data.access_token,data.refresh_token,data.csrf_token);
        resetAuthCircuitBreaker(); resetConsentCache();
        useAuthStore.getState().setUser(null); useAuthStore.getState().invalidate();
        void useAuthStore.getState().fetchUser();
        let redirect: string | null = null;
        try { redirect=sessionStorage.getItem("lh-auth-return");sessionStorage.removeItem("lh-auth-return"); } catch {}
        router.replace(loginDestination(Boolean(data.must_change_password),redirect));
      }).catch(()=>setError("Не удалось завершить вход через Яндекс. Повторите вход или используйте email."));
  },[params,router]);
  return <main className="auth-page"><section className="auth-card">
    {error ? <><h1 className="text-xl font-semibold">Не удалось войти</h1><p className="auth-error mt-5" role="alert">{error}</p><button type="button" className="auth-primary mt-5" onClick={()=>router.replace("/login")}>Вернуться ко входу</button></> : <p role="status" className="flex items-center gap-3"><Loader2 className="auth-spinner" size={22} />Завершаем вход…</p>}
  </section></main>;
}
export default function OAuthCallbackPage() {
  return <Suspense fallback={<main className="auth-page"><p role="status">Завершаем вход…</p></main>}><OAuthCallbackContent /></Suspense>;
}
