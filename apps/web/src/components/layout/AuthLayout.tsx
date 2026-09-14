"use client";

import { useEffect, useState, useRef, useContext, Component, type ReactNode, type ErrorInfo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { logger } from "@/lib/logger";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { getToken } from "@/lib/auth";
import { api, tryRefreshToken } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/** Token-based boot error card — used by the error boundary and the
 *  connection-error state so both respect light + dark themes. */
function BootErrorCard({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
      <div
        className="w-full max-w-md rounded-2xl px-8 py-7 text-center"
        style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-lg)" }}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--danger-muted)" }}
        >
          <AlertTriangle size={24} style={{ color: "var(--danger)" }} />
        </div>
        <h2 className="t-card-title mb-2">{title}</h2>
        <p className="t-caption mb-5">{message}</p>
        <Button variant="primary" icon={<RefreshCw size={14} />} onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
import AppShell from "./AppShell";
import { WorkspaceContext } from "./WorkspaceContext";
import { WorkspaceLoading } from "./WorkspaceLoading";
import { useAuthStore } from "@/stores/useAuthStore";
import { AutoBreadcrumbs } from "./AutoBreadcrumbs";
import { KeyboardShortcutsOverlay } from "@/components/ui/KeyboardShortcutsOverlay";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { LLMDegradationBanner } from "@/components/ui/LLMDegradationBanner";
import ManyashaChat from "@/components/ManyashaChat";
import ConsentGate from "./ConsentGate";

/** Check if vh_authenticated marker cookie exists (survives page reload). */
function hasAuthMarkerCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("vh_authenticated=");
}

