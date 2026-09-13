export function trainingDay(now = new Date()): string {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
export function untilMoscowMidnight(now = new Date()): number {
  const day = trainingDay(now);
  return new Date(`${day}T00:00:00+03:00`).getTime() + 86400000 - now.getTime();
}
export type AttemptBalance = {
  day: string;
  free_remaining: number;
  paid_remaining: number;
  expires_at: string;
  pack_size: number;
  price_kopecks: number;
  checkout_available: boolean;
  level_uses: Record<string, number>;
};
