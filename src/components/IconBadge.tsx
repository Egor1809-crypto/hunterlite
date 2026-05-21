import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type IconBadgeProps = {
  icon: LucideIcon;
  className?: string;
};

export function IconBadge({ icon: Icon, className }: IconBadgeProps) {
  return (
    <div
      className={cn(
        "h-11 w-11 rounded-xl bg-gradient-ai flex items-center justify-center text-white shadow-card shrink-0",
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}
