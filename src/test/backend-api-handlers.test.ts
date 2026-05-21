import { describe, expect, it } from "vitest";
import {
  createFrontendApiHandlers,
  demoFrontendApiDataSource,
  frontendApiRoutes,
  getBackendModule,
  moduleRegistry,
} from "../../apps/api/src";
import { findApiAccessPolicy } from "@/lib/access-control";

describe("backend frontend API handlers", () => {
  it("registers frontend-facing routes under existing backend modules", () => {
    const moduleNames = new Set(moduleRegistry.map((module) => module.name));

    frontendApiRoutes.forEach((route) => {
      expect(moduleNames.has(route.module)).toBe(true);
      expect(route.path.startsWith(getBackendModule(route.module)?.exposesApiPrefix ?? "")).toBe(true);
      expect(route.requiresAuth).toBe(!route.path.startsWith("/api/auth/password-reset") && route.path !== "/api/auth/login");
    });
  });

  it("keeps route methods and paths unique", () => {
    const routeKeys = frontendApiRoutes.map((route) => `${route.method} ${route.path}`);

    expect(new Set(routeKeys).size).toBe(routeKeys.length);
  });

  it("keeps protected non-auth routes covered by backend permission policies", () => {
    frontendApiRoutes
      .filter((route) => route.requiresAuth && !route.path.startsWith("/api/auth"))
      .forEach((route) => {
        expect(findApiAccessPolicy(route.method, route.path)).toBeDefined();
      });
  });

  it("returns current user data in the shared API response format", async () => {
    const api = createFrontendApiHandlers();

    await expect(api.getMe("employee")).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({
        id: "employee",
        name: "Анна Петрова",
        role: "employee",
      }),
    });
  });

  it("returns dashboard, notifications and training data through backend handlers", async () => {
    const api = createFrontendApiHandlers();

    await expect(api.getDashboard("employee")).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          lastSession: expect.objectContaining({ topic: "Возражения клиента" }),
          nextTask: expect.objectContaining({ readiness: 74 }),
        }),
      }),
    );
    await expect(api.getNotifications()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.arrayContaining([expect.objectContaining({ id: "daily-training" })]),
      }),
    );
    await expect(api.getWeakTopics()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.arrayContaining([expect.objectContaining({ topic: "Имущество должника" })]),
      }),
    );
    await expect(api.getTrainingHistory()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.arrayContaining([expect.objectContaining({ status: "Сдан" })]),
      }),
    );
  });

  it("returns manager data and employee profile through analytics handlers", async () => {
    const api = createFrontendApiHandlers();

    await expect(api.getManagerSummary()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          employees: expect.arrayContaining([expect.objectContaining({ id: "1" })]),
          kpi: expect.objectContaining({ totalEmployees: expect.any(Number) }),
        }),
      }),
    );
    await expect(api.getEmployeeProfile("1")).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          employee: expect.objectContaining({ id: "1" }),
        }),
      }),
    );
  });

  it("returns a typed 404 for missing employee profiles", async () => {
    const api = createFrontendApiHandlers();

    await expect(api.getEmployeeProfile("missing")).resolves.toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Employee not found",
        details: { id: "missing" },
      },
    });
  });

  it("assigns an employee course through analytics handlers", async () => {
    const api = createFrontendApiHandlers({
      ...demoFrontendApiDataSource,
      assignEmployeeCourse: async (managerId, employeeId, payload) => ({
        assigned: true,
        employeeId,
        topic: payload.topic,
        notificationId: `notification-${managerId}`,
      }),
    });

    await expect(api.assignEmployeeCourse("manager-1", "employee-1", {
      topic: "Имущество должника",
    })).resolves.toEqual({
      ok: true,
      data: {
        assigned: true,
        employeeId: "employee-1",
        topic: "Имущество должника",
        notificationId: "notification-manager-1",
      },
    });
    await expect(api.assignEmployeeCourse("manager-1", "employee-1", {})).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      }),
    );
  });

  it("returns session setup options and dialog script", async () => {
    const api = createFrontendApiHandlers();

    await expect(api.getSessionOptions()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          topics: expect.arrayContaining(["Имущество должника"]),
          formats: expect.arrayContaining(["Текст"]),
        }),
      }),
    );
    await expect(api.getDialogScript()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.arrayContaining([expect.objectContaining({ from: "ai" })]),
      }),
    );
  });

  it("validates admin user mutations", async () => {
    const api = createFrontendApiHandlers({
      ...demoFrontendApiDataSource,
      createAdminUser: async (payload) => ({
        id: "user-1",
        name: payload.name,
        email: payload.email,
        role: payload.role,
        roleLabel: "Юрист",
        status: "active",
        statusLabel: "Активен",
      }),
      updateAdminUser: async (id, payload) => ({
        id,
        name: "Анна Петрова",
        email: "a.petrova@hunterlite.ru",
        role: payload.role || "employee",
        roleLabel: "Юрист",
        status: payload.status || "active",
        statusLabel: payload.status === "blocked" ? "Заблокирован" : "Активен",
      }),
    });

    await expect(api.createAdminUser({ name: "", email: "", role: "employee" })).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
    await expect(api.createAdminUser({
      name: "Новый Юрист",
      email: "NEW@HUNTERLITE.RU",
      role: "employee",
    })).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          email: "new@hunterlite.ru",
          role: "employee",
        }),
      }),
    );
    await expect(api.updateAdminUser("user-1", { status: "blocked" })).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({ status: "blocked" }),
      }),
    );
  });
});
