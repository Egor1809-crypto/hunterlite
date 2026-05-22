import { useQuery } from "@tanstack/react-query";
import type { NotificationDto } from "@/lib/api-contracts";
import { frontendApi } from "@/lib/frontend-api";

export const liveNotificationPollMs = 15_000;

export const mergeNotifications = (
  current: readonly NotificationDto[],
  incoming: readonly NotificationDto[],
) => {
  const byId = new Map<string, NotificationDto>();

  [...incoming, ...current].forEach((notification) => {
    byId.set(notification.id, notification);
  });

  return Array.from(byId.values());
};

export const useLiveNotifications = (initialData: NotificationDto[] = []) =>
  useQuery({
    queryKey: ["notifications", "live"],
    queryFn: frontendApi.notifications,
    initialData,
    refetchInterval: liveNotificationPollMs,
    refetchOnWindowFocus: true,
    retry: false,
  });
