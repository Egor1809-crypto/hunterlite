import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, Volume2 } from "lucide-react";

type ArenaShellProps = {
  title: string;
  subtitle: string;
  round: number;
  totalRounds: number;
  timeLeftSec: number;
  score: number;
  streak: number;
  onExit: () => void;
  scoreboard: ReactNode;
  hud: ReactNode;
  main: ReactNode;
  footer: ReactNode;
};

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function ArenaShell({
  title,
  subtitle,
  round,
  totalRounds,
  timeLeftSec,
  score,
  streak,
  onExit,
  scoreboard,
  hud,
  main,
  footer,
}: ArenaShellProps) {
  const dangerTime = timeLeftSec <= 10;

  return (
    <div className="min-h-screen bg-[hsl(262_34%_8%)] text-white overflow-hidden">
      <header className="h-20 border-b border-white/10 bg-white/[0.03] px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-3 text-white/75 hover:text-white hover:bg-white/10"
            onClick={onExit}
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Выйти
          </Button>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-violet-200/80 font-bold">{subtitle}</div>
            <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight text-white">{title}</h1>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="rounded-full border border-violet-300/25 bg-violet-300/10 px-4 py-1.5 text-sm font-bold">
            Раунд <span className="tabular-nums">{round}/{totalRounds}</span>
          </div>
          <div className={cn("text-pixel-inline text-lg tabular-nums", dangerTime && "text-destructive animate-pulse")}>
            {formatTime(timeLeftSec)}
          </div>
          <Button type="button" variant="ghost" size="icon" className="text-white/75 hover:text-white hover:bg-white/10">
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-5rem)] grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="hidden lg:block border-r border-white/10 bg-white/[0.025] p-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/45 font-bold">Счёт</div>
              <div className="text-pixel-number text-3xl tabular-nums mt-1">{score}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/45 font-bold">Серия</div>
              <div className="text-pixel-number text-3xl tabular-nums mt-1">{streak}</div>
            </div>
          </div>
          {scoreboard}
        </aside>

        <main className="relative overflow-y-auto p-4 md:p-6">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-violet-500/10 to-transparent pointer-events-none" />
          <div className="relative max-w-4xl mx-auto">{main}</div>
        </main>

        <aside className="hidden lg:block border-l border-white/10 bg-white/[0.025] p-4 overflow-y-auto">
          {hud}
        </aside>

        <div className="lg:col-span-3 border-t border-white/10 bg-[hsl(262_34%_10%)] p-3 md:p-4">
          {footer}
        </div>
      </div>
    </div>
  );
}
