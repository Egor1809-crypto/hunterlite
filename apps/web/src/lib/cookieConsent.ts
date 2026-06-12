// 152-ФЗ / РКН: cookie-consent state. Technically-necessary cookies always run;
// analytics/marketing cookies must wait for an explicit "accept".
//
// Until the user chooses, ONLY essential cookies are allowed. We persist the
// decision in localStorage AND a first-party cookie so the server/edge can read
// it too. Any future analytics (Яндекс.Метрика / VK Pixel) MUST gate on
// `hasAnalyticsConsent()` before loading.

export type ConsentValue = "accepted" | "rejected";

const LS_KEY = "lh_cookie_consent";
const COOKIE_KEY = "lh_cookie_consent";
export const CONSENT_EVENT = "lh-cookie-consent-change";

export function getConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === "accepted" || v === "rejected") return v;
  } catch {
    /* storage blocked */
  }
  return null;
}

export function setConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, value);
  } catch {
    /* ignore */
  }
  // First-party cookie, 1 year, SameSite=Lax. Readable by the server if needed.
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_KEY}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

/** True only when the user explicitly accepted non-essential cookies. */
export function hasAnalyticsConsent(): boolean {
  return getConsent() === "accepted";
}
