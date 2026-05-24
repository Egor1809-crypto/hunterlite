import * as React from "react";
import {
  clearAuth,
  getRole,
  isAuthenticated,
  setRole as storeRole,
  type AppRole,
} from "@/lib/demo-auth-state";

type AuthContextValue = {
  role: AppRole;
  authenticated: boolean;
  setRole: (role: AppRole) => void;
  logout: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<AppRole>(() => getRole());
  const [authed, setAuthed] = React.useState(() => isAuthenticated());

  const setRole = React.useCallback((nextRole: AppRole) => {
    storeRole(nextRole);
    setRoleState(nextRole);
    setAuthed(true);
  }, []);

  const logout = React.useCallback(() => {
    clearAuth();
    setRoleState("employee");
    setAuthed(false);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      role,
      authenticated: authed,
      setRole,
      logout,
    }),
    [authed, logout, role, setRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useDemoAuth = () => {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error("useDemoAuth must be used within DemoAuthProvider");
  }

  return context;
};
