import * as React from "react";
import {
  getDemoRole,
  getDemoUser,
  inferRoleFromEmail,
  setDemoRole,
  type AppRole,
  type DemoUser,
} from "@/lib/demo-auth-state";

type DemoAuthContextValue = {
  user: DemoUser;
  setRole: (role: AppRole) => void;
  loginWithEmail: (email: string) => DemoUser;
  logout: () => void;
};

const DemoAuthContext = React.createContext<DemoAuthContextValue | null>(null);

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<AppRole>(() => getDemoRole());

  const setRole = React.useCallback((nextRole: AppRole) => {
    setDemoRole(nextRole);
    setRoleState(nextRole);
  }, []);

  const loginWithEmail = React.useCallback(
    (email: string) => {
      const nextRole = inferRoleFromEmail(email);
      setRole(nextRole);
      return getDemoUser(nextRole);
    },
    [setRole],
  );

  const logout = React.useCallback(() => {
    setRole("employee");
  }, [setRole]);

  const value = React.useMemo<DemoAuthContextValue>(
    () => ({
      user: getDemoUser(role),
      setRole,
      loginWithEmail,
      logout,
    }),
    [loginWithEmail, logout, role, setRole],
  );

  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

export const useDemoAuth = () => {
  const context = React.useContext(DemoAuthContext);

  if (!context) {
    throw new Error("useDemoAuth must be used within DemoAuthProvider");
  }

  return context;
};
