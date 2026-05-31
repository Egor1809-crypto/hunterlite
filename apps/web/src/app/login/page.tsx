"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowRight, AlertCircle, KeyRound } from "lucide-react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/Button";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { api, resetAuthCircuitBreaker } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/public-origin";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FishermanError } from "@/components/errors/FishermanError";

type ForgotMode = "idle" | "form" | "sent";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("vh-login-email") ?? "";
    return "";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [forgotMode, setForgotMode] = useState<ForgotMode>("idle");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{ google: boolean; yandex: boolean }>({ google: false, yandex: false });

  useEffect(() => {
    api.get<{ google: boolean; yandex: boolean }>("/auth/oauth/status")
      .then(setOauthStatus)
      .catch((err) => logger.error("[login] oauth status fetch failed:", err));
  }, []);

  const handleForgot = async () => {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
    } catch { /* silent — always show success for security */ }
    setForgotLoading(false);
    setForgotMode("sent");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Введите корректный email");
      return;
    }
    if (!password || password.length < 4) {
      setError("Пароль должен содержать минимум 4 символа");
      return;
    }

    setLoading(true);

    try {
      const data = await api.post("/auth/login", { email: trimmedEmail, password });
      setTokens(data.access_token, data.refresh_token, data.csrf_token);
      resetAuthCircuitBreaker();

      if (data.needs_onboarding) {
        router.push("/home");
        return;
      }

      try { sessionStorage.removeItem("vh-login-email"); } catch {}
      if (data.must_change_password) {
        router.push("/change-password");
      } else {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect");
        const isSafeRedirect = redirect && redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.includes("\\");
        if (isSafeRedirect && redirect !== "/login") {
          router.push(redirect);
        } else {
          router.push("/home");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка входа";
      if (msg.includes("недоступен") || msg.includes("fetch") || msg.includes("network")) {
        setNetworkError(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (networkError) {
    return (
      <FishermanError
        onRetry={() => { setNetworkError(false); setError(""); }}
        message="Похоже, сервер временно недоступен..."
      />
    );
  }

  // Forgot-password screen
  if (forgotMode !== "idle") {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl p-8"
          style={{
            backgroundColor: "var(--surface-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {forgotMode === "sent" ? (
            <div className="text-center py-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 280 }}
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.1)" }}
              >
                <Mail size={24} style={{ color: "rgb(16, 185, 129)" }} />
              </motion.div>
              <h2
                className="font-semibold text-xl mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Письмо отправлено
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Проверьте <strong style={{ color: "var(--text-secondary)" }}>{forgotEmail}</strong>
                <br />и следуйте инструкциям в письме.
              </p>
              <button
                onClick={() => { setForgotMode("idle"); setForgotEmail(""); }}
                className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 mx-auto"
                style={{ color: "var(--primary)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Вернуться ко входу
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setForgotMode("idle")}
                className="flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Назад
              </button>
              <div className="mb-6 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--primary-muted)" }}
                >
                  <KeyRound size={18} style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
                    Забыли пароль?
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Пришлём ссылку для сброса
                  </p>
                </div>
              </div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <div className="relative mb-4">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="vh-input pl-10 w-full"
                  placeholder="Ваш email"
                  autoComplete="email"
                  onKeyDown={(e) => e.key === "Enter" && handleForgot()}
                />
              </div>
              <Button variant="primary" fluid loading={forgotLoading} disabled={!forgotEmail.trim()} icon={<Mail size={15} />} onClick={handleForgot}>
                Отправить ссылку
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      {/* Subtle gradient accent line at top */}
      <div
        className="fixed top-0 left-0 right-0 h-1 z-20"
        style={{
          background: "linear-gradient(90deg, var(--ocean), var(--primary))",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl p-8 relative z-10"
        style={{
          backgroundColor: "var(--surface-card)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Brand header */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-3 flex items-center justify-center gap-2.5"
          >
            <BrandLogo size="lg" />
          </motion.div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Вход в аккаунт
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl p-3 text-sm"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                color: "rgb(220, 38, 38)",
              }}
            >
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => { setEmail(e.target.value); try { sessionStorage.setItem("vh-login-email", e.target.value); } catch {} }}
                required
                className="vh-input pl-10"
                placeholder="you@example.com"
                aria-label="Email"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Пароль
              </label>
              <button
                type="button"
                onClick={() => { setForgotMode("form"); setForgotEmail(email.trim()); }}
                className="text-xs transition-colors hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                Забыли пароль?
              </button>
            </div>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              ariaLabel="Пароль"
            />
          </div>

          <Button type="submit" variant="primary" fluid loading={loading} iconRight={<ArrowRight size={16} />}>
            Войти
          </Button>

          {/* Social login — only show if at least one provider is configured */}
          {(oauthStatus.google || oauthStatus.yandex) && (
            <div className="relative">
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
                <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>или</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
              </div>
              <div className="flex gap-3 mt-3">
                {oauthStatus.google && (
                  <motion.button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm transition-colors"
                    style={{
                      border: "1px solid var(--border-color)",
                      color: "var(--text-secondary)",
                      backgroundColor: "var(--surface-card)",
                    }}
                    whileTap={{ scale: 0.97 }}
                    onClick={async () => {
                      try {
                        setError("");
                        const data = await api.get("/auth/google/login");
                        if (data?.url) {
                          const { validateOAuthUrl } = await import("@/lib/sanitize");
                          const safeUrl = validateOAuthUrl(data.url);
                          if (safeUrl) window.location.href = safeUrl;
                          else setError("Недоверенный OAuth URL");
                        }
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : "Google OAuth недоступен");
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Google
                  </motion.button>
                )}
                {oauthStatus.yandex && (
                  <motion.button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm transition-colors"
                    style={{
                      border: "1px solid var(--border-color)",
                      color: "var(--text-secondary)",
                      backgroundColor: "var(--surface-card)",
                    }}
                    whileTap={{ scale: 0.97 }}
                    onClick={async () => {
                      try {
                        setError("");
                        const data = await api.get("/auth/yandex/login");
                        if (data?.url) {
                          const { validateOAuthUrl } = await import("@/lib/sanitize");
                          const safeUrl = validateOAuthUrl(data.url);
                          if (safeUrl) window.location.href = safeUrl;
                          else setError("Недоверенный OAuth URL");
                        }
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : "Yandex OAuth недоступен");
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24"><path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z" fill="#FC3F1D"/><path d="M13.32 17.5h-1.88V7.38h-.97c-1.57 0-2.39.8-2.39 1.95 0 1.3.59 1.9 1.8 2.7l1 .65-2.9 4.82H6l2.62-4.33C7.37 12.26 6.56 11.22 6.56 9.5c0-2.07 1.45-3.5 4-3.5h2.76V17.5z" fill="white"/></svg>
                    Yandex
                  </motion.button>
                )}
              </div>
            </div>
          )}
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--primary)" }}
          >
            Зарегистрироваться
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
