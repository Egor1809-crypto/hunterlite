import { describe, expect, it } from "vitest";
import {
  backendModules,
  createHealthStatus,
  fail,
  getBackendModule,
  moduleRegistry,
  ok,
  parseCorsOrigins,
  parseEnv,
} from "../../apps/api/src";
import { dataTables } from "@/lib/data-model";
import packageJson from "../../package.json";

describe("block 3 backend foundation", () => {
  it("parses the backend environment contract", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      API_PORT: "3001",
      DATABASE_URL: "postgresql://hunterlite:hunterlite@localhost:5432/hunterlite",
      SESSION_COOKIE_NAME: "hunterlite_session",
      CORS_ORIGINS: "http://127.0.0.1:8080,http://localhost:8080",
      AUTH_DEMO_FALLBACK: "true",
      HUNTERLITE_CSRF_SECRET: "test-csrf-secret",
      NAVI_API_KEY: "test-key",
      TELEGRAM_BOT_TOKEN: "telegram-token",
      TELEGRAM_DEFAULT_CHAT_ID: "123456",
      TELEGRAM_LOGIN_EMAIL: "a.petrova@hunterlite.ru",
    });

    expect(env).toEqual({
      NODE_ENV: "test",
      API_PORT: 3001,
      DATABASE_URL: "postgresql://hunterlite:hunterlite@localhost:5432/hunterlite",
      SESSION_COOKIE_NAME: "hunterlite_session",
      CORS_ORIGINS: "http://127.0.0.1:8080,http://localhost:8080",
      AUTH_DEMO_FALLBACK: true,
      HUNTERLITE_CSRF_SECRET: "test-csrf-secret",
      NAVI_API_KEY: "test-key",
      NAVI_BASE_URL: "https://api.navy",
      NAVI_CHAT_MODEL: "gemini-3.5-flash",
      NAVI_TTS_MODEL: "eleven_flash_v2_5",
      NAVI_TTS_VOICE: "aria",
      NAVI_STT_MODEL: "scribe_v2",
      TELEGRAM_BOT_TOKEN: "telegram-token",
      TELEGRAM_DEFAULT_CHAT_ID: "123456",
      TELEGRAM_LOGIN_EMAIL: "a.petrova@hunterlite.ru",
    });
  });

  it("disables demo auth fallback by default in production", () => {
    expect(
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://hunterlite:hunterlite@localhost:5432/hunterlite",
        HUNTERLITE_CSRF_SECRET: "production-csrf-secret-32-characters",
        NAVI_API_KEY: "production-key",
      }).AUTH_DEMO_FALLBACK,
    ).toBe(false);

    expect(
      parseEnv({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://hunterlite:hunterlite@localhost:5432/hunterlite",
      }).AUTH_DEMO_FALLBACK,
    ).toBe(true);
  });

  it("rejects missing database configuration", () => {
    expect(() => parseEnv({ NODE_ENV: "test" })).toThrow();
  });

  it("requires a strong CSRF secret in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://hunterlite:hunterlite@localhost:5432/hunterlite",
        NAVI_API_KEY: "production-key",
      }),
    ).toThrow(/HUNTERLITE_CSRF_SECRET/);
  });

  it("requires a NAVI API key in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://hunterlite:hunterlite@localhost:5432/hunterlite",
        HUNTERLITE_CSRF_SECRET: "production-csrf-secret-32-characters",
      }),
    ).toThrow(/NAVI_API_KEY/);
  });

  it("normalizes CORS origins", () => {
    expect(parseCorsOrigins("http://127.0.0.1:8080, http://localhost:8080,")).toEqual([
      "http://127.0.0.1:8080",
      "http://localhost:8080",
    ]);
  });

  it("creates consistent API success responses", () => {
    expect(ok({ id: "1" }, { requestId: "req_1" })).toEqual({
      ok: true,
      data: { id: "1" },
      meta: { requestId: "req_1" },
    });
  });

  it("creates consistent API error responses", () => {
    expect(fail("UNAUTHORIZED", "Authentication required")).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("defines the modular-monolith backend modules", () => {
    expect(backendModules).toEqual([
      "auth",
      "users",
      "organizations",
      "roles",
      "trainings",
      "exams",
      "notifications",
      "admin",
      "analytics",
      "ai",
    ]);
  });

  it("does not duplicate backend modules or API prefixes", () => {
    expect(new Set(moduleRegistry.map((module) => module.name)).size).toBe(moduleRegistry.length);
    expect(new Set(moduleRegistry.map((module) => module.exposesApiPrefix)).size).toBe(moduleRegistry.length);
  });

  it("maps every module-owned table to the data model", () => {
    const knownTables = new Set<string>(dataTables);

    moduleRegistry.forEach((module) => {
      module.ownsTables.forEach((tableName) => {
        expect(knownTables.has(tableName)).toBe(true);
      });
    });
  });

  it("keeps public-facing backend modules explicitly unauthenticated", () => {
    expect(getBackendModule("auth")?.requiresAuth).toBe(false);
    expect(getBackendModule("ai")?.requiresAuth).toBe(false);
    expect(getBackendModule("admin")?.requiresAuth).toBe(true);
  });

  it("creates a health response contract", () => {
    const health = createHealthStatus(new Date("2026-05-14T12:00:00.000Z"));

    expect(health).toEqual({
      ok: true,
      data: {
        service: "hunterlite-api",
        status: "ok",
        database: "configured",
        timestamp: "2026-05-14T12:00:00.000Z",
      },
    });
  });

  it("adds a runnable API development script", () => {
    expect(packageJson.scripts["api:dev"]).toBe("vite-node apps/api/src/server/main.ts");
  });
});
