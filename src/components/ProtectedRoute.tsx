import { Navigate, Outlet, useLocation } from "react-router-dom";
import { canAccessRoute } from "@/lib/access-control";
import { useDemoAuth } from "@/lib/demo-auth";
import { getRoleHome } from "@/lib/demo-auth-state";

export function ProtectedRoute() {
  const location = useLocation();
  const { role, authenticated } = useDemoAuth();

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessRoute(role, location.pathname)) {
    return <Navigate to={getRoleHome(role)} replace />;
  }

  return <Outlet />;
}
