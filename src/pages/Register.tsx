import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { useDemoAuth } from "@/lib/demo-auth";
import { GraduationCap, ShieldCheck, Scale } from "lucide-react";

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-transparent">
      {/* Left - form */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="flex items-center gap-2.5">
          <BrandLogo />
          <div className="leading-tight">
            <div className="font-bold tracking-tight">HUNTERLITE</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Legal AI Trainer</div>
          </div>
        </div>

        <div className="max-w-md w-full mx-auto lg:mx-0">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary tracking-tight">
            Регистрация
          </h1>
          <p className="text-muted-foreground mt-2">
            Создайте аккаунт для тренировки и аттестации.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="fullName">ФИО</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 8 символов"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
              />
            </div>

            {status ? <p className="text-sm font-medium text-muted-foreground">{status}</p> : null}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Уже есть аккаунт?{" "}
              <Link to="/login" className="font-semibold text-accent hover:underline">
                Войти
              </Link>
            </p>

            <p className="text-xs text-muted-foreground text-center">
              Защищённый вход. Соответствие 152-ФЗ о персональных данных.
            </p>
          </form>
        </div>

        <div className="text-xs text-muted-foreground">© 2026 HUNTERLITE</div>
      </div>

      {/* Right - value */}
      <div className="hidden lg:flex relative bg-gradient-hero text-white p-14 flex-col justify-between overflow-hidden">
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/15 text-xs font-medium">
            <GraduationCap className="h-3.5 w-3.5" /> Тренажёр для юристов
          </div>
          <h2 className="font-display text-4xl font-bold mt-6 leading-tight max-w-md">
            Тренируйте юридические консультации с&nbsp;ИИ-клиентом
          </h2>
          <p className="text-white/70 mt-4 max-w-md">
            Симуляции диалогов, аттестация, разбор формулировок и контроль качества консультаций по банкротству физлиц.
          </p>
        </div>

        <div className="relative grid gap-3 max-w-md">
          {[
            { icon: Scale, title: "Юридически безопасные формулировки", text: "ИИ подсвечивает рискованные обещания и неточности." },
            { icon: ShieldCheck, title: "Экзамен и допуск", text: "Аттестация с проходным баллом 88% и итоговым статусом." },
            { icon: GraduationCap, title: "Персональные слабые темы", text: "Разбор пробелов и обязательный курс при провале." },
          ].map((f) => (
            <div key={f.title} className="flex gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur">
              <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <f.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-sm">{f.title}</div>
                <div className="text-xs text-white/60 mt-0.5">{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
