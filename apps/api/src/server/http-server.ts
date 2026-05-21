import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ApiEnv } from "../config/env";
import { parseCorsOrigins } from "../config/env";
import { createHealthStatus } from "../health/health-contract";
import type { ApiResponse } from "../http/api-response";
import { fail } from "../http/api-response";
import {
  clearSessionCookie,
  createAuthHandlers,
  type AuthDataSource,
} from "../modules/auth/auth-handlers";
import {
  clearCsrfCookie,
  createCsrfCookie,
  hasSessionCookie,
  verifyCsrfToken,
} from "../modules/auth/csrf";
import {
  loginRateLimiter,
  type LoginRateLimiter,
} from "../modules/auth/login-rate-limit";
import {
  createFrontendApiHandlers,
  type FrontendApiDataSource,
} from "../routes/frontend-api-handlers";
import { findApiAccessPolicy, roleHasPermission } from "@/lib/access-control";
import type { AppRole } from "@/lib/demo-auth-state";

export type ApiRequest = {
  method: string;
  url: string;
  role?: AppRole;
  origin?: string;
  cookie?: string;
  body?: unknown;
  ip?: string;
  csrfToken?: string;
};

export type ApiResolvedResponse = {
  status: number;
  body: ApiResponse<unknown>;
  headers?: Record<string, string | string[]>;
};

export type ApiServerOptions = {
  source?: FrontendApiDataSource;
  auth?: AuthDataSource;
  authDemoFallback?: boolean;
  loginRateLimiter?: LoginRateLimiter;
  corsOrigins?: ApiEnv["CORS_ORIGINS"];
};

const roleValues = new Set<AppRole>(["employee", "manager", "admin", "client"]);

const getStatusCode = (body: ApiResponse<unknown>) => {
  if (body.ok) return 200;

  const statusByCode = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    VALIDATION_ERROR: 422,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
  } as const;

  return statusByCode[body.error.code];
};

const getRoleFromRequest = (request: ApiRequest, url: URL): AppRole | undefined => {
  const explicitRole = request.role ?? url.searchParams.get("role") ?? undefined;

  if (!explicitRole) return undefined;
  return roleValues.has(explicitRole as AppRole) ? (explicitRole as AppRole) : undefined;
};

const getLoginEmail = (body: unknown) => {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "unknown";
};

const getLoginRateLimitKey = (request: ApiRequest) =>
  `${request.ip ?? "unknown"}:${getLoginEmail(request.body)}`;

const isAllowedPostRoute = (pathname: string) =>
  pathname === "/api/auth/login" ||
  pathname === "/api/auth/logout" ||
  pathname === "/api/auth/password-reset/request" ||
  pathname === "/api/auth/password-reset/complete" ||
  pathname === "/api/trainings/sessions" ||
  /^\/api\/trainings\/sessions\/[^/]+\/messages$/.test(pathname) ||
  /^\/api\/trainings\/sessions\/[^/]+\/complete$/.test(pathname) ||
  /^\/api\/admin\/.*$/.test(pathname);

const createJsonHeaders = (origin?: string, corsOrigins?: string) => {
  const allowedOrigins = corsOrigins ? parseCorsOrigins(corsOrigins) : [];
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : undefined;

  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(allowedOrigin
      ? {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Accept,X-CSRF-Token",
          Vary: "Origin",
        }
      : {}),
  };
};

