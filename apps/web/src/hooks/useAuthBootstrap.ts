"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { tryRefreshToken } from "@/lib/api";
import { logger } from "@/lib/logger";
import { useAuthStore } from "@/stores/useAuthStore";

type AuthState = "loading" | "ready" | "redirecting";

function hasAuthMarkerCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("vh_authenticated=");
}

/**
 * Auth bootstrap for fullscreen pages (training/[id], pvp/duel, pvp/quiz, etc.)
 * that are intentionally NOT wrapped in AuthLayout (to avoid Header/chrome).
 *
 * Handles the same auth flow as AuthLayout's boot():
 * 1. Check in-memory token
 * 2. If missing but cookie marker exists → try POST /auth/refresh
 * 3. If still no token → redirect to /login
 *
 * Returns { ready: true } when safe to proceed, { ready: false } while booting
 * or redirecting. Usage:
 *
 *   const { ready } = useAuthBootstrap();
 *   if (!ready) return <Loader />;
 */
export function useAuthBootstrap() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>("loading");
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const boot = async () => {
      let token = getToken();

      if (!token && hasAuthMarkerCookie()) {
        try {
          if (await tryRefreshToken()) token = getToken();
        } catch (err) {
          logger.warn("[useAuthBootstrap] refresh failed:", err);
        }
      }

      if (!token) {
        setState("redirecting");
        router.replace("/login");
        return;
      }

      setState("ready");
      void useAuthStore.getState().fetchUser();
    };

    boot();
  }, [router]);

  return { ready: state === "ready", state };
}
