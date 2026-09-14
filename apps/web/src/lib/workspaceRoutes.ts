const sections = new Set(["home", "training", "cases", "exam", "certificate", "courses", "history", "knowledge", "settings", "results", "dashboard", "pvp"]);
export function usesWorkspace(pathname: string, signedIn = false): boolean {
  if (/^\/training\/[^/]+\/call\/?$/.test(pathname)) return false;
  if (pathname.startsWith("/exam/certificate/verify/")) return false;
  if (pathname === "/championship") return signedIn;
  return sections.has(pathname.split("/")[1]);
}

export function isFocusedWorkspace(pathname: string): boolean {
  return /^\/training\/[^/]+\/?$/.test(pathname) || /^\/pvp\/quiz\/[^/]+\/?$/.test(pathname);
}