export const resolveApiRequest = async (
  request: ApiRequest,
  options: ApiServerOptions = {},
): Promise<ApiResolvedResponse> => {
  const url = new URL(request.url, "http://localhost");
  const headers = createJsonHeaders(request.origin, options.corsOrigins);

  if (request.method === "OPTIONS") {
    return Promise.resolve({
      status: 204,
      body: { ok: true, data: null },
      headers,
    });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    const body = fail("BAD_REQUEST", "Unsupported method", { method: request.method });

    return Promise.resolve({
      status: getStatusCode(body),
      body,
      headers,
    });
  }

  const api = createFrontendApiHandlers(options.source);
  const auth = createAuthHandlers(options.auth, {
    allowDemoFallback: options.authDemoFallback,
  });
  const rateLimiter = options.loginRateLimiter ?? loginRateLimiter;
  const pathname = url.pathname;
  const employeeProfileMatch = pathname.match(/^\/api\/analytics\/manager\/employees\/([^/]+)$/);
  const trainingMessageMatch = pathname.match(/^\/api\/trainings\/sessions\/([^/]+)\/messages$/);
  const trainingCompleteMatch = pathname.match(/^\/api\/trainings\/sessions\/([^/]+)\/complete$/);
  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  const callScriptDeleteMatch = pathname.match(/^\/api\/admin\/call-scripts\/([^/]+)\/delete$/);
  const callScriptMatch = pathname.match(/^\/api\/admin\/call-scripts\/([^/]+)$/);
  let extraHeaders: Record<string, string | string[]> = {};

  if (request.method === "POST" && !isAllowedPostRoute(pathname)) {
    const body = fail("BAD_REQUEST", "Unsupported method", { method: request.method });

    return Promise.resolve({
      status: getStatusCode(body),
      body,
      headers,
    });
  }

  if (
    request.method === "POST" &&
    pathname !== "/api/auth/login" &&
    pathname !== "/api/auth/password-reset/request" &&
    pathname !== "/api/auth/password-reset/complete" &&
    hasSessionCookie(request.cookie) &&
    !verifyCsrfToken(request.cookie, request.csrfToken)
  ) {
    const body = fail("FORBIDDEN", "CSRF token is required");

    return Promise.resolve({
      status: getStatusCode(body),
      body,
      headers,
    });
  }

  const apiAccessPolicy = findApiAccessPolicy(request.method as "GET" | "POST", pathname);
  const authSession = apiAccessPolicy ? await auth.session(request.cookie) : undefined;

  if (apiAccessPolicy && !authSession?.ok) {
    const body = fail("UNAUTHORIZED", "Authentication required");

    return {
      status: getStatusCode(body),
      body,
      headers,
    };
  }

  const authenticatedRole = authSession?.ok ? authSession.data.user.role : undefined;
  const authenticatedUserId = authSession?.ok ? authSession.data.user.id : undefined;

  if (apiAccessPolicy && authenticatedRole && !roleHasPermission(authenticatedRole, apiAccessPolicy.permission)) {
    const body = fail("FORBIDDEN", "Forbidden", {
      permission: apiAccessPolicy.permission,
      role: authenticatedRole,
    });

    return {
      status: getStatusCode(body),
      body,
      headers,
    };
  }

  const role = authenticatedRole ?? getRoleFromRequest(request, url);

  const bodyPromise: Promise<ApiResponse<unknown>> =
    pathname === "/api/health"
      ? Promise.resolve(createHealthStatus())
      : pathname === "/api/auth/login" && request.method === "POST"
        ? Promise.resolve(rateLimiter.check(getLoginRateLimitKey(request))).then((limited) => {
            if (limited) return limited;

            return auth.login(request.body).then((body) => {
              if (body.ok && body.sessionCookie) {
                rateLimiter.reset(getLoginRateLimitKey(request));
                extraHeaders = {
                  "Set-Cookie": [
                    body.sessionCookie,
                    createCsrfCookie(body.sessionCookie),
                  ].filter((cookie): cookie is string => Boolean(cookie)),
                };
              }
              return body;
            });
          })
        : pathname === "/api/auth/logout" && request.method === "POST"
          ? auth.logout(request.cookie).then((body) => {
              extraHeaders = { "Set-Cookie": [clearSessionCookie(), clearCsrfCookie()] };
              return body;
            })
          : pathname === "/api/auth/password-reset/request" && request.method === "POST"
            ? auth.requestPasswordReset(request.body)
            : pathname === "/api/auth/password-reset/complete" && request.method === "POST"
              ? auth.completePasswordReset(request.body)
          : pathname === "/api/trainings/sessions" && request.method === "POST" && authenticatedUserId
            ? api.createTrainingSession(authenticatedUserId, request.body)
            : trainingMessageMatch && request.method === "POST" && authenticatedUserId
              ? api.addTrainingMessage(authenticatedUserId, decodeURIComponent(trainingMessageMatch[1]), request.body)
              : trainingCompleteMatch && request.method === "POST" && authenticatedUserId
                ? api.completeTrainingSession(authenticatedUserId, decodeURIComponent(trainingCompleteMatch[1]), request.body)
          : pathname === "/api/auth/session"
            ? auth.session(request.cookie)
            : pathname === "/api/users/me"
              ? api.getMe(role)
              : pathname === "/api/users/profile"
                ? api.getProfile(role)
                : pathname === "/api/analytics/dashboard"
                  ? api.getDashboard(role)
                  : pathname === "/api/analytics/manager"
                    ? api.getManagerSummary()
                    : employeeProfileMatch
                      ? api.getEmployeeProfile(decodeURIComponent(employeeProfileMatch[1]))
                      : pathname === "/api/notifications"
                        ? api.getNotifications()
                        : pathname === "/api/trainings/weak-topics"
                          ? api.getWeakTopics()
                          : pathname === "/api/trainings/history"
                            ? api.getTrainingHistory()
                            : pathname === "/api/trainings/session-options"
                              ? api.getSessionOptions()
                              : pathname === "/api/trainings/dialog-script"
                                ? api.getDialogScript()
                                : pathname === "/api/trainings/call-scripts" && request.method === "GET"
                                  ? api.getCallScripts()
                              : pathname === "/api/admin/users" && request.method === "GET"
                                ? api.getAdminUsers()
                                : pathname === "/api/admin/users" && request.method === "POST"
                                  ? api.createAdminUser(request.body)
                                  : adminUserMatch && request.method === "POST"
                                    ? api.updateAdminUser(decodeURIComponent(adminUserMatch[1]), request.body)
                              : pathname === "/api/admin/tests" && request.method === "GET"
                                ? api.getTestQuestions()
                                : pathname === "/api/admin/tests" && request.method === "POST"
                                  ? api.createTestQuestion(request.body)
                                  : pathname === "/api/admin/cases" && request.method === "GET"
                                    ? api.getCaseTemplates()
                                    : pathname === "/api/admin/cases" && request.method === "POST"
                                      ? api.createCaseTemplate(request.body)
                                      : pathname === "/api/admin/objections" && request.method === "GET"
                                        ? api.getObjectionTemplates()
                                        : pathname === "/api/admin/objections" && request.method === "POST"
                                          ? api.createObjectionTemplate(request.body)
                                          : pathname === "/api/admin/call-scripts" && request.method === "GET"
                                            ? api.getCallScripts()
                                            : pathname === "/api/admin/call-scripts" && request.method === "POST"
                                              ? api.createCallScript(request.body)
                                              : callScriptDeleteMatch && request.method === "POST"
                                                ? api.deleteCallScript(decodeURIComponent(callScriptDeleteMatch[1]))
                                                : callScriptMatch && request.method === "POST"
                                                  ? api.updateCallScript(decodeURIComponent(callScriptMatch[1]), request.body)
                                              : Promise.resolve(fail("NOT_FOUND", "Route not found", { path: pathname }));

  return bodyPromise.then((body) => ({
    status: getStatusCode(body),
    body,
    headers: { ...headers, ...extraHeaders },
  }));
};

const writeJson = (response: ServerResponse, resolved: ApiResolvedResponse) => {
  response.writeHead(resolved.status, resolved.headers ?? createJsonHeaders());
  response.end(JSON.stringify(resolved.body));
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  if (request.method !== "POST") return undefined;

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export const createApiHttpServer = (options: ApiServerOptions = {}) =>
  createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const origin = request.headers.origin;
    try {
      const body = await readJsonBody(request);
      const resolved = await resolveApiRequest(
        {
          method: request.method ?? "GET",
          url: request.url ?? "/",
          origin: request.headers.origin,
          cookie: request.headers.cookie,
          body,
          csrfToken: request.headers["x-csrf-token"]?.toString(),
          ip: request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? request.socket.remoteAddress,
        },
        {
          ...options,
          corsOrigins: options.corsOrigins,
        },
      );

      resolved.headers = {
        ...createJsonHeaders(origin, options.corsOrigins),
        ...resolved.headers,
      };
      writeJson(response, resolved);
    } catch {
      writeJson(response, {
        status: 500,
        body: fail("INTERNAL_ERROR", "Internal server error"),
        headers: createJsonHeaders(origin, options.corsOrigins),
      });
    }
  });
