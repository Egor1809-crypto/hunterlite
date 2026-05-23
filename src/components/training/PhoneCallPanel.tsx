import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Waves } from "lucide-react";

type PhoneCallPanelProps = {
  clientName: string;
  clientSituation: string;
  clientCharacter: string;
  elapsed: string;
  step: number;
  total: number;
  score: number;
  recording: boolean;
  speaking: boolean;
  voiceMode: boolean;
  autoListen: boolean;
  onToggleVoice: () => void;
  onToggleAutoListen: () => void;
  onHangup: () => void;
};

const stages = [
  "Контакт",
  "Проблема",
  "Имущество",
  "Риски",
  "Документы",
];

export function PhoneCallPanel({
  clientName,
  clientSituation,
  clientCharacter,
  elapsed,
  step,
  total,
  score,
  recording,
  speaking,
  voiceMode,
  autoListen,
  onToggleVoice,
  onToggleAutoListen,
  onHangup,
}: PhoneCallPanelProps) {
  const progress = total > 0 ? (Math.min(step, total) / total) * 100 : 0;

  return (
    <section className="border-b border-border bg-[hsl(262_34%_9%)] text-white">
      <div className="grid gap-4 px-4 py-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className={cn(
                  "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border",
                  speaking ? "border-emerald-300/60 bg-emerald-300/15" : "border-violet-300/30 bg-violet-300/10",
                )}
              >
                <span className="font-display text-xl font-bold">{clientName.slice(0, 1).toUpperCase()}</span>
                <span
                  className={cn(
                    "absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[hsl(262_34%_9%)]",
                    speaking ? "bg-emerald-300" : "bg-violet-300",
                  )}
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-violet-200/80 font-bold">Live call</div>
                <h2 className="font-display text-2xl font-bold leading-tight truncate">{clientName}</h2>
                <p className="mt-1 text-sm text-white/62 line-clamp-2">{clientSituation}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:w-[250px]">
              <div className="rounded-lg border border-white/10 bg-black/15 p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Время</div>
                <div className="text-pixel-inline mt-1 tabular-nums">{elapsed}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/15 p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Балл</div>
                <div className="text-pixel-inline mt-1 tabular-nums">{score}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/15 p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Этап</div>
                <div className="text-pixel-inline mt-1 tabular-nums">{Math.min(step + 1, total)}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-white/55">
                <span>Прогресс звонка</span>
                <span>{Math.min(step, total)} из {total}</span>
              </div>
              <Progress value={progress} className="h-1.5" />
              <div className="mt-3 flex flex-wrap gap-2">
                {stages.map((stage, index) => {
                  const active = index === Math.min(step, stages.length - 1);
                  const done = index < step;

                  return (
                    <span
                      key={stage}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-bold",
                        active && "border-violet-200/50 bg-violet-200/15 text-violet-50",
                        done && "border-emerald-200/40 bg-emerald-200/10 text-emerald-50",
                        !active && !done && "border-white/10 bg-white/[0.03] text-white/42",
                      )}
                    >
                      {stage}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className={cn("h-11 border border-white/10 text-white hover:bg-white/10", voiceMode && "bg-white/10")}
                onClick={onToggleVoice}
              >
                {voiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn("h-11 border border-white/10 text-white hover:bg-white/10", autoListen && "bg-emerald-300/15 text-emerald-50")}
                onClick={onToggleAutoListen}
                disabled={!voiceMode}
              >
                AUTO
              </Button>
              <Button type="button" variant="destructive" className="h-11" onClick={onHangup}>
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <aside className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Профиль клиента</div>
              <div className="mt-1 text-sm font-bold text-white/85">{clientCharacter}</div>
            </div>
            <div className={cn("rounded-full p-2", recording ? "bg-rose-300/15 text-rose-100" : "bg-violet-300/15 text-violet-100")}>
              {recording ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </div>
          </div>
          <div className="mt-4 flex h-14 items-center gap-1 overflow-hidden rounded-lg border border-white/10 bg-black/15 px-3">
            {Array.from({ length: 22 }, (_, index) => (
              <span
                key={index}
                className={cn("w-1 rounded-full bg-violet-200/45", (recording || speaking) && "animate-pulse")}
                style={{ height: `${12 + ((index * 7) % 30)}px`, animationDelay: `${index * 40}ms` }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
            <Waves className="h-3.5 w-3.5" />
            {recording ? "Записываем ваш ответ" : speaking ? "Клиент отвечает голосом" : "Ожидание реплики"}
          </div>
        </aside>
      </div>
    </section>
  );
}
