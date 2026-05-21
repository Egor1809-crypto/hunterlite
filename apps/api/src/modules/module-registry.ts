export const backendModules = [
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
] as const;

export type BackendModuleName = (typeof backendModules)[number];

export type BackendModule = {
  name: BackendModuleName;
  ownsTables: readonly string[];
  exposesApiPrefix: string;
  requiresAuth: boolean;
};

export const moduleRegistry = [
  {
    name: "auth",
    ownsTables: ["auth_accounts", "sessions", "consents"],
    exposesApiPrefix: "/api/auth",
    requiresAuth: false,
  },
  {
    name: "users",
    ownsTables: ["users", "memberships"],
    exposesApiPrefix: "/api/users",
    requiresAuth: true,
  },
  {
    name: "organizations",
    ownsTables: ["organizations", "system_settings"],
    exposesApiPrefix: "/api/organizations",
    requiresAuth: true,
  },
  {
    name: "roles",
    ownsTables: ["memberships"],
    exposesApiPrefix: "/api/roles",
    requiresAuth: true,
  },
  {
    name: "trainings",
    ownsTables: ["training_topics", "training_sessions", "training_messages", "weak_topics"],
    exposesApiPrefix: "/api/trainings",
    requiresAuth: true,
  },
  {
    name: "exams",
    ownsTables: ["exam_attempts"],
    exposesApiPrefix: "/api/exams",
    requiresAuth: true,
  },
  {
    name: "notifications",
    ownsTables: ["notifications"],
    exposesApiPrefix: "/api/notifications",
    requiresAuth: true,
  },
  {
    name: "admin",
    ownsTables: ["audit_logs", "system_settings"],
    exposesApiPrefix: "/api/admin",
    requiresAuth: true,
  },
  {
    name: "analytics",
    ownsTables: ["training_sessions", "exam_attempts", "weak_topics"],
    exposesApiPrefix: "/api/analytics",
    requiresAuth: true,
  },
  {
    name: "ai",
    ownsTables: ["training_messages", "client_leads"],
    exposesApiPrefix: "/api/ai",
    requiresAuth: false,
  },
] as const satisfies readonly BackendModule[];

export const getBackendModule = (name: BackendModuleName) =>
  moduleRegistry.find((module) => module.name === name);
