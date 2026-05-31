"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, User, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandLogo } from "@/components/ui/BrandLogo";
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
      className="relative flex min-h-screen items-center justify-center px-4 py-8 overflow-hidden"
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
            Создание аккаунта
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

          <Button type="submit" variant="primary" fluid loading={loading} disabled={!passwordsMatch} iconRight={<ArrowRight size={16} />}>
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
