import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { PixelBackground } from "@/components/PixelBackground";
import { useDemoAuth } from "@/lib/demo-auth";
import { GraduationCap, ShieldCheck, Scale, Zap } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const { setRole } = useDemoAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!fullName.trim() || fullName.trim().length < 2) {
      setStatus("Введите ФИО (минимум 2 символа).");
      return;
    }

    if (!email.trim()) {
      setStatus("Введите email.");
      return;
    }

    if (!password || password.length < 8) {
      setStatus("Пароль должен содержать минимум 8 символов.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Пароли не совпадают.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Регистрируем...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, fullName: fullName.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const payload = await res.json();

      if (payload.ok) {
        setStatus(null);
        setRole(payload.data.user.role as import("@/lib/demo-auth-state").AppRole);
        navigate(payload.data.homePath === "/dashboard" ? "/consent" : payload.data.homePath);
        return;
      }

      setStatus(payload.error?.message ?? "Ошибка регистрации. Попробуйте ещё раз.");
    } catch {
      clearTimeout(timeout);
      setStatus("Не удалось зарегистрироваться. Проверьте данные и попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto flex flex-col items-center py-8">
        {/* Logo with orange glow halo */}
        <div className="relative mb-6">
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
          <div className="absolute -inset-1 rounded-2xl opacity-30" style={{ background: "linear-gradient(135deg, #F97316 0%, #7C3AED 100%)", filter: "blur(20px)" }} />

          <div
            className="relative rounded-2xl border border-white/[0.08] p-8 sm:p-10"
            style={{
              background: "rgba(13, 5, 32, 0.85)",
              backdropFilter: "blur(32px) saturate(1.2)",
              boxShadow: "0 0 60px rgba(124, 58, 237, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-center">
              Создать аккаунт
            </h1>
            <p className="text-sm text-white/50 mt-2 text-center">
              Присоединяйтесь к платформе аттестации юристов
            </p>

            <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-sm font-medium text-white/80">ФИО</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className="h-11 bg-[#1a0a35] border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all duration-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-white/80">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ivan@company.ru"
                  className="h-11 bg-[#1a0a35] border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all duration-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-white/80">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  className="h-11 bg-[#1a0a35] border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all duration-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-white/80">Подтвердите пароль</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите пароль"
                  className="h-11 bg-[#1a0a35] border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all duration-200"
                />
              </div>

              {status ? <p className="text-sm font-medium text-orange-300/80">{status}</p> : null}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 font-bold text-white border-0 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(249,115,22,0.4)] disabled:opacity-50 disabled:hover:scale-100"
                style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
              >
                {isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
              </Button>

              <p className="text-sm text-center text-white/50">
                Уже есть аккаунт?{" "}
                <Link to="/login" className="font-semibold text-orange-400 hover:text-orange-300 hover:underline transition-colors">
                  Войти
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
            Более 200 юристов уже тренируются на платформе
          </p>
          <p className="text-[10px] text-white/25">
            Защищённый вход. Соответствие 152-ФЗ о персональных данных.
          </p>
        </div>
      </div>
    </div>
  );
}
