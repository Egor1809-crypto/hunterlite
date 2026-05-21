import { describe, expect, it } from "vitest";
import {
  createApiHttpServer,
  createCsrfCookie,
  createLoginRateLimiter,
  demoFrontendApiDataSource,
  resolveApiRequest,
} from "../../apps/api/src";

describe("backend HTTP resolver", () => {
  it("resolves health checks", async () => {
    const response = await resolveApiRequest({ method: "GET", url: "/api/health" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          service: "hunterlite-api",
          status: "ok",
        }),
      }),
    );
  });

  it("uses session role instead of trusting role query params", async () => {
    const response = await resolveApiRequest({
      method: "GET",
      url: "/api/users/me?role=manager",
      cookie: "hunterlite_session=demo:employee",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: "employee",
        role: "employee",
        name: "Анна Петрова",
      }),
    });
  });

  it("resolves dynamic employee profile routes", async () => {
    const response = await resolveApiRequest({
      method: "GET",
      url: "/api/analytics/manager/employees/2",
      cookie: "hunterlite_session=demo:manager",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          employee: expect.objectContaining({
            id: "2",
            name: "Иван Смирнов",
          }),
        }),
      }),
    );
  });

  it("returns 404 for unknown routes and missing dynamic records", async () => {
    await expect(resolveApiRequest({ method: "GET", url: "/api/missing" })).resolves.toEqual(
      expect.objectContaining({
        status: 404,
        body: {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Route not found",
            details: { path: "/api/missing" },
          },
        },
      }),
    );

    await expect(resolveApiRequest({
      method: "GET",
      url: "/api/analytics/manager/employees/missing",
      cookie: "hunterlite_session=demo:manager",
    })).resolves.toEqual(
      expect.objectContaining({
        status: 404,
        body: {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Employee not found",
            details: { id: "missing" },
          },
        },
      }),
    );
  });

  it("requires session cookies for protected API routes", async () => {
    await expect(resolveApiRequest({ method: "GET", url: "/api/analytics/manager?role=manager" })).resolves.toEqual(
      expect.objectContaining({
        status: 401,
        body: {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
      }),
    );
  });

  it("rejects authenticated users without the required backend role", async () => {
    await expect(resolveApiRequest({
      method: "GET",
      url: "/api/analytics/manager",
      cookie: "hunterlite_session=demo:employee",
    })).resolves.toEqual(
      expect.objectContaining({
        status: 403,
        body: {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Forbidden",
            details: {
              permission: "team:read:organization",
              role: "employee",
            },
          },
        },
      }),
    );
  });

  it("protects admin content endpoints with admin permissions", async () => {
    await expect(resolveApiRequest({
      method: "GET",
      url: "/api/admin/tests",
      cookie: "hunterlite_session=demo:employee",
    })).resolves.toEqual(
      expect.objectContaining({
        status: 403,
        body: {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Forbidden",
            details: {
              permission: "training_content:read",
              role: "employee",
            },
          },
        },
      }),
    );

    await expect(resolveApiRequest({
      method: "GET",
      url: "/api/admin/tests",
      cookie: "hunterlite_session=demo:admin",
    })).resolves.toEqual(expect.objectContaining({ status: 200 }));
  });

  it("requires a CSRF token for authenticated POST requests", async () => {
    const sessionCookie = "hunterlite_session=demo:admin";
    const csrfCookie = createCsrfCookie(sessionCookie);
    const csrfToken = csrfCookie?.split(";")[0].slice("hunterlite_csrf=".length);

    await expect(resolveApiRequest({
      method: "POST",
      url: "/api/auth/logout",
      cookie: sessionCookie,
    })).resolves.toEqual(
      expect.objectContaining({
        status: 403,
        body: {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "CSRF token is required",
          },
        },
      }),
    );

    await expect(resolveApiRequest({
      method: "POST",
      url: "/api/auth/logout",
      cookie: sessionCookie,
      csrfToken,
    })).resolves.toEqual(expect.objectContaining({ status: 200 }));
  });

  it("rejects demo login when demo auth fallback is disabled", async () => {
    await expect(resolveApiRequest({
      method: "POST",
      url: "/api/auth/login",
      body: { email: "manager@hunterlite.ru", password: "wrong" },
    }, {
      authDemoFallback: false,
    })).resolves.toEqual(
      expect.objectContaining({
        status: 401,
        body: {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          },
        },
      }),
    );
  });

  it("rate limits repeated login attempts by address and email", async () => {
    const loginRateLimiter = createLoginRateLimiter({
      maxAttempts: 2,
      windowMs: 1000,
      now: () => 1000,
    });
    const loginRequest = {
      method: "POST",
      url: "/api/auth/login",
      ip: "10.0.0.1",
      body: { email: "manager@hunterlite.ru", password: "wrong" },
    } as const;

    await expect(resolveApiRequest(loginRequest, { loginRateLimiter, authDemoFallback: false })).resolves.toEqual(
      expect.objectContaining({ status: 401 }),
    );
    await expect(resolveApiRequest(loginRequest, { loginRateLimiter, authDemoFallback: false })).resolves.toEqual(
      expect.objectContaining({ status: 401 }),
    );
    await expect(resolveApiRequest(loginRequest, { loginRateLimiter, authDemoFallback: false })).resolves.toEqual(
      expect.objectContaining({
        status: 429,
        body: {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many login attempts",
            details: { retryAfterMs: 1000 },
          },
        },
      }),
    );

    await expect(resolveApiRequest({
      ...loginRequest,
      ip: "10.0.0.2",
    }, { loginRateLimiter, authDemoFallback: false })).resolves.toEqual(expect.objectContaining({ status: 401 }));
  });

  it("creates training sessions for authenticated employees", async () => {
    const cookie = "hunterlite_session=demo:employee";
    const csrfToken = createCsrfCookie(cookie)?.split(";")[0].slice("hunterlite_csrf=".length);
    const source = {
      ...demoFrontendApiDataSource,
      createTrainingSession: async (userId: string) => ({
        id: "session-1",
        topic: "Имущество должника",
        mode: "talk" as const,
        difficulty: "medium" as const,
        format: "text" as const,
        character: "anxious" as const,
        questionCount: 50,
        status: "active" as const,
        userId,
      }),
    };

    await expect(resolveApiRequest({
      method: "POST",
      url: "/api/trainings/sessions",
      cookie,
      csrfToken,
      body: {
        topic: "Имущество должника",
        mode: "talk",
        difficulty: "medium",
        format: "text",
        character: "anxious",
      },
    }, { source })).resolves.toEqual(
      expect.objectContaining({
        status: 200,
        body: expect.objectContaining({
          ok: true,
          data: expect.objectContaining({
            id: "session-1",
            questionCount: 50,
          }),
        }),
      }),
    );
  });

  it("rejects unsupported methods with a typed error", async () => {
    await expect(resolveApiRequest({ method: "POST", url: "/api/users/me" })).resolves.toEqual(
      expect.objectContaining({
        status: 400,
        body: {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "Unsupported method",
            details: { method: "POST" },
          },
        },
      }),
    );
  });

  it("creates a Node HTTP server and resolves CORS headers", async () => {
    const server = createApiHttpServer({
      corsOrigins: "http://127.0.0.1:8080",
    });
    const response = await resolveApiRequest({
      method: "GET",
      url: "/api/health",
      origin: "http://127.0.0.1:8080",
    }, {
      corsOrigins: "http://127.0.0.1:8080",
    });

    expect(server.listening).toBe(false);
    expect(response.status).toBe(200);
    expect(response.headers?.["Access-Control-Allow-Origin"]).toBe("http://127.0.0.1:8080");
    expect(response.headers?.["Access-Control-Allow-Headers"]).toContain("X-CSRF-Token");
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({ service: "hunterlite-api" }),
      }),
    );
  });
});
