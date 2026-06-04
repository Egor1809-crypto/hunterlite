"use client";

import { useEffect, useState, useRef, Component, type ReactNode, type ErrorInfo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { logger } from "@/lib/logger";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { getToken, getRefreshToken, setTokens } from "@/lib/auth";
import { api } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/public-origin";
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
}

// Module-level consent cache (avoids re-fetching on every page nav)
// Keyed by user token hash to prevent cross-user cache leakage
let _consentChecked = false;
let _consentOk = false;
let _consentUserToken: string | null = null;

/** Reset consent cache — MUST be called on logout to prevent cross-user leakage */
export function resetConsentCache() {
  _consentChecked = false;
  _consentOk = false;
  _consentUserToken = null;
}

export default function AuthLayout({
  children,
  requireConsent = false,
  showBreadcrumbs = true,
}: AuthLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Hide the floating Manyasha on /cases and on /knowledge: the knowledge page
  // hosts the in-tab Manyasha chat (ТЗ-3 DECISION-A) — one mascot per page.
  const hideAssistant =
    (pathname?.startsWith("/cases") || pathname?.startsWith("/knowledge")) ?? false;
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
      // before giving up and redirecting to /login.
      if (!token && hasAuthMarkerCookie()) {
        try {
          const storedRefreshToken = getRefreshToken();
          const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(storedRefreshToken ? { refresh_token: storedRefreshToken } : {}),
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            if (data.access_token) {
              setTokens(data.access_token, data.refresh_token, data.csrf_token);
              token = data.access_token;
            }
          }
        } catch {
          // Refresh failed — will redirect to login below
        }
      }

      if (!token) {
        setState("redirecting");
        router.replace("/login");
        return;
      }

      // Invalidate consent cache if user changed (prevents cross-user leakage)
      if (_consentUserToken && _consentUserToken !== token) {
        _consentChecked = false;
        _consentOk = false;
      }
      _consentUserToken = token;

      if (!requireConsent || _consentOk) {
        setState("ready");
        return;
      }

      if (_consentChecked) {
        // Missing consent → show the acceptance gate (no longer a dead-end
        // redirect to /home, which itself requires consent).
        setState(_consentOk ? "ready" : "consent");
        return;
      }

      try {
        const data = await api.get("/consent/status");
        _consentChecked = true;
        _consentOk = data.all_accepted;
        setState(data.all_accepted ? "ready" : "consent");
      } catch (err: unknown) {
        logger.error("[AuthLayout] consent error:", err);
        _consentChecked = false;
        _consentOk = false;
        setState("error");
        setErrorMessage(err instanceof Error ? err.message : "Не удалось проверить статус согласия");
      }
    };

    boot();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only initialization

  if (state === "error") {
    const handleRetry = () => {
      const MAX_RETRIES = 5;
      if (retryCount.current >= MAX_RETRIES) {
        setErrorMessage("Слишком много попыток. Перезагрузите страницу.");
        return;
      }
      retryCount.current += 1;
      didRun.current = false;
      _consentChecked = false;
      _consentOk = false;
      setState("loading");
      setErrorMessage("");
      const delay = Math.min(200 * Math.pow(2, retryCount.current - 1), 5000);
      setTimeout(() => {
        didRun.current = false;
        const fullRetry = async () => {
          let token = getToken();
          if (!token && hasAuthMarkerCookie()) {
            try {
              const storedRefreshToken = getRefreshToken();
              const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(storedRefreshToken ? { refresh_token: storedRefreshToken } : {}),
                credentials: "include",
              });
              if (res.ok) {
                const data = await res.json();
                if (data.access_token) {
                  setTokens(data.access_token, data.refresh_token, data.csrf_token);
                  token = data.access_token;
                }
              }
            } catch { /* continue without token */ }
          }
          if (!token) { setState("redirecting"); router.replace("/login"); return; }
          if (!requireConsent) { setState("ready"); retryCount.current = 0; return; }
          try {
            const data = await api.get("/consent/status");
            _consentChecked = true;
            _consentOk = data.all_accepted;
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
          _consentChecked = true;
          _consentOk = true;
          retryCount.current = 0;
          setState("ready");
        }}
      />
    );
  }

  if (state === "loading" || state === "redirecting") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--primary)", opacity: 0.6 }} />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {state === "loading" ? "Загрузка..." : "Перенаправление..."}
          </span>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthErrorBoundary>
      <AppShell>
        <LLMDegradationBanner />
        {showBreadcrumbs && (
          <div className="max-w-7xl mx-auto px-4 pt-3">
            <AutoBreadcrumbs />
          </div>
        )}
        {children}
        <KeyboardShortcutsOverlay />
        <CommandPalette />
        {!hideAssistant && <ManyashaChat config={{ apiEndpoint: "/api/chat" }} />}
      </AppShell>
    </AuthErrorBoundary>
  );
}
