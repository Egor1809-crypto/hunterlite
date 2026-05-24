import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  createAuthHandlers,
  createCsrfCookie,
  createSessionCookie,
  createDatabaseSessionCookie,
  parseSessionRole,
  parseDatabaseSessionId,
  resolveApiRequest,
} from "../../apps/api/src";

describe("auth handlers", () => {
  it("logs in by email and creates a demo session payload", async () => {
    const auth = createAuthHandlers(undefined, { allowDemoFallback: true });

    await expect(auth.login({ email: "manager@hunterlite.ru", password: "secret" })).resolves.toEqual({
      ok: true,
      sessionCookie: expect.stringContaining("hunterlite_session=demo:manager"),
      data: {
        user: expect.objectContaining({
          role: "manager",
          name: "Ольга Литвинова",
        }),
        homePath: "/manager",
      },
    });
  });

  it("validates login payloads", async () => {
    await expect(createAuthHandlers().login({ email: "" })).resolves.toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Email is required",
        details: { field: "email" },
      },
    });
  });

  it("resolves password reset handlers without leaking unknown emails", async () => {
    const auth = createAuthHandlers({
      login: async () => null,
      session: async () => null,
      requestPasswordReset: async (email) => (email === "manager@hunterlite.ru" ? { token: "dev-token" } : null),
      completePasswordReset: async ({ token }) => token === "dev-token",
    }, { allowDemoFallback: true });

    await expect(auth.requestPasswordReset({ email: "manager@hunterlite.ru" })).resolves.toEqual({
      ok: true,
      data: { sent: true, devToken: "dev-token" },
    });
    await expect(auth.requestPasswordReset({ email: "missing@hunterlite.ru" })).resolves.toEqual({
      ok: true,
      data: { sent: true },
    });
    await expect(auth.completePasswordReset({ token: "dev-token", newPassword: "new-secret" })).resolves.toEqual({
      ok: true,
      data: { reset: true },
    });
  });

  it("rejects Telegram login without a configured auth source", async () => {
    const auth = createAuthHandlers(undefined, { allowDemoFallback: true });

    await expect(auth.requestTelegramCode({ phone: "+7 900 000-00-00" })).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({
        sent: true,
        channel: "telegram",
      }),
    });
    await expect(auth.loginWithTelegramCode({ phone: "+7 900 000-00-00", code: "0000" })).resolves.toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Telegram code is invalid or expired",
      },
    });
  });

  it("delegates Telegram codes to strict auth sources", async () => {
    const auth = createAuthHandlers({
      login: async () => null,
      session: async () => null,
      requestTelegramCode: async (phone) => (phone === "+79000000000" ? { code: "654321" } : null),
      loginWithTelegramCode: async ({ code }) =>
        code === "654321"
          ? {
              sessionId: "session-telegram",
              session: {
                user: {
                  id: "user-telegram",
                  name: "Анна Петрова",
                  firstName: "Анна",
                  role: "employee",
                  roleLabel: "Юрист-консультант",
                  email: "a.petrova@hunterlite.ru",
                  status: "Допущен",
                  avgScore: 82,
                  examPassed: false,
                  weeklyTrainings: 6,
                },
                homePath: "/dashboard",
              },
            }
          : null,
    }, { allowDemoFallback: false });

    await expect(auth.requestTelegramCode({ phone: "+7 900 000-00-00" })).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({
        sent: true,
        channel: "telegram",
      }),
    });
    await expect(auth.loginWithTelegramCode({ phone: "+7 900 000-00-00", code: "654321" })).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        sessionCookie: expect.stringContaining("hunterlite_session=db:session-telegram"),
      }),
    );
  });

  it("resolves Telegram auth HTTP routes", async () => {
    await expect(resolveApiRequest({
      method: "POST",
      url: "/api/auth/telegram/request-code",
      body: { phone: "+7 900 000-00-00" },
    }, { authDemoFallback: true })).resolves.toEqual(
      expect.objectContaining({
        status: 200,
        body: expect.objectContaining({
          ok: true,
          data: expect.objectContaining({ channel: "telegram" }),
        }),
      }),
    );

    const login = await resolveApiRequest({
      method: "POST",
      url: "/api/auth/telegram/login",
      body: { phone: "+7 900 000-00-00", code: "wrong" },
    }, { authDemoFallback: true });

    expect(login.status).toBe(401);
  });

  it("can disable demo auth fallback for strict environments", async () => {
    const auth = createAuthHandlers(undefined, { allowDemoFallback: false });

    await expect(auth.login({ email: "manager@hunterlite.ru", password: "wrong" })).resolves.toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      },
    });
    await expect(auth.session("hunterlite_session=demo:manager")).resolves.toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("parses and clears session cookies", () => {
    expect(createSessionCookie("admin")).toContain("hunterlite_session=demo:admin");
    expect(createDatabaseSessionCookie("session-1")).toContain("hunterlite_session=db:session-1");
    expect(createSessionCookie("admin", true)).toContain("; Secure");
    expect(createDatabaseSessionCookie("session-1", true)).toContain("; Secure");
    expect(parseSessionRole("other=1; hunterlite_session=demo:admin")).toBe("admin");
    expect(parseDatabaseSessionId("hunterlite_session=db:session-1")).toBe("session-1");
    expect(parseSessionRole("hunterlite_session=demo:unknown")).toBeUndefined();
    expect(clearSessionCookie()).toContain("Max-Age=0");
    expect(clearSessionCookie(true)).toContain("; Secure");
  });

  it("resolves auth HTTP routes with typed responses and cookies", async () => {
    const login = await resolveApiRequest({
      method: "POST",
      url: "/api/auth/login",
      body: { email: "admin@hunterlite.ru" },
    }, { authDemoFallback: true });

    expect(login.status).toBe(200);
    expect(login.headers?.["Set-Cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("hunterlite_session=demo:admin"),
        expect.stringContaining("hunterlite_csrf="),
      ]),
    );
    expect(login.body).toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          homePath: "/admin",
        }),
      }),
    );

    await expect(
      resolveApiRequest({
        method: "GET",
        url: "/api/auth/session",
        cookie: "hunterlite_session=demo:admin",
      }, { authDemoFallback: true }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 200,
        body: expect.objectContaining({
          ok: true,
          data: expect.objectContaining({ homePath: "/admin" }),
        }),
      }),
    );

    const sessionCookie = "hunterlite_session=demo:admin";
    const csrfCookie = createCsrfCookie(sessionCookie);
    const logout = await resolveApiRequest({
      method: "POST",
      url: "/api/auth/logout",
      cookie: sessionCookie,
      csrfToken: csrfCookie?.split(";")[0].slice("hunterlite_csrf=".length),
    }, { authDemoFallback: true });
    expect(logout.headers?.["Set-Cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("hunterlite_session=;"),
        expect.stringContaining("hunterlite_csrf=;"),
      ]),
    );
  });
});
