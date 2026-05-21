import { describe, expect, it, vi } from "vitest";
import {
  createBackendDataSource,
  createUsersPrismaDataSource,
  demoFrontendApiDataSource,
  type UsersPrismaClient,
} from "../../apps/api/src";

const createPrisma = (record: Awaited<ReturnType<UsersPrismaClient["membership"]["findFirst"]>>): UsersPrismaClient => ({
  membership: {
    findFirst: vi.fn(async () => record),
  },
});

describe("users Prisma data source", () => {
  it("maps Prisma users and memberships to current user DTOs", async () => {
    const prisma = createPrisma({
      role: "manager",
      status: "active",
      user: {
        id: "user-2",
        email: "manager@hunterlite.ru",
        fullName: "Ольга Литвинова",
        status: "active",
      },
    });
    const source = createUsersPrismaDataSource(prisma, demoFrontendApiDataSource);

    await expect(source.getCurrentUser("manager")).resolves.toEqual({
      id: "user-2",
      name: "Ольга Литвинова",
      firstName: "Ольга",
      role: "manager",
      roleLabel: "Руководитель",
      email: "manager@hunterlite.ru",
      status: "Допущен",
      avgScore: 88,
      examPassed: true,
      weeklyTrainings: 0,
    });
    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: "manager",
          user: { email: "manager@hunterlite.ru" },
        },
        include: { user: true },
      }),
    );
  });

  it("falls back to demo user data when the database has no matching membership", async () => {
    const source = createUsersPrismaDataSource(createPrisma(null), demoFrontendApiDataSource);

    await expect(source.getCurrentUser("employee")).resolves.toEqual(
      expect.objectContaining({
        id: "employee",
        name: "Анна Петрова",
      }),
    );
  });

  it("builds the backend data source with Prisma-backed users and demo-backed modules", async () => {
    const source = createBackendDataSource({
      prisma: createPrisma({
        role: "admin",
        status: "active",
        user: {
          id: "user-3",
          email: "admin@hunterlite.ru",
          fullName: "Павел Громов",
          status: "active",
        },
      }),
    });

    await expect(source.getCurrentUser("admin")).resolves.toEqual(
      expect.objectContaining({
        id: "user-3",
        role: "admin",
      }),
    );
    expect(await source.getNotifications()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "daily-training" })]),
    );
  });

  it("builds profile summaries from Prisma-backed users and weak topics", async () => {
    const prisma = {
      ...createPrisma({
        role: "employee",
        status: "active",
        user: {
          id: "user-1",
          email: "a.petrova@hunterlite.ru",
          fullName: "Анна Петрова",
          status: "active",
        },
      }),
      weakTopic: {
        findMany: vi.fn(async () => [{
          id: "weak-1",
          errorsCount: 12,
          recommendation: "Повторить порядок реализации имущества.",
          topic: {
            id: "topic-1",
            title: "Имущество должника",
          },
        }]),
      },
    };
    const source = createBackendDataSource({ prisma });

    await expect(source.getProfileSummary("employee")).resolves.toEqual({
      user: expect.objectContaining({
        id: "user-1",
        role: "employee",
      }),
      weakTopics: [{
        id: "weak-1",
        topic: "Имущество должника",
        errors: 12,
        recommendation: "Повторить порядок реализации имущества.",
      }],
    });
    expect(prisma.weakTopic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { topic: true },
        orderBy: { errorsCount: "desc" },
      }),
    );
  });
});
