import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionCookieName } from "./auth-handlers";

export const csrfCookieName = "hunterlite_csrf";

let csrfSecret = process.env.HUNTERLITE_CSRF_SECRET ?? "hunterlite-local-csrf-secret";

export const configureCsrfSecret = (secret: string) => {
  csrfSecret = secret;
};

export const getCookieValue = (cookieHeader: string | undefined, name: string) => {
  const cookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie?.slice(name.length + 1);
};

const createCsrfToken = (sessionValue: string) =>
  createHmac("sha256", csrfSecret).update(sessionValue).digest("base64url");

export const createCsrfCookie = (cookieHeader: string) => {
  const sessionValue = getCookieValue(cookieHeader, sessionCookieName);

  if (!sessionValue) return undefined;

  return `${csrfCookieName}=${createCsrfToken(sessionValue)}; Path=/; SameSite=Lax; Max-Age=604800`;
};

export const createSecureCsrfCookie = (cookieHeader: string) => {
  const cookie = createCsrfCookie(cookieHeader);

  return cookie ? `${cookie}; Secure` : undefined;
};

export const clearCsrfCookie = (secure = false) =>
  `${csrfCookieName}=; Path=/; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;

export const hasSessionCookie = (cookieHeader?: string) =>
  Boolean(getCookieValue(cookieHeader, sessionCookieName));

export const verifyCsrfToken = (cookieHeader: string | undefined, token: string | undefined) => {
  const sessionValue = getCookieValue(cookieHeader, sessionCookieName);

  if (!sessionValue || !token) return false;

  const expected = Buffer.from(createCsrfToken(sessionValue));
  const received = Buffer.from(token);

  return expected.length === received.length && timingSafeEqual(expected, received);
};
