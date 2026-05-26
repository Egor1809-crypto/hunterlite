"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, User, ArrowRight, AlertCircle, Scale } from "lucide-react";
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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8 overflow-hidden bg-gradient-to-br from-[#0891B2]/5 via-[#FAFBFC] to-[#FAFBFC]">
      {/* Subtle decorative shapes */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#F97316]/[0.04]" />
        <div className="absolute -bottom-60 -left-40 w-[600px] h-[600px] rounded-full bg-[#0891B2]/[0.04]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-white p-8 relative z-10 shadow-xl shadow-gray-200/50 border border-gray-100"
      >
        {/* Brand header */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-3 flex items-center justify-center gap-2.5"
          >
            <Scale size={28} className="text-[#F97316]" />
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              Legal<span className="text-[#F97316]">Hunter</span>
            </span>
          </motion.div>
          <p className="text-sm text-gray-500">
            Создание аккаунта
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl p-3 text-sm bg-red-50 border border-red-100 text-red-600"
            >
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
              Полное имя
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
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
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
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
              <div className="mt-1.5 text-xs text-red-500">
                Пароли не совпадают.
              </div>
            )}
          </div>

          <Button type="submit" variant="primary" fluid loading={loading} disabled={!passwordsMatch} iconRight={<ArrowRight size={16} />}>
            Зарегистрироваться
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-[#F97316] transition-colors hover:text-[#EA6C10]">
            Войти
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
