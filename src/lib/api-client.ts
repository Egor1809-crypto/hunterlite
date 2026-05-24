import type { ApiResponse } from "../../apps/api/src/http/api-response";
import { clearAuth } from "@/lib/demo-auth-state";

const API_BASE_URL = "/api";
const CSRF_COOKIE_NAME = "hunterlite_csrf";

let redirectingToLogin = false;

function handleUnauthorized() {
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  clearAuth();
  window.location.href = "/login";
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiGet<TData>(path: string): Promise<TData> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 401 && path !== "/auth/session") {
    handleUnauthorized();
  }

  const payload = (await response.json()) as ApiResponse<TData>;

  if (!response.ok || !payload.ok) {
    const message = payload.ok ? response.statusText : payload.error.message;
    const details = payload.ok ? undefined : payload.error.details;
    throw new ApiClientError(message, response.status, details);
  }

  return payload.data;
}

const readCookie = (name: string) => {
  if (typeof document === "undefined") return undefined;

  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

export async function apiPost<TData, TBody = unknown>(path: string, body?: TBody): Promise<TData> {
  const csrfFreePaths = new Set([
    "/auth/login",
    "/auth/register",
    "/auth/telegram/request-code",
    "/auth/telegram/login",
  ]);
  const csrfToken = csrfFreePaths.has(path) ? undefined : readCookie(CSRF_COOKIE_NAME);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json()) as ApiResponse<TData>;

  if (!response.ok || !payload.ok) {
    const message = payload.ok ? response.statusText : payload.error.message;
    const details = payload.ok ? undefined : payload.error.details;
    throw new ApiClientError(message, response.status, details);
  }

  return payload.data;
}
