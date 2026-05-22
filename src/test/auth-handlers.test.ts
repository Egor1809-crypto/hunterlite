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
    const auth = createAuthHandlers();

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
    });

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

  it("requests and verifies Telegram SMS codes in demo mode", async () => {
    const auth = createAuthHandlers();

    await expect(auth.requestTelegramCode({ phone: "+7 900 000-00-00" })).resolves.toEqual({
      ok: true,
      data: {
        sent: true,
        channel: "telegram",
        devCode: "1809",
      },
    });
    await expect(auth.loginWithTelegramCode({ phone: "+7 900 000-00-00", code: "1809" })).resolves.toEqual({
      ok: true,
      sessionCookie: expect.stringContaining("hunterlite_session=demo:employee"),
      data: expect.objectContaining({
        homePath: "/dashboard",
        user: expect.objectContaining({ role: "employee" }),
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

  it("resolves Telegram auth HTTP routes with session and CSRF cookies", async () => {
    await expect(resolveApiRequest({
      method: "POST",
      url: "/api/auth/telegram/request-code",
      body: { phone: "+7 900 000-00-00" },
    })).resolves.toEqual(
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
      body: { phone: "+7 900 000-00-00", code: "1809" },
    });

    expect(login.status).toBe(200);
    expect(login.headers?.["Set-Cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("hunterlite_session=demo:employee"),
        expect.stringContaining("hunterlite_csrf="),
      ]),
    );
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
    });

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
      }),
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
    });
    expect(logout.headers?.["Set-Cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("hunterlite_session=;"),
        expect.stringContaining("hunterlite_csrf=;"),
      ]),
    );
  });
});
