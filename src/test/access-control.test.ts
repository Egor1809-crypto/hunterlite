import { describe, expect, it } from "vitest";
import {
  accessRoutes,
  apiAccessPolicies,
  canAccessApi,
  canAccessRoute,
  findApiAccessPolicy,
  findAccessRoute,
  permissions,
  roleHasPermission,
  roles,
  type Permission,
  type Role,
} from "@/lib/access-control";

const appRoutes = [
  "/login",
  "/consent",
  "/dashboard",
  "/modes",
  "/session/setup",
  "/session/talk",
  "/session/exam",
  "/session/chat-test",
  "/session/cases",
  "/session/answer-review",
  "/session/result",
  "/remedial-course",
  "/history",
  "/weak-topics",
  "/notifications",
  "/bfl-book",
  "/profile",
  "/manager",
  "/manager/employee/1",
  "/manager/reports",
  "/admin",
  "/admin/users",
  "/admin/settings",
  "/admin/tests",
  "/admin/cases",
  "/admin/objections",
  "/admin/scripts",
  "/admin/methodology",
  "/client",
  "/client/chat",
  "/client/lead",
] as const;

const expectedAccess: Record<(typeof appRoutes)[number], readonly Role[]> = {
  "/login": ["public", "employee", "manager", "admin"],
  "/consent": ["public", "employee", "manager", "admin"],
  "/dashboard": ["employee"],
  "/modes": ["employee"],
  "/session/setup": ["employee"],
  "/session/talk": ["employee"],
  "/session/exam": ["employee"],
  "/session/chat-test": ["employee"],
  "/session/cases": ["employee"],
  "/session/answer-review": ["employee"],
  "/session/result": ["employee", "manager"],
  "/remedial-course": ["employee"],
  "/history": ["employee"],
  "/weak-topics": ["employee"],
  "/notifications": ["employee", "manager", "admin"],
  "/bfl-book": ["employee"],
  "/profile": ["employee", "manager", "admin"],
  "/manager": ["manager"],
  "/manager/employee/1": ["manager"],
  "/manager/reports": ["manager"],
  "/admin": ["admin"],
  "/admin/users": ["admin"],
  "/admin/settings": ["admin"],
  "/admin/tests": ["admin"],
  "/admin/cases": ["admin"],
  "/admin/objections": ["admin"],
  "/admin/scripts": ["admin"],
  "/admin/methodology": ["admin"],
  "/client": ["public", "client"],
  "/client/chat": ["public", "client"],
  "/client/lead": ["public", "client"],
};

const expectedPermissions: Record<Exclude<Role, "public">, readonly Permission[]> = {
  employee: [
    "profile:read:self",
    "profile:update:self",
    "training:create:self",
    "training:read:self",
    "training:complete:self",
    "training_result:read",
    "exam:create:self",
    "exam:read:self",
    "exam:complete:self",
    "history:read:self",
    "weak_topics:read:self",
    "notifications:read:self",
    "notifications:update:self",
  ],
  manager: [
    "profile:read:self",
    "profile:update:self",
    "team:read:organization",
    "employee:read:organization",
    "employee_history:read:organization",
    "employee_weak_topics:read:organization",
    "employee_course:assign",
    "training_result:read",
    "reports:read:organization",
    "notifications:read:self",
    "notifications:update:self",
  ],
  admin: [
    "profile:read:self",
    "profile:update:self",
    "system:read",
    "users:read",
    "users:create",
    "users:update",
    "users:block",
    "roles:read",
    "roles:update",
    "settings:read",
    "settings:update",
    "training_content:read",
    "training_content:create",
    "training_result:read",
    "audit_logs:read",
    "notifications:read:self",
    "notifications:update:self",
  ],
  client: [
    "client_chat:create",
    "client_lead:create",
  ],
};

