"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, User, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, resetAuthCircuitBreaker } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordChecklist, isPasswordValid } from "@/components/ui/PasswordChecklist";
import { FishermanError } from "@/components/errors/FishermanError";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  // 152-ФЗ: явное, непредзаполненное согласие на обработку ПДн (обязательно);
  // согласие на рекламную рассылку — отдельное и необязательное.
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNetworkError(false);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();

    if (!normalizedName) {
      setError("Укажите имя");
      return;
    }
    if (!consent) {
      setError("Необходимо согласие на обработку персональных данных");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (!isPasswordValid(password)) {
      setError("Пароль не соответствует требованиям безопасности");
      return;
    }

    setLoading(true);

    try {
      const data = await api.post("/auth/register", {
        email: normalizedEmail,
        password,
        full_name: normalizedName,
        // 152-ФЗ: факт согласия фиксируется на сервере (UserConsent + IP/версия).
        consent_accepted: consent,
        marketing_accepted: marketing,
      });
      setTokens(data.access_token, data.refresh_token, data.csrf_token);
      resetAuthCircuitBreaker();
      router.push("/home");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка регистрации";
      if (msg.includes("недоступен") || msg.includes("fetch")) {
        setNetworkError(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  if (networkError) {
    return <FishermanError onRetry={() => { setNetworkError(false); setError(""); }} message="Похоже, сервер временно недоступен..." />;
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-5 py-10"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[400px]"
      >
        {/* Editorial header */}
        <div className="mb-9">
          <div aria-hidden className="mb-5 h-0.5 w-8" style={{ background: "var(--primary)" }} />
          <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
            LegalHunter
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-none tracking-tight" style={{ color: "var(--text-primary)" }}>
            Создать аккаунт
          </h1>
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
              htmlFor="fullName"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Полное имя
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="vh-input pl-10"
                placeholder="Иван Петров"
                autoComplete="name"
                aria-label="Полное имя"
              />
            </div>
          </div>

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
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="vh-input pl-10"
                placeholder="you@example.com"
                autoComplete="email"
                aria-label="Email"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Пароль
            </label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="Минимум 8 символов"
              autoComplete="new-password"
              ariaLabel="Пароль"
              ariaDescribedBy="password-requirements"
            />
            <PasswordChecklist value={password} />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Повторите пароль
            </label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              ariaLabel="Подтвердите пароль"
            />
            {!passwordsMatch && (
              <div className="mt-1.5 text-xs" style={{ color: "rgb(239, 68, 68)" }}>
                Пароли не совпадают.
              </div>
            )}
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer text-xs" style={{ color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--primary)]"
            />
            <span>
              Я даю{" "}
              <Link href="/legal/consent" target="_blank" style={{ color: "var(--primary)" }}>согласие на обработку персональных данных</Link>{" "}
              и принимаю{" "}
              <Link href="/legal/privacy" target="_blank" style={{ color: "var(--primary)" }}>Политику обработки ПДн</Link>{" "}
              и{" "}
              <Link href="/legal/terms" target="_blank" style={{ color: "var(--primary)" }}>Пользовательское соглашение</Link>.
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer text-xs" style={{ color: "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--primary)]"
            />
            <span>Согласен получать информационные и рекламные сообщения (необязательно).</span>
          </label>

          <Button type="submit" variant="primary" fluid loading={loading} disabled={!passwordsMatch || !consent} iconRight={<ArrowRight size={16} />}>
            Зарегистрироваться
          </Button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Уже есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--primary)" }}
          >
            Войти
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
