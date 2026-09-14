export function loginDestination(mustChangePassword: boolean, redirect?: string | null): string {
  if (mustChangePassword) return "/change-password";
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//") || /[\\\r\n]/.test(redirect)) return "/home";
  try {
    const url = new URL(redirect, "https://legalhunter.pro");
    if (url.origin !== "https://legalhunter.pro" || ["/login", "/register", "/auth/callback"].includes(url.pathname)) return "/home";
    return url.pathname + url.search + url.hash;
  } catch { return "/home"; }
}
