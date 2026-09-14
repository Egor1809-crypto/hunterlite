"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import AppShell from "./AppShell";
import { WorkspaceContext } from "./WorkspaceContext";
import { usesWorkspace } from "@/lib/workspaceRoutes";

/** Lives above the router's page slot, so navigation never remounts the shell. */
export default function WorkspaceFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore(s => s.user);
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    setHasSession(document.cookie.includes("vh_authenticated="));
  }, [pathname, user]);
  if (!usesWorkspace(pathname, Boolean(user) || hasSession)) return children;
  return <WorkspaceContext.Provider value={true}><AppShell>{children}</AppShell></WorkspaceContext.Provider>;
}
