import type { Role } from "@/lib/access-control";

export type AppRole = Exclude<Role, "public">;

export type DemoUser = {
  name: string;
  firstName: string;
  role: AppRole;
  roleLabel: string;
  email: string;
  status: "Допущен" | "Активен";
};

const usersByRole: Record<AppRole, DemoUser> = {
  employee: {
    name: "Анна Петрова",
    firstName: "Анна",
    role: "employee",
    roleLabel: "Юрист-консультант",
    email: "a.petrova@hunterlite.ru",
    status: "Допущен",
  },
  manager: {
    name: "Ольга Литвинова",
    firstName: "Ольга",
    role: "manager",
    roleLabel: "Руководитель",
    email: "manager@hunterlite.ru",
    status: "Активен",
  },
  admin: {
    name: "Павел Громов",
    firstName: "Павел",
    role: "admin",
    roleLabel: "Администратор",
    email: "admin@hunterlite.ru",
    status: "Активен",
  },
  client: {
    name: "Клиент",
    firstName: "Клиент",
    role: "client",
    roleLabel: "Клиент",
    email: "client@hunterlite.ru",
    status: "Активен",
  },
};

let demoRole: AppRole = "employee";

export const getDemoRole = () => demoRole;

export const setDemoRole = (role: AppRole) => {
  demoRole = role;
};

export const getDemoUser = (role = demoRole) => usersByRole[role];

export const getRoleHome = (role: AppRole) => {
  if (role === "manager") return "/manager";
  if (role === "admin") return "/admin";
  if (role === "client") return "/client";
  return "/dashboard";
};

export const inferRoleFromEmail = (email: string): AppRole => {
  const normalized = email.trim().toLowerCase();

  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("manager") || normalized.includes("ruk")) return "manager";
  if (normalized.includes("client")) return "client";
  return "employee";
};
