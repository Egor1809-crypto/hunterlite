/**
 * Championship (чемпионат-розыгрыш) API types + fetch helpers.
 * Mirrors apps/api/app/api/championship.py.
 */
import { api } from "@/lib/api";

export type SeasonType = "winter_spring" | "summer_autumn";
export type ChampionshipStatus = "upcoming" | "active" | "tallying" | "finished";
export type WinnerMode = "draw" | "ranking";

export interface PrizeItem {
  rank: number;
  name: string;
  value?: number;
  image?: string;
}

export interface Championship {
  id: string;
  number: number;
  season_type: SeasonType;
  title: string;
  starts_at: string;
  tally_starts_at: string;
  ends_at: string;
  status: ChampionshipStatus;
  winner_mode: WinnerMode;
  prize_fund: PrizeItem[] | null;
}

export interface CurrentChampionship {
  championship: Championship | null;
  qualified_count: number;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  status: string;
}

export interface WinnerRow {
  championship_number: number;
  season_type: SeasonType;
  rank: number;
  prize: string;
  name: string;
}

export interface MyEntry {
  enrolled: boolean;
  status: string | null;
  score: number;
  criteria: Record<string, boolean | null>;
}

export const championshipApi = {
  current: (opts?: { signal?: AbortSignal }) =>
    api.get<CurrentChampionship>("/championship/current", opts),
  leaderboard: (id: string, opts?: { signal?: AbortSignal }) =>
    api.get<LeaderboardRow[]>(`/championship/${id}/leaderboard`, opts),
  winners: (opts?: { signal?: AbortSignal }) =>
    api.get<WinnerRow[]>("/championship/winners", opts),
  me: (opts?: { signal?: AbortSignal }) => api.get<MyEntry>("/championship/me", opts),
  enroll: () => api.post<MyEntry>("/championship/enroll", {}),
};

/** Russian season label, e.g. "Лето–Осень". */
export function seasonLabel(t: SeasonType): string {
  return t === "winter_spring" ? "Зима–Весна" : "Лето–Осень";
}
