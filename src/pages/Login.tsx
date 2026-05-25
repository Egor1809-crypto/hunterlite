import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { useDemoAuth } from "@/lib/demo-auth";
import { frontendApi } from "@/lib/frontend-api";
import { ShieldCheck, Scale, GraduationCap } from "lucide-react";

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
            Вход в кабинет
          </h1>
          <p className="text-muted-foreground mt-2">
            Тренировка и аттестация юристов-консультантов по банкротству физических лиц.
          </p>

          <form
            className="mt-8 space-y-5"
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
              <Label htmlFor="email">Корпоративный email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Пароль</Label>
                <button
                  type="button"
                  className="text-xs font-semibold text-accent hover:underline"
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
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              {resetStatus ? <p className="text-xs font-medium text-muted-foreground">{resetStatus}</p> : null}
            </div>
            {loginStatus ? <p className="text-sm font-medium text-muted-foreground">{loginStatus}</p> : null}
            <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              {isSubmitting ? "Вход..." : "Войти"}
            </Button>


            <p className="text-sm text-center text-muted-foreground">
              Нет аккаунта?{" "}
              <Link to="/register" className="font-semibold text-accent hover:underline">
                Зарегистрироваться
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
