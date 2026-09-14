import { trainingDay } from "./trainingDay";
export const DAILY_ENERGY = 25;
export const energyCacheKey = (userId: string) => `hunterlite_daily_energy:${userId}`;
export function readEnergyBalance(value: unknown, now = new Date()): number | null {
  if (!value || typeof value !== "object") return null;
  const energy = value as {date?: unknown; remaining?: unknown};
  if (energy.date !== trainingDay(now) || typeof energy.remaining !== "number" || !Number.isFinite(energy.remaining)) return null;
  return Math.max(0, Math.min(DAILY_ENERGY, energy.remaining));
}
