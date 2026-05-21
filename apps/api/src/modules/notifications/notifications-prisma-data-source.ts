import type { NotificationDto, NotificationTone } from "@/lib/api-contracts";
import type { FrontendApiDataSource } from "../../routes/frontend-api-handlers";

type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationsPrismaClient = {
  notification: {
    findMany: (args: {
      orderBy: { createdAt: "asc" | "desc" };
      take?: number;
    }) => Promise<NotificationRecord[]>;
  };
};

const toneByType: Record<string, NotificationTone> = {
  training: "info",
  exam: "warning",
  recommendation: "success",
  system: "info",
};

const actionUrlByType: Record<string, string> = {
  training: "/session/setup?mode=talk",
  exam: "/session/setup?mode=exam",
  recommendation: "/weak-topics",
  system: "/notifications",
};

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Saratov",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const mapNotification = (record: NotificationRecord): NotificationDto => ({
  id: record.id,
  title: record.title,
  body: record.body,
  time: formatTime(record.createdAt),
  tone: toneByType[record.type] ?? "info",
  unread: !record.readAt,
  actionUrl: actionUrlByType[record.type] ?? "/notifications",
});

export const createNotificationsPrismaDataSource = (
  prisma: NotificationsPrismaClient,
  fallback: FrontendApiDataSource,
): Pick<FrontendApiDataSource, "getNotifications"> => ({
  getNotifications: async (): Promise<NotificationDto[]> => {
    try {
      const records = await prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return records.length ? records.map(mapNotification) : fallback.getNotifications();
    } catch {
      return fallback.getNotifications();
    }
  },
});
