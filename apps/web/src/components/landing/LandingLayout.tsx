"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Mail,
  AlertCircle,
  User,
  X as XIcon,
} from "lucide-react";
import { FishermanError } from "@/components/errors/FishermanError";
import { Button } from "@/components/ui/Button";
import { getToken, setTokens } from "@/lib/auth";
import { api, resetAuthCircuitBreaker } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/public-origin";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordChecklist, isPasswordValid } from "@/components/ui/PasswordChecklist";
import { LandingNavbar } from "./LandingNavbar";
import { LandingFooter } from "./LandingFooter";
import { LandingAuthContext, type Panel } from "./LandingAuthContext";

type ForgotMode = "idle" | "form" | "sent";

const SSO_BUTTONS = [
  {
    label: "Google",
    endpoint: "/auth/google/login",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
  },
  {
    label: "Yandex",
    endpoint: "/auth/yandex/login",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24">
        <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z" fill="#FC3F1D" />
        <path d="M13.32 17.5h-1.88V7.38h-.97c-1.57 0-2.39.8-2.39 1.95 0 1.3.59 1.9 1.8 2.7l1 .65-2.9 4.82H6l2.62-4.33C7.37 12.26 6.56 11.22 6.56 9.5c0-2.07 1.45-3.5 4-3.5h2.76V17.5z" fill="white" />
      </svg>
    ),
  },
];

