import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { PixelBackground } from "@/components/PixelBackground";
import { useDemoAuth } from "@/lib/demo-auth";
import { frontendApi } from "@/lib/frontend-api";
import { ShieldCheck, Scale, GraduationCap, Zap } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { setRole } = useDemoAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const completeLogin = (role: string, homePath: string) => {
    setRole(role as import("@/lib/demo-auth-state").AppRole);
    navigate(homePath === "/dashboard" ? "/consent" : homePath);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "#0D0520" }}>
      {/* Animated background cubes */}
      <div className="absolute inset-0 z-0">
        <PixelBackground />
      </div>

      {/* Subtle vignette — does NOT hide cubes */}
      <div className="absolute inset-0 z-[1]" style={{ background: "radial-gradient(ellipse at center, transparent 40%, #0D0520 95%)" }} />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto flex flex-col items-center">
        {/* Logo with orange glow halo */}
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full blur-2xl opacity-40" style={{ background: "#F97316", transform: "scale(2.5)" }} />
          <div className="relative flex items-center gap-3">
            <BrandLogo className="h-12 w-12 !rounded-xl border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]" />
            <div className="leading-tight">
              <div className="text-xl font-extrabold tracking-tight text-white">HUNTERLITE</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-orange-300/70">Legal AI Trainer</div>
            </div>
          </div>
        </div>

        {/* Glass card */}
        <div className="relative w-full">
          {/* Subtle glow under card */}
          <div className="absolute -inset-1 rounded-2xl opacity-25" style={{ background: "linear-gradient(135deg, #F97316 0%, #7C3AED 100%)", filter: "blur(24px)" }} />

          <div
            className="relative rounded-2xl border border-white/[0.08] p-8 sm:p-10"
            style={{
              background: "rgba(13, 5, 32, 0.85)",
              backdropFilter: "blur(32px) saturate(1.2)",
              boxShadow: "0 0 60px rgba(249, 115, 22, 0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-center">
              Вход в кабинет
            </h1>
            <p className="text-sm text-white/50 mt-2 text-center">
              Тренировка и аттестация юристов по банкротству физлиц
            </p>

            <form
              className="mt-7 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (isSubmitting) return;
                setIsSubmitting(true);
                setLoginStatus("Проверяем данные...");
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                void fetch("/api/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Accept: "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ email, password }),
                  signal: controller.signal,
                })
                  .then((res) => res.json())
                  .then((payload) => {
                    clearTimeout(timeout);
                    if (payload.ok) {
                      setLoginStatus(null);
                      completeLogin(payload.data.user.role, payload.data.homePath);
                    } else {
                      throw new Error(payload.error?.message ?? "Login failed");
                    }
                  })
                  .catch(() => {
                    clearTimeout(timeout);
                    if (!email.trim()) {
                      setLoginStatus("Введите email.");
                      return;
                    }
                    setLoginStatus("Email или пароль не подошли. Проверьте данные и попробуйте ещё раз.");
                  })
                  .finally(() => {
                    setIsSubmitting(false);
                  });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-white/80">Корпоративный email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 bg-[#1a0a35] border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all duration-200"
                  placeholder="you@company.ru"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-sm font-medium text-white/80">Пароль</Label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-orange-400 hover:text-orange-300 hover:underline transition-colors"
                    onClick={() => {
                      setResetStatus("Отправляем инструкцию...");
                      void frontendApi.requestPasswordReset({ email }).then((response) => {
                        setResetStatus(
                          response.devToken
                            ? `Demo token: ${response.devToken}`
                            : "Если email есть в системе, инструкция придёт на почту.",
                        );
                      }).catch(() => {
                        setResetStatus("Не удалось отправить запрос. Попробуйте позже.");
                      });
                    }}
                  >
                    Забыли пароль?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 bg-[#1a0a35] border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all duration-200"
                />
                {resetStatus ? <p className="text-xs font-medium text-white/50">{resetStatus}</p> : null}
              </div>

              {loginStatus ? <p className="text-sm font-medium text-orange-300/80">{loginStatus}</p> : null}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 font-bold text-white border-0 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(249,115,22,0.4)] disabled:opacity-50 disabled:hover:scale-100"
                style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
              >
                {isSubmitting ? "Вход..." : "Войти"}
              </Button>

              <p className="text-sm text-center text-white/50">
                Нет аккаунта?{" "}
                <Link to="/register" className="font-semibold text-orange-400 hover:text-orange-300 hover:underline transition-colors">
                  Зарегистрироваться
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {[
            { icon: Scale, label: "Безопасные формулировки" },
            { icon: ShieldCheck, label: "Аттестация 88%" },
            { icon: GraduationCap, label: "Разбор слабых тем" },
            { icon: Zap, label: "ИИ-симуляции" },
          ].map((badge) => (
            <div
              key={badge.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-white/70 border border-white/10"
              style={{ background: "rgba(124, 58, 237, 0.15)", backdropFilter: "blur(8px)" }}
            >
              <badge.icon className="h-3 w-3 text-orange-400/80" />
              {badge.label}
            </div>
          ))}
        </div>

        {/* Social proof + compliance */}
        <div className="mt-6 text-center space-y-1">
          <p className="text-xs text-white/40 font-medium">
            Более 200 юристов тренируются на платформе
          </p>
          <p className="text-[10px] text-white/25">
            Защищённый вход. Соответствие 152-ФЗ о персональных данных.
          </p>
        </div>
      </div>
    </div>
  );
}
