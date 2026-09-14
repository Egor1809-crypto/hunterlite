/** Shared data only: stores must not import the entire authenticated UI. */
export const consentCache = { checked: false, ok: false, userToken: null as string | null };
export function resetConsentCache() {
  consentCache.checked = false;
  consentCache.ok = false;
  consentCache.userToken = null;
}
