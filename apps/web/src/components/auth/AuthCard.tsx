"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Mail, X } from "lucide-react";
import { api, ApiError, resetAuthCircuitBreaker } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useAuthStore } from "@/stores/useAuthStore";
import { resetConsentCache } from "@/lib/consentCache";
import { loginDestination } from "@/lib/loginDestination";
import { validateOAuthUrl } from "@/lib/sanitize";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { PasswordChecklist, isPasswordValid } from "@/components/ui/PasswordChecklist";

type Mode = "login" | "register" | "forgot" | "sent";
type Tokens = {access_token: string; refresh_token: string; csrf_token?: string; must_change_password?: boolean};
export default function AuthCard({initialMode = "login", onClose, standalone = false}: {initialMode?: "login" | "register"; onClose?: () => void; standalone?: boolean}) {
  const router = useRouter();
  const id = useId();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState("");
  const [pending, setPending] = useState<"email" | "yandex" | null>(null);
  const [yandex, setYandex] = useState<boolean | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const Heading = standalone ? "h1" : "h2";
  useEffect(() => {
    const controller = new AbortController();
    api.get<{yandex:boolean}>("/auth/oauth/status", {signal:controller.signal}).then(x => setYandex(x.yandex)).catch(() => { if (!controller.signal.aborted) setYandex(false); });
    return () => { controller.abort(); requestRef.current?.abort(); };
  }, []);
  function switchMode(next: Mode) {
    if (pending) return;
    setMode(next); setError(""); setInvalid(""); setPassword(""); setConfirmation(""); setVisible(false);
  }
  function fieldError(field: string, message: string) {
    setInvalid(field); setError(message);
    formRef.current?.elements.namedItem(field) && (formRef.current.elements.namedItem(field) as HTMLElement).focus();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (requestRef.current) return;
    setError(""); setInvalid("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return fieldError("email", "Введите email в формате name@example.ru.");
    if (mode === "register" && !name.trim()) return fieldError("name", "Укажите ваше имя.");
    if (mode !== "forgot" && !password) return fieldError("password", "Введите пароль.");
    if (mode === "register") {
      if (!isPasswordValid(password)) return fieldError("password", "Проверьте требования к паролю ниже.");
      if (password !== confirmation) return fieldError("confirmation", "Пароли не совпадают.");
      if (!consent) return fieldError("consent", "Подтвердите согласие на обработку персональных данных.");
    }
    const controller = new AbortController(); requestRef.current = controller; setPending("email");
    try {
      if (mode === "forgot") {
        await api.post("/auth/forgot-password", {email:normalizedEmail}, {signal:controller.signal,timeoutMs:15000});
        if (!controller.signal.aborted) setMode("sent");
      } else {
        const body = mode === "register" ? {email:normalizedEmail,password,full_name:name.trim(),consent_accepted:consent,marketing_accepted:marketing} : {email:normalizedEmail,password};
        const data = await api.post<Tokens>(`/auth/${mode}`, body, {signal:controller.signal,timeoutMs:15000});
        if (controller.signal.aborted) return;
        setTokens(data.access_token, data.refresh_token, data.csrf_token);
        resetAuthCircuitBreaker(); resetConsentCache();
        useAuthStore.getState().setUser(null); useAuthStore.getState().invalidate();
        void useAuthStore.getState().fetchUser();
        router.replace(loginDestination(Boolean(data.must_change_password), new URLSearchParams(window.location.search).get("redirect")));
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof ApiError && e.status === 401 ? "Неверный email или пароль. Проверьте данные и попробуйте снова." : e instanceof Error ? e.message : "Не удалось выполнить запрос. Попробуйте ещё раз.");
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally { if (requestRef.current === controller) requestRef.current = null; if (!controller.signal.aborted) setPending(null); }
  }
  async function signInYandex() {
    if (requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller; setPending("yandex"); setError("");
    try {
      const data = await api.get<{url:string}>("/auth/yandex/login", {signal:controller.signal});
      if (controller.signal.aborted) return;
      const url = validateOAuthUrl(data.url);
      if (!url) throw new Error("Не удалось открыть Яндекс ID. Попробуйте ещё раз.");
      try { sessionStorage.setItem("lh-auth-return", loginDestination(false, new URLSearchParams(window.location.search).get("redirect"))); } catch {}
      window.location.assign(url);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Яндекс ID временно недоступен."); }
    finally { if (requestRef.current === controller) requestRef.current = null; if (!controller.signal.aborted) setPending(null); }
  }
  const fieldProps = (field: string) => ({id:`${id}-${field}`,name:field,"aria-invalid":invalid === field,"aria-describedby":invalid === field ? `${id}-error` : undefined});
  return <section className="auth-card" aria-label={mode === "register" ? "Регистрация" : "Вход в систему"}>
    <header className="auth-card-header">
      <BrandLogo size="lg" />
      {onClose && <button type="button" className="auth-close" onClick={onClose} aria-label="Закрыть окно входа"><X size={20} /></button>}
      <Heading>{mode === "forgot" || mode === "sent" ? "Восстановить пароль" : mode === "register" ? "Создать аккаунт" : "Войти в LegalHunter"}</Heading>
      <p>{mode === "login" ? "Продолжите обучение с того места, где остановились." : mode === "register" ? "Практика, кейсы и аттестация в одном аккаунте." : "Отправим ссылку на email вашего аккаунта."}</p>
    </header>
    {mode === "sent" ? <div className="auth-sent" role="status"><Mail size={28} /><h3>Проверьте почту</h3><p>Если аккаунт <strong>{email.trim()}</strong> существует, вы получите письмо со ссылкой. Проверьте также папку «Спам».</p><button className="auth-primary" onClick={() => switchMode("login")}>Вернуться ко входу</button></div> : <>
      {(mode === "login" || mode === "register") && <>
        <button type="button" className="auth-yandex" onClick={signInYandex} disabled={Boolean(pending) || yandex !== true} aria-label="Войти с Яндекс ID">
          {pending === "yandex" ? <Loader2 size={22} className="auth-spinner" /> : null}<span>Войти с</span><img src="/brand/yandex-id.svg" width="96" height="28" alt="Яндекс ID" />
        </button>
        {yandex === false && <p className="auth-provider-note">Яндекс ID временно недоступен. Войдите по email.</p>}
        <div className="auth-divider"><span>или по email</span></div>
      </>}
      {mode === "forgot" && <button type="button" className="auth-back" onClick={() => switchMode("login")} disabled={Boolean(pending)}><ArrowLeft size={17} />Вернуться ко входу</button>}
      <form ref={formRef} onSubmit={submit} className="auth-form" noValidate aria-busy={Boolean(pending)}>
        {error && <p ref={errorRef} id={`${id}-error`} role="alert" tabIndex={-1} className="auth-error">{error}</p>}
        {mode === "register" && <div className="auth-field"><label htmlFor={`${id}-name`}>Имя и фамилия</label><input {...fieldProps("name")} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Иван Петров" disabled={Boolean(pending)} /></div>}
        <div className="auth-field"><label htmlFor={`${id}-email`}>Email</label><input {...fieldProps("email")} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.ru" disabled={Boolean(pending)} /></div>
        {mode !== "forgot" && <div className="auth-field">
          <div className="auth-label-row"><label htmlFor={`${id}-password`}>Пароль</label>{mode === "login" && <button type="button" onClick={()=>switchMode("forgot")} disabled={Boolean(pending)}>Забыли пароль?</button>}</div>
          <div className="auth-password"><input {...fieldProps("password")} type={visible ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Введите пароль" disabled={Boolean(pending)} /><button type="button" aria-label={visible ? "Скрыть пароль" : "Показать пароль"} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
          {mode === "register" && <PasswordChecklist value={password} />}
        </div>}
        {mode === "register" && <>
          <div className="auth-field"><label htmlFor={`${id}-confirmation`}>Повторите пароль</label><input {...fieldProps("confirmation")} type={visible ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={Boolean(pending)} /></div>
          <label className="auth-check"><input {...fieldProps("consent")} type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={Boolean(pending)} /><span>Принимаю <a href="/legal/terms" target="_blank" rel="noreferrer">условия использования</a> и даю <a href="/legal/consent" target="_blank" rel="noreferrer">согласие на обработку данных</a>.</span></label>
          <label className="auth-check"><input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)} disabled={Boolean(pending)} /><span>Хочу получать новости и предложения. Необязательно.</span></label>
        </>}
        <button className="auth-primary" type="submit" disabled={Boolean(pending)}>{pending === "email" && <Loader2 size={19} className="auth-spinner" />}{mode === "forgot" ? "Отправить ссылку" : mode === "register" ? "Создать аккаунт" : "Войти"}{!pending && <ArrowRight size={19} />}</button>
      </form>
      {(mode === "login" || mode === "register") && <p className="auth-footer">{mode === "login" ? "Нет аккаунта?" : "Уже зарегистрированы?"} <button type="button" disabled={Boolean(pending)} onClick={()=>switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Создать аккаунт" : "Войти"}</button></p>}
    </>}
  </section>;
}
