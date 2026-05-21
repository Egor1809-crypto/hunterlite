export const roles = ["public", "employee", "manager", "admin", "client"] as const;

export type Role = (typeof roles)[number];

export const permissions = {
  employee: [
    "profile:read:self",
    "profile:update:self",
    "training:create:self",
    "training:read:self",
    "training:complete:self",
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
    "audit_logs:read",
    "notifications:read:self",
    "notifications:update:self",
  ],
  client: [
    "client_chat:create",
    "client_lead:create",
  ],
  public: [],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof permissions)[Exclude<Role, "public">][number];

export type AccessRoute = {
  path: string;
  allowedRoles: readonly Role[];
};

export type ApiAccessPolicy = {
  method: "GET" | "POST";
  path: string;
  permission: Permission;
};

export const accessRoutes = [
  { path: "/login", allowedRoles: ["public", "employee", "manager", "admin"] },
  { path: "/consent", allowedRoles: ["public", "employee", "manager", "admin"] },
  { path: "/dashboard", allowedRoles: ["employee"] },
  { path: "/modes", allowedRoles: ["employee"] },
  { path: "/session/setup", allowedRoles: ["employee"] },
  { path: "/session/talk", allowedRoles: ["employee"] },
  { path: "/session/exam", allowedRoles: ["employee"] },
  { path: "/session/chat-test", allowedRoles: ["employee"] },
  { path: "/session/answer-review", allowedRoles: ["employee"] },
  { path: "/session/result", allowedRoles: ["employee"] },
  { path: "/remedial-course", allowedRoles: ["employee"] },
  { path: "/history", allowedRoles: ["employee"] },
  { path: "/weak-topics", allowedRoles: ["employee"] },
  { path: "/notifications", allowedRoles: ["employee", "manager", "admin"] },
  { path: "/profile", allowedRoles: ["employee", "manager", "admin"] },
  { path: "/manager", allowedRoles: ["manager"] },
  { path: "/manager/employee/:id", allowedRoles: ["manager"] },
  { path: "/manager/reports", allowedRoles: ["manager"] },
  { path: "/admin", allowedRoles: ["admin"] },
  { path: "/admin/users", allowedRoles: ["admin"] },
  { path: "/admin/settings", allowedRoles: ["admin"] },
  { path: "/admin/tests", allowedRoles: ["admin"] },
  { path: "/admin/cases", allowedRoles: ["admin"] },
  { path: "/admin/objections", allowedRoles: ["admin"] },
  { path: "/admin/scripts", allowedRoles: ["admin"] },
  { path: "/client", allowedRoles: ["public", "client"] },
  { path: "/client/chat", allowedRoles: ["public", "client"] },
  { path: "/client/lead", allowedRoles: ["public", "client"] },
] as const satisfies readonly AccessRoute[];

export const apiAccessPolicies = [
  { method: "GET", path: "/api/users/me", permission: "profile:read:self" },
  { method: "GET", path: "/api/users/profile", permission: "profile:read:self" },
  { method: "GET", path: "/api/notifications", permission: "notifications:read:self" },
  { method: "GET", path: "/api/trainings/weak-topics", permission: "weak_topics:read:self" },
  { method: "GET", path: "/api/trainings/history", permission: "history:read:self" },
  { method: "GET", path: "/api/trainings/session-options", permission: "training:create:self" },
  { method: "GET", path: "/api/trainings/dialog-script", permission: "training:read:self" },
  { method: "GET", path: "/api/trainings/call-scripts", permission: "training:read:self" },
  { method: "POST", path: "/api/trainings/sessions", permission: "training:create:self" },
  { method: "GET", path: "/api/trainings/sessions/:id", permission: "training:read:self" },
  { method: "POST", path: "/api/trainings/sessions/:id/messages", permission: "training:complete:self" },
  { method: "POST", path: "/api/trainings/sessions/:id/complete", permission: "training:complete:self" },
  { method: "GET", path: "/api/analytics/dashboard", permission: "training:read:self" },
  { method: "GET", path: "/api/analytics/manager", permission: "team:read:organization" },
  { method: "GET", path: "/api/analytics/manager/employees/:id", permission: "employee:read:organization" },
  { method: "GET", path: "/api/admin/users", permission: "users:read" },
  { method: "POST", path: "/api/admin/users", permission: "users:create" },
  { method: "POST", path: "/api/admin/users/:id", permission: "users:update" },
  { method: "GET", path: "/api/admin/tests", permission: "training_content:read" },
  { method: "POST", path: "/api/admin/tests", permission: "training_content:create" },
  { method: "GET", path: "/api/admin/cases", permission: "training_content:read" },
  { method: "POST", path: "/api/admin/cases", permission: "training_content:create" },
  { method: "GET", path: "/api/admin/objections", permission: "training_content:read" },
  { method: "POST", path: "/api/admin/objections", permission: "training_content:create" },
  { method: "GET", path: "/api/admin/call-scripts", permission: "training_content:read" },
  { method: "POST", path: "/api/admin/call-scripts", permission: "training_content:create" },
  { method: "POST", path: "/api/admin/call-scripts/:id", permission: "training_content:create" },
  { method: "POST", path: "/api/admin/call-scripts/:id/delete", permission: "training_content:create" },
] as const satisfies readonly ApiAccessPolicy[];

const normalizePath = (path: string) => {
  const withoutQuery = path.split(/[?#]/)[0] || "/";
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
};

const routeScore = (path: string) => path.split("/").filter(Boolean).length;

const matchesRoute = (pattern: string, pathname: string) => {
  const patternParts = normalizePath(pattern).split("/").filter(Boolean);
  const pathParts = normalizePath(pathname).split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return false;
  }

  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
};

export const findAccessRoute = (path: string) =>
  [...accessRoutes]
    .sort((left, right) => routeScore(right.path) - routeScore(left.path))
    .find((route) => matchesRoute(route.path, path));

export const findApiAccessPolicy = (method: ApiAccessPolicy["method"], path: string) =>
  [...apiAccessPolicies]
    .filter((policy) => policy.method === method)
    .sort((left, right) => routeScore(right.path) - routeScore(left.path))
    .find((policy) => matchesRoute(policy.path, path));

export const canAccessRoute = (role: Role, path: string) => {
  const route = findAccessRoute(path);
  return Boolean(route?.allowedRoles.includes(role));
};

export const roleHasPermission = (role: Role, permission: Permission) =>
  permissions[role].includes(permission);

export const canAccessApi = (role: Role, method: ApiAccessPolicy["method"], path: string) => {
  const policy = findApiAccessPolicy(method, path);
  return Boolean(policy && roleHasPermission(role, policy.permission));
};
