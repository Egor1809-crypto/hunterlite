import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationDto } from "@/lib/api-contracts";
import { frontendApi } from "@/lib/frontend-api";

export const liveNotificationPollMs = 15_000;
export const notificationStreamUrl = "/api/notifications/stream";

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
{
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", "live"],
    queryFn: frontendApi.notifications,
    initialData,
    refetchInterval: liveNotificationPollMs,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    if (typeof EventSource === "undefined") return undefined;

    const events = new EventSource(notificationStreamUrl, { withCredentials: true });
    const handleSnapshot = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { notifications?: NotificationDto[] };

        if (Array.isArray(payload.notifications)) {
          queryClient.setQueryData<NotificationDto[]>(
            ["notifications", "live"],
            (current = []) => mergeNotifications(current, payload.notifications ?? []),
          );
        }
      } catch {
        queryClient.invalidateQueries({ queryKey: ["notifications", "live"] });
      }
    };

    events.addEventListener("notifications:snapshot", handleSnapshot);

    return () => {
      events.removeEventListener("notifications:snapshot", handleSnapshot);
      events.close();
    };
  }, [queryClient]);

  return query;
};
