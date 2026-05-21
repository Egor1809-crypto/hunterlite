import { describe, expect, it, vi } from "vitest";
import {
  createBackendDataSource,
  createNotificationsPrismaDataSource,
  demoFrontendApiDataSource,
  type NotificationsPrismaClient,
} from "../../apps/api/src";

const createPrisma = (
  records: Awaited<ReturnType<NotificationsPrismaClient["notification"]["findMany"]>>,
): NotificationsPrismaClient => ({
  notification: {
    findMany: vi.fn(async () => records),
  },
});

describe("notifications Prisma data source", () => {
  it("maps Prisma notifications to frontend DTOs", async () => {
    const prisma = createPrisma([
      {
        id: "notification-1",
        type: "training",
        title: "Ежедневная тренировка",
        body: "Сегодня нужно пройти одну тренировку.",
        readAt: null,
        createdAt: new Date("2026-05-15T09:05:00.000Z"),
      },
      {
        id: "notification-2",
        type: "exam",
        title: "Назначен экзамен",
        body: "Аттестация по теме «Имущество должника».",
        readAt: new Date("2026-05-15T10:00:00.000Z"),
        createdAt: new Date("2026-05-14T12:30:00.000Z"),
      },
      {
        id: "notification-3",
        type: "recommendation",
        title: "Рекомендация AI",
        body: "Повторите слабую тему.",
        readAt: null,
        createdAt: new Date("2026-05-13T12:30:00.000Z"),
      },
    ]);
    const source = createNotificationsPrismaDataSource(prisma, demoFrontendApiDataSource);

    await expect(source.getNotifications()).resolves.toEqual([
      {
        id: "notification-1",
        title: "Ежедневная тренировка",
        body: "Сегодня нужно пройти одну тренировку.",
        time: "15.05, 13:05",
        tone: "info",
        unread: true,
        actionUrl: "/session/setup?mode=talk",
      },
      {
        id: "notification-2",
        title: "Назначен экзамен",
        body: "Аттестация по теме «Имущество должника».",
        time: "14.05, 16:30",
        tone: "warning",
        unread: false,
        actionUrl: "/session/setup?mode=exam",
      },
      {
        id: "notification-3",
        title: "Рекомендация AI",
        body: "Повторите слабую тему.",
        time: "13.05, 16:30",
        tone: "success",
        unread: true,
        actionUrl: "/weak-topics",
      },
    ]);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  it("falls back to demo notifications when Prisma has no records", async () => {
    const source = createNotificationsPrismaDataSource(createPrisma([]), demoFrontendApiDataSource);

    await expect(source.getNotifications()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "daily-training",
          title: "Ежедневная тренировка",
        }),
      ]),
    );
  });

  it("plugs notification Prisma methods into the shared backend data source", async () => {
    const source = createBackendDataSource({
      prisma: {
        membership: {
          findFirst: vi.fn(async () => null),
        },
        weakTopic: {
          findMany: vi.fn(async () => []),
        },
        trainingSession: {
          findMany: vi.fn(async () => []),
        },
        examAttempt: {
          findMany: vi.fn(async () => []),
        },
        trainingTopic: {
          findMany: vi.fn(async () => []),
        },
        trainingMessage: {
          findMany: vi.fn(async () => []),
        },
        ...createPrisma([
          {
            id: "notification-1",
            type: "system",
            title: "Системное сообщение",
            body: "Платформа обновлена.",
            readAt: null,
            createdAt: new Date("2026-05-15T09:05:00.000Z"),
          },
        ]),
      },
    });

    await expect(source.getNotifications()).resolves.toEqual([
      expect.objectContaining({
        id: "notification-1",
        tone: "info",
        actionUrl: "/notifications",
      }),
    ]);
  });
});
