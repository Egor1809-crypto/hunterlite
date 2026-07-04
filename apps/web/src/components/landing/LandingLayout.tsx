"use client";

import { useEffect, useState, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
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

// 2026-06-19 (149-ФЗ): Google removed — foreign identity providers are not
// permitted. Only Yandex ID (allowed RU provider) remains here.
const SSO_BUTTONS = [
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
  const pathname = usePathname();
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
    if (pathname === "/") {
      setCheckingAuth(false);
      return;
    }
    const token = getToken();
    if (!token) { setCheckingAuth(false); return; }
    router.replace("/home");
  }, [pathname, router]);

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
          <div className="w-2 h-2 rounded-full animate-ping bg-[#7C3AED]" />
          <span className="text-sm tracking-wide text-gray-400">Загрузка...</span>
        </motion.div>
      </div>
    );
  }

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const isCustomLanding = pathname === "/";

  return (
    <LandingAuthContext.Provider value={contextValue}>
      <div className="bg-white min-h-screen">
        {!isCustomLanding && (
          <LandingNavbar
            onLogin={() => openPanel("login")}
            onRegister={() => openPanel("register")}
          />
        )}

        {children}

        {/* Футер показываем ВЕЗДЕ, включая главную «/»: юридические документы
            (Политика ПДн, Cookie, Согласие, Соглашение, Оферта) и контакты
            обязаны быть доступны с любой страницы (152-ФЗ / требования РКН).
            Раньше на «/» он был скрыт вместе с навбаром через isCustomLanding. */}
        <LandingFooter />

        {/* Auth Modal */}
        <AnimatePresence>
          {activePanel && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer bg-[#18131D]/45 backdrop-blur-sm p-4"
                onClick={closePanel}
              >
              <motion.div
                key="modal"
                role="dialog"
                aria-modal="true"
                aria-label={activePanel === "login" ? "Вход в систему" : "Регистрация"}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-[201] w-full max-w-[460px] max-h-[92vh] cursor-default overflow-y-auto rounded-[28px] border border-[#E7DAF2] shadow-[0_30px_80px_-20px_rgba(24,19,29,0.35)]"
                style={{
                  background: "#FFFDF8",
                  // Cream / purple editorial palette to match the landing vibe.
                  ["--text-primary" as string]: "#18131D",
                  ["--text-secondary" as string]: "#6B5E78",
                  ["--text-muted" as string]: "#9B8FA8",
                  ["--input-bg" as string]: "#FBF6EF",
                  ["--input-border" as string]: "#E7DAF2",
                  ["--input-focus" as string]: "#7C3AED",
                  ["--border-color" as string]: "#E7DAF2",
                  ["--primary" as string]: "#18131D",
                  ["--primary-hover" as string]: "#7C3AED",
                  ["--accent" as string]: "#7C3AED",
                  ["--accent-hover" as string]: "#6D28D9",
                  ["--accent-muted" as string]: "rgba(124, 58, 237, 0.12)",
                  ["--accent-glow" as string]: "rgba(124, 58, 237, 0.28)",
                  ["--bg-secondary" as string]: "#F7F1E8",
                  ["--radius-md" as string]: "0.875rem",
                  ["--fs-sm" as string]: "0.875rem",
                  ["--fs-xs" as string]: "0.75rem",
                  ["--ls-wide" as string]: "0.025em",
                }}
              >
                {/* Modal header */}
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-7 sm:px-9 pt-8 pb-5 bg-[#FFFDF8]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9B7DB4]">
                      LegalHunter
                    </p>
                    <h2 className="mt-2 text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.03em] text-[#18131D]">
                      {forgotMode !== "idle"
                        ? "Сброс пароля"
                        : activePanel === "login" ? "С возвращением" : "Создать аккаунт"}
                    </h2>
                    {forgotMode === "idle" && (
                      <p className="mt-2 text-sm leading-relaxed text-[#6B5E78]">
                        {activePanel === "login"
                          ? "Войдите, чтобы продолжить обучение."
                          : "Несколько шагов — и вы в деле."}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={closePanel}
                    className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#E7DAF2] bg-[#F7F1E8] text-[#6B5E78] transition-colors hover:border-[#C6A7DD] hover:text-[#7C3AED]"
                    aria-label="Закрыть"
                  >
                    <XIcon size={16} />
                  </button>
                </div>

                {/* Purple accent line */}
                <div className="mx-7 sm:mx-9 h-px bg-gradient-to-r from-[#C6A7DD] via-[#7C3AED]/40 to-transparent" />

                {/* Form body */}
                <div className="px-7 sm:px-9 pt-6 pb-8">
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
                            <button onClick={() => { setForgotMode("idle"); setForgotEmail(""); }} className="flex items-center gap-1.5 text-sm font-medium text-[#7C3AED] hover:opacity-80 transition-opacity">
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
                                <button type="button" onClick={() => setForgotMode("form")} className="text-sm text-[#7C3AED] hover:opacity-80 transition-colors">Забыли пароль?</button>
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
                                style={{ background: rememberMe ? "#7C3AED" : "#E5E7EB", border: `1px solid ${rememberMe ? "#7C3AED" : "#D1D5DB"}` }}
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
                          <button onClick={() => openPanel(activePanel === "login" ? "register" : "login")} className="font-medium text-[#7C3AED]">
                            {activePanel === "login" ? "Зарегистрироваться" : "Войти"}
                          </button>
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </LandingAuthContext.Provider>
  );
}
