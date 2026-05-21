import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-ai/40 shadow-card",
        className,
      )}
    >
      <span className="font-display text-xl font-extrabold leading-none text-ai">X</span>
    </div>
  );
}
