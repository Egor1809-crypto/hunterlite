import { AlertCircle, Database, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ApiStateProps = {
  isFetching?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  loadingText?: string;
  errorText?: string;
  emptyText?: string;
  className?: string;
};

export function ApiState({
  isFetching,
  isError,
  isEmpty,
  loadingText = "Обновляем данные...",
  errorText = "Не удалось получить данные с сервера. Показали резервные данные.",
  emptyText = "Пока нет данных для отображения.",
  className,
}: ApiStateProps) {
  const state = isError
    ? { icon: AlertCircle, text: errorText, className: "border-destructive/25 bg-destructive-soft text-destructive-soft-foreground" }
    : isFetching
      ? { icon: Loader2, text: loadingText, className: "border-info/20 bg-info-soft text-info-soft-foreground" }
      : isEmpty
        ? { icon: Database, text: emptyText, className: "border-border bg-card text-muted-foreground" }
        : null;

  if (!state) return null;

  const Icon = state.icon;

  return (
    <div className={cn("mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium", state.className, className)}>
      <Icon className={cn("h-4 w-4 shrink-0", isFetching && !isError ? "animate-spin" : "")} />
      <span>{state.text}</span>
    </div>
  );
}
