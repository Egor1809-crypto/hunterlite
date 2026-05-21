import { cn } from "@/lib/utils";

type Variant = "success" | "warning" | "destructive" | "info" | "ai" | "muted";

const styles: Record<Variant, string> = {
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  destructive: "bg-destructive-soft text-destructive-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  ai: "bg-ai-soft text-ai-soft-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  variant = "muted",
  children,
  className,
  dot = false,
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const dotColor: Record<Variant, string> = {
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    info: "bg-info",
    ai: "bg-ai",
    muted: "bg-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        styles[variant],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[variant])} />}
      {children}
    </span>
  );
}
