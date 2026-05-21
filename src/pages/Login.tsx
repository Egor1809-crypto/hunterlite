import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { useDemoAuth } from "@/lib/demo-auth";
import { getRoleHome } from "@/lib/demo-auth-state";
import { frontendApi, withDemoFallback } from "@/lib/frontend-api";
import { MessageCircle, ShieldCheck, Sparkles, Scale } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { loginWithEmail, setRole } = useDemoAuth();
  const [email, setEmail] = useState("a.petrova@hunterlite.ru");
  const [password, setPassword] = useState("hunterlite-demo");
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [telegramPhone, setTelegramPhone] = useState("+7 ");
  const [telegramCode, setTelegramCode] = useState("");
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const completeLogin = (session: Awaited<ReturnType<typeof frontendApi.login>>) => {
    setRole(session.user.role);
    navigate(session.homePath === "/dashboard" ? "/consent" : session.homePath);
  };

  const handleExternalLogin = async () => {
    const session = await withDemoFallback(
      () => frontendApi.login({ email: "a.petrova@hunterlite.ru", password: "oauth-demo" }),
      () => ({ user: loginWithEmail("a.petrova@hunterlite.ru"), homePath: "/consent" }),
    );
    completeLogin(session);
  };

  const requestTelegramCode = async () => {
    setTelegramStatus("Отправляем код в Telegram...");

    try {
      const response = await frontendApi.requestTelegramCode({ phone: telegramPhone });
      setTelegramStatus(response.devCode ? `Код отправлен. Demo SMS-код: ${response.devCode}` : "Код отправлен в Telegram-бот.");
    } catch {
      setTelegramStatus("Не удалось отправить код. Проверьте номер телефона.");
    }
  };

  const loginWithTelegram = async () => {
    setTelegramStatus("Проверяем код...");

    try {
      const session = await withDemoFallback(
        () => frontendApi.loginWithTelegramCode({ phone: telegramPhone, code: telegramCode }),
        () => ({ user: loginWithEmail("a.petrova@hunterlite.ru"), homePath: "/consent" }),
      );
      completeLogin(session);
    } catch {
      setTelegramStatus("Код не подошёл или истёк. Запросите новый код.");
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
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Legal NAVI Trainer</div>
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
                completeLogin(session);
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <Button
                type="button"
                variant="outline"
                className="h-11 bg-card font-semibold text-foreground hover:bg-secondary"
                onClick={() => setTelegramOpen((open) => !open)}
                aria-label="Войти через Telegram"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2AABEE] text-white">
                  <MessageCircle className="h-3.5 w-3.5" />
                </span>
                Telegram
              </Button>
            </div>

            {telegramOpen ? (
              <div className="rounded-lg border border-border bg-card/70 p-3 space-y-3">
                <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="telegram-phone">Телефон Telegram</Label>
                    <Input
                      id="telegram-phone"
                      type="tel"
                      inputMode="tel"
                      value={telegramPhone}
                      onChange={(event) => setTelegramPhone(event.target.value)}
                      placeholder="+7 900 000-00-00"
                    />
                  </div>
                  <Button type="button" variant="outline" className="sm:self-end h-11" onClick={requestTelegramCode}>
                    Получить код
                  </Button>
                </div>
                <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="telegram-code">SMS-код из Telegram</Label>
                    <Input
                      id="telegram-code"
                      inputMode="numeric"
                      value={telegramCode}
                      onChange={(event) => setTelegramCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="1809"
                    />
                  </div>
                  <Button type="button" className="sm:self-end h-11 bg-primary hover:bg-primary/90" onClick={loginWithTelegram}>
                    Войти по коду
                  </Button>
                </div>
                {telegramStatus ? <p className="text-xs font-medium text-muted-foreground">{telegramStatus}</p> : null}
              </div>
            ) : null}

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
            <Sparkles className="h-3.5 w-3.5" /> NAVI-тренажёр для юристов
          </div>
          <h2 className="font-display text-4xl font-bold mt-6 leading-tight max-w-md">
            Тренируйте юридические консультации с&nbsp;NAVI-клиентом
          </h2>
          <p className="text-white/70 mt-4 max-w-md">
            Симуляции диалогов, аттестация, разбор формулировок и контроль качества консультаций по банкротству физлиц.
          </p>
        </div>

        <div className="relative grid gap-3 max-w-md">
          {[
            { icon: Scale, title: "Юридически безопасные формулировки", text: "NAVI подсвечивает рискованные обещания и неточности." },
            { icon: ShieldCheck, title: "Экзамен и допуск", text: "Аттестация с проходным баллом 88% и итоговым статусом." },
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
