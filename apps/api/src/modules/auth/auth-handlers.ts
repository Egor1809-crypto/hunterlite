import type {
  AuthLoginRequestDto,
  AuthPasswordResetCompleteDto,
  AuthPasswordResetCompletedDto,
  AuthPasswordResetRequestedDto,
  AuthSessionDto,
} from "@/lib/api-contracts";
import { getCurrentUser } from "@/lib/demo-api";
import { getRoleHome, inferRoleFromEmail, type AppRole } from "@/lib/demo-auth-state";
import type { ApiResponse } from "../../http/api-response";
import { fail, ok } from "../../http/api-response";

export const sessionCookieName = "hunterlite_session";
type MaybePromise<T> = T | Promise<T>;

export type AuthDataSource = {
  login: (payload: AuthLoginRequestDto) => MaybePromise<{ sessionId: string; session: AuthSessionDto } | null>;
  session: (sessionId: string) => MaybePromise<AuthSessionDto | null>;
  logout?: (sessionId: string) => MaybePromise<void>;
  requestPasswordReset?: (email: string) => MaybePromise<{ token?: string } | null>;
  completePasswordReset?: (payload: AuthPasswordResetCompleteDto) => MaybePromise<boolean>;
};

export type AuthHandlerOptions = {
  allowDemoFallback?: boolean;
};

const roleValues = new Set<AppRole>(["employee", "manager", "admin", "client"]);

export const createSessionCookie = (role: AppRole) =>
  `${sessionCookieName}=demo:${role}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;

export const createDatabaseSessionCookie = (sessionId: string) =>
  `${sessionCookieName}=db:${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;

export const clearSessionCookie = () =>
  `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export const parseSessionRole = (cookieHeader?: string): AppRole | undefined => {
  const cookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  const value = cookie?.slice(sessionCookieName.length + 1);
  const role = value?.startsWith("demo:") ? value.slice(5) : undefined;

  return roleValues.has(role as AppRole) ? (role as AppRole) : undefined;
};

export const parseDatabaseSessionId = (cookieHeader?: string): string | undefined => {
  const cookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  const value = cookie?.slice(sessionCookieName.length + 1);

  return value?.startsWith("db:") ? value.slice(3) : undefined;
};

const createSession = (role: AppRole): AuthSessionDto => ({
  user: getCurrentUser(role),
  homePath: getRoleHome(role),
});

export const createAuthHandlers = (source?: AuthDataSource, options: AuthHandlerOptions = {}) => {
  const allowDemoFallback = options.allowDemoFallback ?? true;

  return {
    login: async (payload: unknown): Promise<ApiResponse<AuthSessionDto> & { sessionCookie?: string }> => {
      const request = payload as Partial<AuthLoginRequestDto> | undefined;
      const email = request?.email?.trim();

      if (!email) {
        return fail("VALIDATION_ERROR", "Email is required", { field: "email" });
      }

      const login = await source?.login({ email, password: request?.password });

      if (login) {
        return {
          ...ok(login.session),
          sessionCookie: createDatabaseSessionCookie(login.sessionId),
        };
      }

      if (!allowDemoFallback) {
        return fail("UNAUTHORIZED", "Invalid email or password");
      }

      const role = inferRoleFromEmail(email);

      return {
        ...ok(createSession(role)),
        sessionCookie: createSessionCookie(role),
      };
    },

    session: async (cookieHeader?: string): Promise<ApiResponse<AuthSessionDto>> => {
      const sessionId = parseDatabaseSessionId(cookieHeader);

      if (sessionId) {
        const session = await source?.session(sessionId);

        if (session) return ok(session);
      }

      const role = parseSessionRole(cookieHeader);

      if (!role || !allowDemoFallback) {
        return fail("UNAUTHORIZED", "Authentication required");
      }

      return ok(createSession(role));
    },

    logout: async (cookieHeader?: string): Promise<ApiResponse<{ loggedOut: true }>> => {
      const sessionId = parseDatabaseSessionId(cookieHeader);
      if (sessionId) await source?.logout?.(sessionId);

      return ok({ loggedOut: true });
    },

    requestPasswordReset: async (payload: unknown): Promise<ApiResponse<AuthPasswordResetRequestedDto>> => {
      const email = (payload as { email?: unknown } | undefined)?.email;

      if (typeof email !== "string" || !email.trim()) {
        return fail("VALIDATION_ERROR", "Email is required", { field: "email" });
      }

      const reset = await source?.requestPasswordReset?.(email.trim().toLowerCase());

      return ok({
        sent: true,
        ...(reset?.token ? { devToken: reset.token } : {}),
      });
    },

    completePasswordReset: async (payload: unknown): Promise<ApiResponse<AuthPasswordResetCompletedDto>> => {
      const request = payload as Partial<AuthPasswordResetCompleteDto> | undefined;

      if (!request?.token) {
        return fail("VALIDATION_ERROR", "Reset token is required", { field: "token" });
      }

      if (!request.newPassword || request.newPassword.length < 8) {
        return fail("VALIDATION_ERROR", "Password must contain at least 8 characters", { field: "newPassword" });
      }

      const reset = await source?.completePasswordReset?.({
        token: request.token,
        newPassword: request.newPassword,
      });

      if (!reset) return fail("UNAUTHORIZED", "Reset token is invalid or expired");

      return ok({ reset: true });
    },
  };
};