export function LandingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [networkError, setNetworkError] = useState(false);

  const [email, setEmail] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("vh-auth-email") ?? "";
    return "";
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("vh-auth-name") ?? "";
    return "";
  });
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotMode, setForgotMode] = useState<ForgotMode>("idle");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { setCheckingAuth(false); return; }
    router.replace("/home");
  }, [router]);

  const openPanel = (panel: Panel) => {
    setActivePanel(panel);
    setError("");
    setEmail(""); setPassword(""); setConfirmPassword(""); setFullName("");
    setForgotMode("idle"); setForgotEmail("");
  };
  const closePanel = () => { setActivePanel(null); setError(""); setForgotMode("idle"); };

  useEffect(() => {
    if (!activePanel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePanel]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (activePanel === "register") {
      if (!fullName.trim()) { setError("Укажите имя"); return; }
      if (!isPasswordValid(password)) { setError("Пароль не соответствует требованиям"); return; }
      if (password !== confirmPassword) { setError("Пароли не совпадают"); return; }
    }
    setLoading(true);
    try {
      if (activePanel === "login") {
        const data = await api.post("/auth/login", { email: email.trim(), password });
        setTokens(data.access_token, data.refresh_token, data.csrf_token);
        resetAuthCircuitBreaker();
        try { sessionStorage.removeItem("vh-auth-email"); sessionStorage.removeItem("vh-auth-name"); } catch {}
        if (data.must_change_password) {
          router.push("/change-password");
        } else {
          router.push("/home");
        }
      } else {
        const data = await api.post("/auth/register", {
          email: email.trim(), password, full_name: fullName.trim(),
        });
        setTokens(data.access_token, data.refresh_token, data.csrf_token);
        resetAuthCircuitBreaker();
        router.push("/home");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка";
      if (msg.includes("недоступен") || msg.includes("fetch") || msg.includes("network")) {
        setNetworkError(true);
      } else { setError(msg); }
    } finally { setLoading(false); }
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
    } catch { /* silent -- always show success for security */ }
    setForgotLoading(false);
    setForgotMode("sent");
  };

  const handleSso = async (endpoint: string, label: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await api.get(endpoint);
      if (data?.url) {
        const { validateOAuthUrl } = await import("@/lib/sanitize");
        const safeUrl = validateOAuthUrl(data.url);
        if (safeUrl) {
          window.location.href = safeUrl;
        } else {
          setError(`Недоверенный OAuth URL от ${label}`);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${label} OAuth недоступен`);
    } finally { setLoading(false); }
  };

  const contextValue = useMemo(() => ({
    openLogin: () => openPanel("login"),
    openRegister: () => openPanel("register"),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (networkError) {
    return (
      <FishermanError
        onRetry={() => { setNetworkError(false); setError(""); }}
        message="Сервер временно недоступен..."
      />
    );
  }
  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full animate-ping bg-[#F97316]" />
          <span className="text-sm tracking-wide text-gray-400">Загрузка...</span>
        </motion.div>
      </div>
    );
  }

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  return (
    <LandingAuthContext.Provider value={contextValue}>
      <div className="bg-white min-h-screen">
        <LandingNavbar
          onLogin={() => openPanel("login")}
          onRegister={() => openPanel("register")}
        />

        {children}

        <LandingFooter />

        {/* Auth Drawer */}
        <AnimatePresence>
          {activePanel && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[200] cursor-pointer bg-black/40 backdrop-blur-sm"
                onClick={closePanel}
              />

              <motion.div
                key="drawer"
                role="dialog"
                aria-modal="true"
                aria-label={activePanel === "login" ? "Вход в систему" : "Регистрация"}
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="fixed right-0 top-0 bottom-0 z-[201] w-full sm:max-w-[440px] overflow-y-auto bg-white border-l border-gray-100 shadow-2xl"
              >
                {/* Drawer header */}
                <div className="sticky top-0 z-10 flex items-center justify-center relative px-5 sm:px-8 py-5 bg-white border-b border-gray-100">
                  <h2 className="font-semibold text-lg text-gray-900">
                    {forgotMode !== "idle"
                      ? "Восстановление пароля"
                      : activePanel === "login" ? "Вход" : "Регистрация"}
                  </h2>
                  <button
                    onClick={closePanel}
                    className="absolute right-5 sm:right-8 w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                    aria-label="Закрыть"
                  >
                    <XIcon size={15} className="text-gray-400" />
                  </button>
                </div>

                {/* Orange accent line */}
                <div className="h-[2px] w-full bg-gradient-to-r from-[#F97316] via-[#0891B2] to-transparent opacity-60" />

                {/* Form body */}
                <div className="px-5 sm:px-8 py-7">
                  <AnimatePresence mode="wait">
                    {forgotMode !== "idle" ? (
                      <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                        {forgotMode === "sent" ? (
                          <div className="text-center py-8">
                            <motion.div
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-emerald-50 border border-emerald-100"
                            >
                              <Mail size={22} className="text-emerald-500" />
                            </motion.div>
                            <h3 className="font-semibold text-lg mb-2 text-gray-900">Письмо отправлено</h3>
                            <p className="text-sm text-gray-500 mb-6">
                              Проверьте <strong className="text-gray-700">{forgotEmail}</strong><br />и следуйте инструкциям.
                            </p>
                            <button onClick={() => { setForgotMode("idle"); setForgotEmail(""); }} className="flex items-center gap-1.5 text-sm font-medium text-[#F97316] hover:opacity-80 transition-opacity">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                              Вернуться ко входу
                            </button>
                          </div>
                        ) : (
                          <div>
                            <button onClick={() => setForgotMode("idle")} className="flex items-center gap-1.5 text-sm font-medium mb-6 text-gray-500 hover:opacity-80 transition-colors">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                              Назад
                            </button>
                            <h3 className="font-semibold text-xl mb-1.5 text-gray-900">Забыли пароль?</h3>
                            <p className="text-sm text-gray-500 mb-6 leading-relaxed">Введите email -- пришлем ссылку для сброса.</p>
                            <label className="vh-label">Email</label>
                            <div className="relative mb-4">
                              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="vh-input pl-10 w-full" placeholder="Ваш email" autoComplete="email" />
                            </div>
                            <Button variant="primary" fluid loading={forgotLoading} disabled={!forgotEmail.trim()} icon={<Mail size={15} />} onClick={handleForgot}>
                              Отправить ссылку
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div key="main" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
                        {error && (
                          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl p-3 text-sm mb-5 bg-red-50 border border-red-100 text-red-600">
                            <AlertCircle size={16} />{error}
                          </motion.div>
                        )}

                        {/* SSO */}
                        <div className="mb-5">
                          <div className="flex gap-3">
                            {SSO_BUTTONS.map(({ label, endpoint, icon }) => (
                              <motion.button
                                key={label}
                                type="button"
                                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm border border-gray-200 text-gray-600 hover:border-gray-300 transition-colors"
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleSso(endpoint, label)}
                              >
                                {icon}{label}
                              </motion.button>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-4">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-sm text-gray-400">или через email</span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                          {activePanel === "register" && (
                            <div>
                              <label className="vh-label">Полное имя</label>
                              <div className="relative">
                                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); try { sessionStorage.setItem("vh-auth-name", e.target.value); } catch {} }} required className="vh-input pl-10 w-full" placeholder="Иван Петров" autoComplete="name" />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="vh-label">Email</label>
                            <div className="relative">
                              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); try { sessionStorage.setItem("vh-auth-email", e.target.value); } catch {} }} required className="vh-input pl-10 w-full" placeholder="Ваш email" autoComplete="email" />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="vh-label mb-0">Пароль</label>
                              {activePanel === "login" && (
                                <button type="button" onClick={() => setForgotMode("form")} className="text-sm text-[#F97316] hover:opacity-80 transition-colors">Забыли пароль?</button>
                              )}
                            </div>
                            <PasswordInput id="panel-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={activePanel === "register" ? "Минимум 8 символов" : "Введите пароль"} autoComplete={activePanel === "login" ? "current-password" : "new-password"} ariaLabel="Пароль" />
                            {activePanel === "register" && <PasswordChecklist value={password} />}
                          </div>

                          {activePanel === "register" && (
                            <div>
                              <label className="vh-label">Повторите пароль</label>
                              <PasswordInput id="panel-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Введите пароль ещё раз" autoComplete="new-password" ariaLabel="Подтвердите пароль" />
                              {!passwordsMatch && <p className="mt-1.5 text-xs text-red-500">Пароли не совпадают</p>}
                            </div>
                          )}

                          {activePanel === "login" && (
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                              <div
                                className="relative w-9 h-5 rounded-full cursor-pointer flex-shrink-0 transition-colors duration-200"
                                style={{ background: rememberMe ? "#F97316" : "#E5E7EB", border: `1px solid ${rememberMe ? "#F97316" : "#D1D5DB"}` }}
                                onClick={() => setRememberMe(!rememberMe)}
                              >
                                <motion.div className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm" animate={{ left: rememberMe ? 18 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                              </div>
                              <span className="text-xs text-gray-500">Запомнить меня</span>
                            </label>
                          )}

                          <Button type="submit" variant="primary" fluid loading={loading} disabled={!passwordsMatch} iconRight={<ArrowRight size={16} />}>
                            {activePanel === "login" ? "Войти" : "Зарегистрироваться"}
                          </Button>
                        </form>

                        <p className="mt-5 text-center text-sm text-gray-500">
                          {activePanel === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
                          <button onClick={() => openPanel(activePanel === "login" ? "register" : "login")} className="font-medium text-[#F97316]">
                            {activePanel === "login" ? "Зарегистрироваться" : "Войти"}
                          </button>
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </LandingAuthContext.Provider>
  );
}
