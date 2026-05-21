import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { useDemoAuth } from "@/lib/demo-auth";
import { getRoleHome } from "@/lib/demo-auth-state";
import { frontendApi, withDemoFallback } from "@/lib/frontend-api";
import { ShieldCheck, Sparkles, Scale } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { loginWithEmail, setRole } = useDemoAuth();
  const [email, setEmail] = useState("a.petrova@hunterlite.ru");
  const [password, setPassword] = useState("hunterlite-demo");
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const handleExternalLogin = async () => {
    const session = await withDemoFallback(
      () => frontendApi.login({ email: "a.petrova@hunterlite.ru", password: "oauth-demo" }),
      () => ({ user: loginWithEmail("a.petrova@hunterlite.ru"), homePath: "/consent" }),
    );
    setRole(session.user.role);
    navigate("/consent");
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
              void withDemoFallback(
                () => frontendApi.login({ email, password }),
                () => ({ user: loginWithEmail(email), homePath: "/consent" }),
              ).then((session) => {
                setRole(session.user.role);
                navigate("/consent");
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
            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              Войти
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-3 text-muted-foreground">или</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 bg-card font-semibold text-foreground hover:bg-secondary"
                onClick={handleExternalLogin}
                aria-label="Войти через Google"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white text-[13px] font-bold text-[#4285F4]">
                  G
                </span>
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 bg-card font-semibold text-foreground hover:bg-secondary"
                onClick={handleExternalLogin}
                aria-label="Войти через Яндекс"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FC3F1D] text-[13px] font-bold text-white">
                  Я
                </span>
                Яндекс
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Защищённый вход. Соответствие 152-ФЗ о персональных данных.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Сотрудник", role: "employee" as const },
                { label: "Руководитель", role: "manager" as const },
                { label: "Админ", role: "admin" as const },
              ].map((item) => (
                <Button
                  key={item.role}
                  type="button"
                  variant="ghost"
                  className="h-9 text-xs"
                  onClick={() => {
                    setRole(item.role);
                    navigate(getRoleHome(item.role));
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </form>
        </div>

        <div className="text-xs text-muted-foreground">© 2026 HUNTERLITE</div>
      </div>

      {/* Right - value */}
      <div className="hidden lg:flex relative bg-gradient-hero text-white p-14 flex-col justify-between overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -left-32 -bottom-32 h-96 w-96 rounded-full bg-ai/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/15 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" /> AI-тренажёр для юристов
          </div>
          <h2 className="font-display text-4xl font-bold mt-6 leading-tight max-w-md">
            Тренируйте юридические консультации с&nbsp;AI-клиентом
          </h2>
          <p className="text-white/70 mt-4 max-w-md">
            Симуляции диалогов, аттестация, разбор формулировок и контроль качества консультаций по банкротству физлиц.
          </p>
        </div>

        <div className="relative grid gap-3 max-w-md">
          {[
            { icon: Scale, title: "Юридически безопасные формулировки", text: "AI подсвечивает рискованные обещания и неточности." },
            { icon: ShieldCheck, title: "Экзамен и допуск", text: "Аттестация с проходным баллом 70% и итоговым статусом." },
            { icon: Sparkles, title: "Персональные слабые темы", text: "Разбор пробелов и обязательный курс при провале." },
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
