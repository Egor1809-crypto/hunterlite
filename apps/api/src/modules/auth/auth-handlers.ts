import type {
  AuthLoginRequestDto,
  AuthPasswordResetCompleteDto,
  AuthPasswordResetCompletedDto,
  AuthPasswordResetRequestedDto,
  AuthRegisterRequestDto,
  AuthSessionDto,
  AuthTelegramCodeRequestDto,
  AuthTelegramCodeRequestedDto,
  AuthTelegramLoginRequestDto,
} from "@/lib/api-contracts";
import { getRoleHome, type AppRole } from "@/lib/demo-auth-state";
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
  requestTelegramCode?: (phone: string) => MaybePromise<{ code?: string; sent?: boolean } | null>;
  loginWithTelegramCode?: (payload: AuthTelegramLoginRequestDto) => MaybePromise<{ sessionId: string; session: AuthSessionDto } | null>;
  register?: (payload: AuthRegisterRequestDto) => MaybePromise<{ sessionId: string; session: AuthSessionDto } | null>;
};

export type AuthHandlerOptions = {
  secureCookies?: boolean;
};

const cookieAttributes = (secure = false) =>
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? "; Secure" : ""}`;

const expiredCookieAttributes = (secure = false) =>
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;

export const createDatabaseSessionCookie = (sessionId: string, secure = false) =>
  `${sessionCookieName}=db:${sessionId}; ${cookieAttributes(secure)}`;

export const clearSessionCookie = (secure = false) =>
  `${sessionCookieName}=; ${expiredCookieAttributes(secure)}`;

export const parseDatabaseSessionId = (cookieHeader?: string): string | undefined => {
  const cookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  const value = cookie?.slice(sessionCookieName.length + 1);

  return value?.startsWith("db:") ? value.slice(3) : undefined;
};

export const hasSessionCookie = (cookieHeader?: string): boolean => {
  const cookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  const value = cookie?.slice(sessionCookieName.length + 1);

  return Boolean(value && value.length > 0);
};

const normalizePhone = (phone: unknown) =>
  typeof phone === "string" ? phone.replace(/[^\d+]/g, "").trim() : "";

export const createAuthHandlers = (source: AuthDataSource, options: AuthHandlerOptions = {}) => {
  const secureCookies = options.secureCookies ?? false;

  return {
    login: async (payload: unknown): Promise<ApiResponse<AuthSessionDto> & { sessionCookie?: string }> => {
      const request = payload as Partial<AuthLoginRequestDto> | undefined;
      const email = request?.email?.trim();

      if (!email) {
        return fail("VALIDATION_ERROR", "Email is required", { field: "email" });
      }

      const login = await source.login({ email, password: request?.password });

      if (login) {
        return {
          ...ok(login.session),
          sessionCookie: createDatabaseSessionCookie(login.sessionId, secureCookies),
        };
      }

      return fail("UNAUTHORIZED", "Email или пароль не подошли");
    },

    session: async (cookieHeader?: string): Promise<ApiResponse<AuthSessionDto>> => {
      const sessionId = parseDatabaseSessionId(cookieHeader);

      if (sessionId) {
        const session = await source.session(sessionId);

        if (session) return ok(session);
      }

      return fail("UNAUTHORIZED", "Authentication required");
    },

    logout: async (cookieHeader?: string): Promise<ApiResponse<{ loggedOut: true }>> => {
      const sessionId = parseDatabaseSessionId(cookieHeader);
      if (sessionId) await source.logout?.(sessionId);

      return ok({ loggedOut: true });
    },

    requestPasswordReset: async (payload: unknown): Promise<ApiResponse<AuthPasswordResetRequestedDto>> => {
      const email = (payload as { email?: unknown } | undefined)?.email;

      if (typeof email !== "string" || !email.trim()) {
        return fail("VALIDATION_ERROR", "Email is required", { field: "email" });
      }

      await source.requestPasswordReset?.(email.trim().toLowerCase());

      return ok({ sent: true });
    },

    completePasswordReset: async (payload: unknown): Promise<ApiResponse<AuthPasswordResetCompletedDto>> => {
      const request = payload as Partial<AuthPasswordResetCompleteDto> | undefined;

      if (!request?.token) {
        return fail("VALIDATION_ERROR", "Reset token is required", { field: "token" });
      }

      if (!request.newPassword || request.newPassword.length < 8) {
        return fail("VALIDATION_ERROR", "Password must contain at least 8 characters", { field: "newPassword" });
      }

      const reset = await source.completePasswordReset?.({
        token: request.token,
        newPassword: request.newPassword,
      });

      if (!reset) return fail("UNAUTHORIZED", "Reset token is invalid or expired");

      return ok({ reset: true });
    },

    requestTelegramCode: async (payload: unknown): Promise<ApiResponse<AuthTelegramCodeRequestedDto>> => {
      const request = payload as Partial<AuthTelegramCodeRequestDto> | undefined;
      const phone = normalizePhone(request?.phone);

      if (!phone || phone.replace(/\D/g, "").length < 10) {
        return fail("VALIDATION_ERROR", "Phone number is required", { field: "phone" });
      }

      const result = await source.requestTelegramCode?.(phone);

      if (result?.sent) {
        return ok({ sent: true, channel: "telegram" });
      }

      return ok({
        sent: true,
        channel: "telegram",
        devCode: result?.code,
      });
    },

    loginWithTelegramCode: async (payload: unknown): Promise<ApiResponse<AuthSessionDto> & { sessionCookie?: string }> => {
      const request = payload as Partial<AuthTelegramLoginRequestDto> | undefined;
      const phone = normalizePhone(request?.phone);
      const code = request?.code?.trim();

      if (!phone || phone.replace(/\D/g, "").length < 10) {
        return fail("VALIDATION_ERROR", "Phone number is required", { field: "phone" });
      }

      if (!code) {
        return fail("VALIDATION_ERROR", "SMS code is required", { field: "code" });
      }

      const login = await source.loginWithTelegramCode?.({ phone, code });

      if (login) {
        return {
          ...ok(login.session),
          sessionCookie: createDatabaseSessionCookie(login.sessionId, secureCookies),
        };
      }

      return fail("UNAUTHORIZED", "Telegram code is invalid or expired");
    },

    register: async (payload: unknown): Promise<ApiResponse<AuthSessionDto> & { sessionCookie?: string }> => {
      const request = payload as Partial<AuthRegisterRequestDto> | undefined;
      const email = request?.email?.trim().toLowerCase();
      const fullName = request?.fullName?.trim();
      const password = request?.password;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail("VALIDATION_ERROR", "Введите корректный email", { field: "email" });
      }

      if (!fullName || fullName.length < 2) {
        return fail("VALIDATION_ERROR", "Введите ФИО (минимум 2 символа)", { field: "fullName" });
      }

      if (!password || password.length < 8) {
        return fail("VALIDATION_ERROR", "Пароль должен содержать минимум 8 символов", { field: "password" });
      }

      const result = await source.register?.({ email, password, fullName });

      if (!result) {
        return fail("CONFLICT", "Пользователь с таким email уже зарегистрирован");
      }

      return {
        ...ok(result.session),
        sessionCookie: createDatabaseSessionCookie(result.sessionId, secureCookies),
      };
    },
  };
};
