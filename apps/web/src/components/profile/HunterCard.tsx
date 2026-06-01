"use client";

/**
 * HunterCard — profile hero, unified "vibe" rebuild (2026).
 *
 * Was an arcade card: dark hardcoded gradient + 3px neon border + glow +
 * pixel grid + neon XP bar. That was dark-first (broke on light theme) and
 * long names/emails overflowed. Now frameless + token-based + hairline-only,
 * mono-lilac: ONE accent (var(--primary)) appears exactly 3× — the top line,
 * the avatar initials, the XP fill. Hierarchy by scale, not chrome.
 * Grounding: malvah (frameless, scale-not-weight, mono codes) + abstract
 * (one accent, hairline rules, restraint).
 */

import { motion } from "framer-motion";

interface HunterCardProps {
  user: { full_name: string; email: string; role: string };
  stats: { completed_sessions: number; avg_score: number | null; best_score: number | null } | null;
  gamification: {
    level: number;
    xp_current_level: number;
    xp_next_level: number;
    streak_days: number;
    total_xp: number;
  } | null;
  teamName?: string;
}

const ROLE_LABELS: Record<string, string> = {
  manager: "Менеджер",
  rop: "РОП",
  admin: "Администратор",
  methodologist: "РОП", // legacy enum — retired 2026-04-26, displays as ROP for stale tokens
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="shrink-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1 font-mono text-[30px] leading-none tabular-nums" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

export function HunterCard({ user, gamification, teamName }: HunterCardProps) {
  const level = gamification?.level ?? 1;
  const xpCurrent = gamification?.xp_current_level ?? 0;
  const xpNext = gamification?.xp_next_level ?? 100;
  const xpPct = xpNext > 0 ? Math.max(0, Math.min(100, Math.round((xpCurrent / xpNext) * 100))) : 0;
  const streakDays = gamification?.streak_days ?? 0;

  const initials = user.full_name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const role = ROLE_LABELS[user.role] ?? user.role;
  const subtitle = teamName ? `${role} · ${teamName}` : role;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="relative pt-5"
    >
      {/* the ONE accent: a single thin top line */}
      <div aria-hidden className="absolute left-0 top-0 h-0.5 w-10" style={{ background: "var(--primary)" }} />

      {/* identity row */}
      <div className="flex items-center gap-5">
        {/* avatar — no neon, just a hairline ring */}
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums"
          style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-color)",
            color: "var(--primary)",
            fontSize: 22,
            letterSpacing: "0.02em",
          }}
        >
          {initials}
        </div>

        {/* name + role/team — full overflow chain (min-w-0 + truncate + title) */}
        <div className="min-w-0 flex-1">
          <h2
            className="truncate font-semibold tracking-tight"
            style={{ color: "var(--text-primary)", fontSize: "clamp(20px, 3.2vw, 26px)", lineHeight: 1.12 }}
            title={user.full_name}
          >
            {user.full_name}
          </h2>
          <div
            className="mt-1 truncate font-mono text-[13px] uppercase tracking-[0.08em]"
            style={{ color: "var(--text-secondary)" }}
            title={subtitle}
          >
            {subtitle}
          </div>
        </div>
      </div>

      {/* stats — scale carries hierarchy; XP gets the one hairline bar */}
      <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-5">
        <Stat label="Уровень" value={level} />

        <div className="min-w-[180px] flex-1">
          <div className="flex items-baseline justify-between font-mono text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
            <span>
              {xpCurrent.toLocaleString("ru-RU")} / {xpNext.toLocaleString("ru-RU")} XP
            </span>
            <span style={{ color: "var(--text-primary)" }}>{xpPct}%</span>
          </div>
          <div className="mt-2 h-0.5 w-full overflow-hidden" style={{ background: "var(--border-color)" }}>
            <motion.div
              className="h-full"
              style={{ background: "var(--primary)" }}
              initial={{ width: 0 }}
              animate={{ width: `${xpPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        {streakDays > 0 && <Stat label="Дней подряд" value={streakDays} />}
      </div>
    </motion.div>
  );
}
