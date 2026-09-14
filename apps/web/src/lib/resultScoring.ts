export function resultScoringState(score: unknown, details: Record<string, unknown> | null | undefined) {
  if (details?._scoring_pending) return "pending";
  if (details?._scoring_unavailable) return "unavailable";
  return typeof score === "number" && Number.isFinite(score) ? "ready" : "pending";
}