const apiAccessCases = [
  { method: "GET", path: "/api/users/me", allowed: ["employee", "manager", "admin"] },
  { method: "GET", path: "/api/trainings/weak-topics", allowed: ["employee"] },
  { method: "POST", path: "/api/ai/chat", allowed: ["employee"] },
  { method: "POST", path: "/api/ai/speech", allowed: ["employee"] },
  { method: "POST", path: "/api/ai/transcriptions", allowed: ["employee"] },
  { method: "POST", path: "/api/trainings/sessions", allowed: ["employee"] },
  { method: "GET", path: "/api/trainings/sessions/session-1", allowed: ["employee", "manager", "admin"] },
  { method: "POST", path: "/api/trainings/sessions/session-1/messages", allowed: ["employee"] },
  { method: "POST", path: "/api/trainings/sessions/session-1/complete", allowed: ["employee"] },
  { method: "GET", path: "/api/analytics/manager", allowed: ["manager"] },
  { method: "GET", path: "/api/analytics/manager/reports", allowed: ["manager"] },
  { method: "GET", path: "/api/analytics/manager/employees/2", allowed: ["manager"] },
  { method: "POST", path: "/api/analytics/manager/employees/2/course", allowed: ["manager"] },
  { method: "GET", path: "/api/admin/users", allowed: ["admin"] },
  { method: "POST", path: "/api/admin/users", allowed: ["admin"] },
  { method: "POST", path: "/api/admin/users/user-1", allowed: ["admin"] },
  { method: "GET", path: "/api/admin/tests", allowed: ["admin"] },
  { method: "POST", path: "/api/admin/tests", allowed: ["admin"] },
  { method: "GET", path: "/api/admin/cases", allowed: ["admin"] },
  { method: "POST", path: "/api/admin/cases", allowed: ["admin"] },
  { method: "GET", path: "/api/admin/objections", allowed: ["admin"] },
  { method: "POST", path: "/api/admin/objections", allowed: ["admin"] },
  { method: "GET", path: "/api/admin/call-scripts", allowed: ["admin"] },
  { method: "POST", path: "/api/admin/call-scripts", allowed: ["admin"] },
  { method: "POST", path: "/api/admin/call-scripts/script-1", allowed: ["admin"] },
  { method: "POST", path: "/api/admin/call-scripts/script-1/delete", allowed: ["admin"] },
] as const;

describe("block 1 access map", () => {
  it("defines the first-version platform roles", () => {
    expect(roles).toEqual(["public", "employee", "manager", "admin", "client"]);
  });

  it.each(appRoutes)("has an access policy for %s", (route) => {
    expect(findAccessRoute(route)).toBeDefined();
  });

  it.each(appRoutes)("matches the documented role matrix for %s", (route) => {
    const allowedRoles = expectedAccess[route];

    roles.forEach((role) => {
      expect(canAccessRoute(role, route)).toBe(allowedRoles.includes(role));
    });
  });

  it("matches dynamic manager employee routes before the manager index route", () => {
    expect(findAccessRoute("/manager/employee/42")?.path).toBe("/manager/employee/:id");
    expect(canAccessRoute("manager", "/manager/employee/42")).toBe(true);
    expect(canAccessRoute("employee", "/manager/employee/42")).toBe(false);
  });

  it("ignores query strings and hashes when checking route access", () => {
    expect(canAccessRoute("employee", "/session/setup?mode=talk")).toBe(true);
    expect(canAccessRoute("employee", "/session/setup#top")).toBe(true);
    expect(canAccessRoute("manager", "/session/setup?mode=talk")).toBe(false);
  });

  it("keeps internal app routes closed for public users", () => {
    const internalRoutes = appRoutes.filter((route) => !["/login", "/consent", "/client", "/client/chat", "/client/lead"].includes(route));

    internalRoutes.forEach((route) => {
      expect(canAccessRoute("public", route)).toBe(false);
    });
  });

  it("keeps client routes separated from internal roles", () => {
    ["/client", "/client/chat", "/client/lead"].forEach((route) => {
      expect(canAccessRoute("employee", route)).toBe(false);
      expect(canAccessRoute("manager", route)).toBe(false);
      expect(canAccessRoute("admin", route)).toBe(false);
      expect(canAccessRoute("client", route)).toBe(true);
    });
  });

  it("matches the documented permissions for every product role", () => {
    Object.entries(expectedPermissions).forEach(([role, expectedRolePermissions]) => {
      expect(permissions[role as Exclude<Role, "public">]).toEqual(expectedRolePermissions);
    });
  });

  it("checks permissions by role", () => {
    expect(roleHasPermission("employee", "training:create:self")).toBe(true);
    expect(roleHasPermission("manager", "team:read:organization")).toBe(true);
    expect(roleHasPermission("admin", "settings:update")).toBe(true);
    expect(roleHasPermission("client", "client_lead:create")).toBe(true);
    expect(roleHasPermission("employee", "settings:update")).toBe(false);
    expect(roleHasPermission("public", "profile:read:self")).toBe(false);
  });

  it.each(apiAccessCases)("checks API permissions for $method $path", ({ method, path, allowed }) => {
    roles.forEach((role) => {
      expect(canAccessApi(role, method, path)).toBe((allowed as readonly Role[]).includes(role));
    });
  });

  it("matches dynamic API policies before parent routes", () => {
    expect(findApiAccessPolicy("GET", "/api/analytics/manager/employees/2")?.path).toBe(
      "/api/analytics/manager/employees/:id",
    );
    expect(findApiAccessPolicy("GET", "/api/analytics/manager/employees/2")?.permission).toBe(
      "employee:read:organization",
    );
  });

  it("does not duplicate API permission policies", () => {
    const uniquePolicies = new Set(apiAccessPolicies.map((policy) => `${policy.method} ${policy.path}`));

    expect(uniquePolicies.size).toBe(apiAccessPolicies.length);
  });

  it("does not duplicate route policies", () => {
    const uniqueRoutes = new Set(accessRoutes.map((route) => route.path));

    expect(uniqueRoutes.size).toBe(accessRoutes.length);
  });
});