// ── Error Boundary ──────────────────────────────────────
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AuthErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("[AuthLayout] Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <BootErrorCard
          title="Что-то пошло не так"
          message={this.state.error?.message || "Произошла непредвиденная ошибка"}
          actionLabel="Попробовать снова"
          onAction={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

// ── Auth Layout ──────────────────────────────────────────
interface AuthLayoutProps {
  children: ReactNode;
  requireConsent?: boolean;
  showBreadcrumbs?: boolean;
  focusMode?: boolean;
}

import { consentCache } from "@/lib/consentCache";

export default function AuthLayout({
  children,
  requireConsent = false,
  showBreadcrumbs = true,
  focusMode = false,
}: AuthLayoutProps) {
  const inWorkspace = useContext(WorkspaceContext);
  const router = useRouter();
  const pathname = usePathname();
  // Hide the floating Manyasha on /cases and on /knowledge: the knowledge page
  // hosts the in-tab Manyasha chat (ТЗ-3 DECISION-A) — one mascot per page.
  const hideAssistant =
    (pathname?.startsWith("/cases") || pathname?.startsWith("/knowledge")) ?? false;
  // На странице чемпионата Маняша сама раскрывается и сразу объясняет
  // условия участия в розыгрыше. На всех остальных маршрутах пропсы не
  // передаются → виджет ведёт себя как раньше (закрыт по умолчанию).
  const isContest = pathname === "/certificate/contest" || pathname === "/championship";
  const CONTEST_INTRO =
    "Привет! Это страница розыгрыша «Чемпионат сезона». Чтобы участвовать, нужно:\n\n" +
    "1. Получить именной сертификат — сдать аттестацию (все экзамены на ≥ 88%).\n" +
    "2. Иметь активную платную подписку — она открывает доступ к курсам.\n" +
    "3. Пройти курсы «Юридические аспекты» и «Экспертный уровень БФЛ» на 100% — после каждого урока есть мини-проверка.\n" +
    "4. Оставить отзыв о платформе.\n" +
    "5. Подать заявку на участие до конца сезона.\n\n" +
    "Спросите меня о любом из пунктов — подскажу, с чего начать.";
  const [state, setState] = useState<"loading" | "ready" | "redirecting" | "consent" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const retryCount = useRef(0);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const boot = async () => {
      let token = getToken();

      // After full-page reload the in-memory token is gone, but httpOnly
      // refresh_token cookie may still be valid. Try to restore the session
      // before giving up and redirecting to the landing page.
      if (!token && hasAuthMarkerCookie()) {
        try {
          if (await tryRefreshToken()) token = getToken();
        } catch {
          // Refresh failed — will redirect to login below
        }
      }

      if (!token) {
        setState("redirecting");
        router.replace("/");
        return;
      }

      // Invalidate consent cache if user changed (prevents cross-user leakage)
      if (consentCache.userToken && consentCache.userToken !== token) {
        consentCache.checked = false;
        consentCache.ok = false;
      }
      consentCache.userToken = token;

      if (!requireConsent || consentCache.ok) {
        setState("ready");
        return;
      }

      if (consentCache.checked) {
        // Missing consent → show the acceptance gate (no longer a dead-end
        // redirect to /home, which itself requires consent).
        setState(consentCache.ok ? "ready" : "consent");
        return;
      }

      try {
        const data = await api.get("/consent/status");
        consentCache.checked = true;
        consentCache.ok = data.all_accepted;
        setState(data.all_accepted ? "ready" : "consent");
      } catch (err: unknown) {
        logger.error("[AuthLayout] consent error:", err);
        consentCache.checked = false;
        consentCache.ok = false;
        setState("error");
        setErrorMessage(err instanceof Error ? err.message : "Не удалось проверить статус согласия");
      }
    };

    boot();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only initialization

  useEffect(() => {
    if (state === "ready") void useAuthStore.getState().fetchUser();
  }, [state]);

  if (state === "error") {
    const handleRetry = () => {
      const MAX_RETRIES = 5;
      if (retryCount.current >= MAX_RETRIES) {
        setErrorMessage("Слишком много попыток. Перезагрузите страницу.");
        return;
      }
      retryCount.current += 1;
      didRun.current = false;
      consentCache.checked = false;
      consentCache.ok = false;
      setState("loading");
      setErrorMessage("");
      const delay = Math.min(200 * Math.pow(2, retryCount.current - 1), 5000);
      setTimeout(() => {
        didRun.current = false;
        const fullRetry = async () => {
          let token = getToken();
          if (!token && hasAuthMarkerCookie()) {
            try {
              if (await tryRefreshToken()) token = getToken();
            } catch { /* continue without token */ }
          }
          if (!token) { setState("redirecting"); router.replace("/"); return; }
          if (!requireConsent) { setState("ready"); retryCount.current = 0; return; }
          try {
            const data = await api.get("/consent/status");
            consentCache.checked = true;
            consentCache.ok = data.all_accepted;
            setState(data.all_accepted ? "ready" : "consent");
            if (data.all_accepted) retryCount.current = 0;
          } catch {
            setState("error");
            setErrorMessage("Сервер по-прежнему недоступен");
          }
        };
        fullRetry();
      }, delay);
    };

    return (
      <BootErrorCard
        title="Ошибка подключения"
        message={errorMessage || "Не удалось подключиться к серверу"}
        actionLabel="Повторить"
        onAction={handleRetry}
      />
    );
  }

  if (state === "consent") {
    return (
      <ConsentGate
        onAccepted={() => {
          consentCache.checked = true;
          consentCache.ok = true;
          retryCount.current = 0;
          setState("ready");
        }}
      />
    );
  }

  if (state === "loading" || state === "redirecting") return <WorkspaceLoading />;

  if (focusMode) return <AuthErrorBoundary><div className="editorial-app call-focus">{children}</div></AuthErrorBoundary>;

  const content = (
    <>
        <LLMDegradationBanner />
        {showBreadcrumbs && (
          <div className="max-w-7xl mx-auto px-4 pt-3">
            <AutoBreadcrumbs />
          </div>
        )}
        {children}
        <KeyboardShortcutsOverlay />
        <CommandPalette />
        {!hideAssistant && (
          <ManyashaChat
            config={{ apiEndpoint: "/api/chat" }}
            {...(isContest ? { autoOpenMessage: CONTEST_INTRO, forceShow: true } : {})}
          />
        )}
    </>
  );
  return <AuthErrorBoundary>{inWorkspace ? content : <AppShell>{content}</AppShell>}</AuthErrorBoundary>;
}
