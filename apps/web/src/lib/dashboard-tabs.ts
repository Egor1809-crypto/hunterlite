/**
 * Pure helpers for the dashboard's URL-driven tab routing.
 */

export type TabId = "overview" | "team";

export const TAB_ALIASES: Readonly<Record<string, TabId>> = {
  analytics: "team",
  // Legacy tabs now removed — all resolve to "overview" via the fallback.
};

const KNOWN_TABS: ReadonlySet<TabId> = new Set(["overview", "team"]);

/**
 * Resolve a raw `?tab=…` query value to a renderable {@link TabId}.
 */
export function resolveTabParam(raw: string | null): TabId | null {
  if (raw === null || raw === "") return null;
  const aliased = TAB_ALIASES[raw] ?? raw;
  if ((KNOWN_TABS as Set<string>).has(aliased)) return aliased as TabId;
  return "overview";
}
