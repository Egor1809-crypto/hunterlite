import type { Role } from "@/lib/access-control";

export type AppRole = Exclude<Role, "public">;

const AUTH_STORAGE_KEY = "hunterlite_auth_role";
const AUTH_FLAG_KEY = "hunterlite_authenticated";

const roleValues = new Set<AppRole>(["employee", "manager", "admin", "client"]);

const readStoredRole = (): AppRole => {
  try {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (stored && roleValues.has(stored as AppRole)) return stored as AppRole;
  } catch {}
  return "employee";
};

let currentRole: AppRole = readStoredRole();

export const getRole = () => currentRole;

export const isAuthenticated = (): boolean => {
  try {
    return sessionStorage.getItem(AUTH_FLAG_KEY) === "true";
  } catch {
    return false;
  }
};

export const setRole = (role: AppRole) => {
  currentRole = role;
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, role);
    sessionStorage.setItem(AUTH_FLAG_KEY, "true");
  } catch {}
};

export const clearAuth = () => {
  currentRole = "employee";
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_FLAG_KEY);
  } catch {}
};

export const getRoleHome = (role: AppRole) => {
  if (role === "manager") return "/manager";
  if (role === "admin") return "/admin";
  if (role === "client") return "/client";
  return "/dashboard";
};
