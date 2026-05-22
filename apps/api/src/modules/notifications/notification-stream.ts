import type { NotificationDto } from "@/lib/api-contracts";

export const notificationStreamPath = "/api/notifications/stream";
export const notificationStreamIntervalMs = 15_000;

export const encodeSseEvent = (event: string, data: unknown) =>
  [
    `event: ${event}`,
    `data: ${JSON.stringify(data)}`,
    "",
    "",
  ].join("\n");

export const createNotificationSnapshotEvent = (notifications: NotificationDto[]) =>
  encodeSseEvent("notifications:snapshot", {
    notifications,
    sentAt: new Date().toISOString(),
  });

export const createNotificationHeartbeatEvent = () =>
  encodeSseEvent("notifications:heartbeat", {
    sentAt: new Date().toISOString(),
  });
