import { Navigate, Outlet, useLocation } from "react-router-dom";
import { canAccessRoute } from "@/lib/access-control";
import { useDemoAuth } from "@/lib/demo-auth";
import { getRoleHome } from "@/lib/demo-auth-state";

export function ProtectedRoute() {
  const location = useLocation();
  const { user } = useDemoAuth();

  if (!canAccessRoute(user.role, location.pathname)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return <Outlet />;
}
