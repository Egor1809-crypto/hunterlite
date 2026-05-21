import { describe, expect, it, vi } from "vitest";
import {
  createAnalyticsPrismaDataSource,
  createBackendDataSource,
  demoFrontendApiDataSource,
  type AnalyticsPrismaClient,
} from "../../apps/api/src";

const topic = { id: "topic-1", title: "Имущество должника" };

const membership = {
  id: "membership-1",
  role: "employee",
  status: "active",
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  user: {
    id: "user-1",
    email: "a.petrova@hunterlite.ru",
    fullName: "Анна Петрова",
    status: "active",
    lastLoginAt: new Date("2026-05-15T08:00:00.000Z"),
  },
};

const createPrisma = (): AnalyticsPrismaClient => ({
  membership: {
    findMany: vi.fn(async () => [membership]),
  },
  weakTopic: {
    findMany: vi.fn(async () => [
      {
        id: "weak-1",
        errorsCount: 38,
        recommendation: "Повторить блок про ипотечное жильё",
        topic,
      },
    ]),
  },
  trainingSession: {
    findMany: vi.fn(async () => [
      {
        id: "session-1",
        userId: "user-1",
        mode: "talk",
        score: 84,
        status: "completed",
        startedAt: new Date("2026-04-27T09:00:00.000Z"),
        completedAt: new Date("2026-04-27T09:25:00.000Z"),
        topic: { id: "topic-2", title: "Возражения клиента" },
      },
    ]),
  },
  examAttempt: {
    findMany: vi.fn(async () => [
      {
        id: "exam-1",
        userId: "user-1",
        score: 76,
        status: "passed",
        startedAt: new Date("2026-04-28T09:00:00.000Z"),
        completedAt: new Date("2026-04-28T09:40:00.000Z"),
        topic,
      },
    ]),
  },
  trainingTopic: {
    findMany: vi.fn(async () => [topic]),
  },
  trainingMessage: {
    findMany: vi.fn(async () => []),
  },
});

describe("analytics Prisma data source", () => {
  it("builds dashboard summary from Prisma analytics records", async () => {
    const source = createAnalyticsPrismaDataSource(createPrisma(), demoFrontendApiDataSource);

    await expect(source.getDashboardSummary("employee")).resolves.toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          id: "user-1",
          name: "Анна Петрова",
          avgScore: 80,
          weeklyTrainings: 1,
        }),
        weakTopics: [
          {
            id: "weak-1",
            topic: "Имущество должника",
            errors: 38,
            recommendation: "Повторить блок про ипотечное жильё",
          },
        ],
      }),
    );
  });

  it("builds manager summary from employee scores and weak topics", async () => {
    const source = createAnalyticsPrismaDataSource(createPrisma(), demoFrontendApiDataSource);

    await expect(source.getManagerSummary()).resolves.toEqual(
      expect.objectContaining({
        employees: [
          expect.objectContaining({
            id: "user-1",
            name: "Анна Петрова",
            score: 80,
            exam: "Сдан",
            status: "Допущен",
            weak: "Имущество должника",
            lastActive: "Сегодня",
          }),
        ],
        kpi: expect.objectContaining({
          totalEmployees: 1,
          allowedEmployees: 1,
          avgScore: 80,
          weeklyExams: 1,
          weakestTopic: "Имущество",
        }),
        topWeakTopics: [{ topic: "Имущество должника", errors: 38 }],
      }),
    );
  });

  it("builds employee profile from Prisma analytics records", async () => {
    const source = createAnalyticsPrismaDataSource(createPrisma(), demoFrontendApiDataSource);

    await expect(source.getEmployeeProfile("user-1")).resolves.toEqual(
      expect.objectContaining({
        employee: expect.objectContaining({
          id: "user-1",
          score: 80,
        }),
        history: expect.arrayContaining([
          expect.objectContaining({
            id: "session-1",
            mode: "Тренировка",
            topic: "Возражения клиента",
            score: 84,
          }),
          expect.objectContaining({
            id: "exam-1",
            mode: "Экзамен",
            topic: "Имущество должника",
            score: 76,
          }),
        ]),
        weakTopics: [{ id: "weak-1", topic: "Имущество должника", errors: 38, recommendation: "Повторить блок про ипотечное жильё" }],
      }),
    );
  });

  it("plugs analytics Prisma methods into the shared backend data source", async () => {
    const source = createBackendDataSource({
      prisma: {
        ...createPrisma(),
        membership: {
          findFirst: vi.fn(async () => null),
          findMany: vi.fn(async () => [membership]),
        },
        notification: {
          findMany: vi.fn(async () => []),
        },
      },
    });

    await expect(source.getManagerSummary()).resolves.toEqual(
      expect.objectContaining({
        kpi: expect.objectContaining({ avgScore: 80 }),
      }),
    );
  });
});
