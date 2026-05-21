import { describe, expect, it, vi } from "vitest";
import {
  createBackendDataSource,
  createTrainingsPrismaDataSource,
  demoFrontendApiDataSource,
  type TrainingsPrismaClient,
} from "../../apps/api/src";

const topic = { id: "topic-1", title: "Имущество должника" };

const createPrisma = (
  overrides: Partial<{
    weakTopics: Awaited<ReturnType<TrainingsPrismaClient["weakTopic"]["findMany"]>>;
    sessions: Awaited<ReturnType<TrainingsPrismaClient["trainingSession"]["findMany"]>>;
    exams: Awaited<ReturnType<TrainingsPrismaClient["examAttempt"]["findMany"]>>;
    topics: Awaited<ReturnType<TrainingsPrismaClient["trainingTopic"]["findMany"]>>;
    messages: Awaited<ReturnType<TrainingsPrismaClient["trainingMessage"]["findMany"]>>;
  }> = {},
): TrainingsPrismaClient => ({
  membership: {
    findFirst: vi.fn(async () => ({ organizationId: "org-1", userId: "user-1" })),
  },
  weakTopic: {
    findMany: vi.fn(async () => overrides.weakTopics ?? []),
  },
  trainingSession: {
    findMany: vi.fn(async () => overrides.sessions ?? []),
    create: vi.fn(async ({ data }) => ({
      id: "session-1",
      userId: data.userId,
      topicId: data.topicId,
      mode: data.mode,
      difficulty: data.difficulty,
      format: data.format,
      character: data.character,
      questionCount: data.questionCount,
      score: null,
      status: data.status,
      startedAt: data.startedAt,
      completedAt: null,
      topic,
    })),
    findUnique: vi.fn(async ({ where }) => ({
      id: where.id,
      userId: "user-1",
      topicId: "topic-1",
      mode: "talk",
      difficulty: "medium",
      format: "text",
      character: "anxious",
      questionCount: 50,
      score: null,
      status: "active",
      startedAt: new Date("2026-05-16T08:00:00.000Z"),
      completedAt: null,
      evaluationCriteria: [],
      mistakes: [],
      recommendations: [],
      topic,
      messages: [],
    })),
    update: vi.fn(async ({ where, data }) => ({
      id: where.id,
      userId: "user-1",
      mode: "talk",
      score: data.score ?? null,
      status: data.status ?? "completed",
      startedAt: new Date("2026-05-16T08:00:00.000Z"),
      completedAt: data.completedAt ?? null,
      topic,
    })),
  },
  examAttempt: {
    findMany: vi.fn(async () => overrides.exams ?? []),
  },
  trainingTopic: {
    findMany: vi.fn(async () => overrides.topics ?? []),
    findFirst: vi.fn(async () => ({ ...topic, organizationId: "org-1" })),
  },
  trainingMessage: {
    findMany: vi.fn(async () => overrides.messages ?? []),
    create: vi.fn(async ({ data }) => ({
      id: "message-1",
      trainingSessionId: data.trainingSessionId,
      sender: data.sender,
      content: data.content,
      createdAt: new Date("2026-05-16T08:01:00.000Z"),
    })),
  },
});

describe("trainings Prisma data source", () => {
  it("maps weak topics from Prisma records", async () => {
    const source = createTrainingsPrismaDataSource(
      createPrisma({
        weakTopics: [
          {
            id: "weak-1",
            errorsCount: 38,
            recommendation: "Повторить блок про ипотечное жильё",
            topic,
          },
        ],
      }),
      demoFrontendApiDataSource,
    );

    await expect(source.getWeakTopics()).resolves.toEqual([
      {
        id: "weak-1",
        topic: "Имущество должника",
        errors: 38,
        recommendation: "Повторить блок про ипотечное жильё",
      },
    ]);
  });

  it("combines training sessions and exams into a sorted history DTO", async () => {
    const prisma = createPrisma({
        sessions: [
          {
            id: "session-1",
            mode: "talk",
            score: 84,
            status: "completed",
            startedAt: new Date("2026-04-27T09:00:00.000Z"),
            completedAt: new Date("2026-04-27T09:25:00.000Z"),
            topic: { id: "topic-2", title: "Возражения клиента" },
          },
        ],
        exams: [
          {
            id: "exam-1",
            score: 76,
            status: "passed",
            startedAt: new Date("2026-04-28T09:00:00.000Z"),
            completedAt: new Date("2026-04-28T09:40:00.000Z"),
            topic,
          },
        ],
      });
    const source = createTrainingsPrismaDataSource(
      prisma,
      demoFrontendApiDataSource,
    );

    await expect(source.getTrainingHistory("user-1")).resolves.toEqual([
      {
        id: "exam-1",
        date: "28.04.2026",
        mode: "Экзамен",
        topic: "Имущество должника",
        score: 76,
        status: "Сдан",
      },
      {
        id: "session-1",
        date: "27.04.2026",
        mode: "Тренировка",
        topic: "Возражения клиента",
        score: 84,
        status: "Завершено",
      },
    ]);
    expect(prisma.trainingSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      }),
    );
    expect(prisma.examAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      }),
    );
  });

  it("uses active Prisma topics while keeping static session option sets", async () => {
    const source = createTrainingsPrismaDataSource(
      createPrisma({
        topics: [
          { id: "topic-1", title: "Имущество должника" },
          { id: "topic-2", title: "Возражения клиента" },
        ],
      }),
      demoFrontendApiDataSource,
    );

    await expect(source.getSessionOptions()).resolves.toEqual(
      expect.objectContaining({
        topics: ["Имущество должника", "Возражения клиента"],
        difficulties: expect.arrayContaining(["Средний"]),
        formats: expect.arrayContaining(["Текст"]),
      }),
    );
  });

  it("maps training messages into dialog script entries", async () => {
    const source = createTrainingsPrismaDataSource(
      createPrisma({
        messages: [
          { sender: "ai", content: "Здравствуйте.", createdAt: new Date("2026-04-27T09:00:00.000Z") },
          { sender: "user", content: "Добрый день.", createdAt: new Date("2026-04-27T09:01:00.000Z") },
          { sender: "system", content: "ignored", createdAt: new Date("2026-04-27T09:02:00.000Z") },
        ],
      }),
      demoFrontendApiDataSource,
    );

    await expect(source.getDialogScript()).resolves.toEqual([
      { from: "ai", text: "Здравствуйте." },
      { from: "user", text: "Добрый день." },
    ]);
  });

  it("creates training sessions with normalized question counts", async () => {
    const prisma = createPrisma();
    const source = createTrainingsPrismaDataSource(prisma, demoFrontendApiDataSource);

    await expect(source.createTrainingSession("user-1", {
      topic: "Имущество должника",
      mode: "exam",
      difficulty: "hard",
      format: "sequence",
      character: "skeptical",
      questionCount: 150,
    })).resolves.toEqual({
      id: "session-1",
      topic: "Имущество должника",
      mode: "exam",
      difficulty: "hard",
      format: "sequence",
      character: "skeptical",
      questionCount: 100,
      status: "active",
    });
    expect(prisma.trainingSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mode: "exam_prep",
          questionCount: 100,
        }),
      }),
    );
  });

  it("saves training messages for the current user's session", async () => {
    const prisma = createPrisma();
    const source = createTrainingsPrismaDataSource(prisma, demoFrontendApiDataSource);

    await expect(source.addTrainingMessage("user-1", "session-1", {
      from: "user",
      text: "Добрый день.",
    })).resolves.toEqual({
      id: "message-1",
      sessionId: "session-1",
      from: "user",
      text: "Добрый день.",
    });
    expect(prisma.trainingMessage.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        trainingSessionId: "session-1",
        sender: "user",
        content: "Добрый день.",
      },
    });
  });

  it("returns a completed training session detail only for its owner", async () => {
    const prisma = createPrisma();
    const findUnique = vi.fn(async () => ({
      id: "session-1",
      userId: "user-1",
      topicId: "topic-1",
      mode: "chat_test",
      difficulty: "medium",
      format: "text",
      character: "anxious",
      questionCount: 50,
      score: 91,
      status: "completed",
      startedAt: new Date("2026-05-16T08:00:00.000Z"),
      completedAt: new Date("2026-05-16T08:10:00.000Z"),
      evaluationCriteria: [{ criterion: "legal_accuracy", score: 91, comment: "Точно." }],
      mistakes: ["Ошибок не обнаружено"],
      recommendations: ["Отличная работа"],
      topic,
      messages: [
        {
          id: "message-ai",
          trainingSessionId: "session-1",
          sender: "ai",
          content: "Здравствуйте.",
          createdAt: new Date("2026-05-16T08:01:00.000Z"),
        },
        {
          id: "message-user",
          trainingSessionId: "session-1",
          sender: "user",
          content: "Добрый день.",
          createdAt: new Date("2026-05-16T08:02:00.000Z"),
        },
      ],
    }));
    prisma.trainingSession.findUnique = findUnique;
    const source = createTrainingsPrismaDataSource(prisma, demoFrontendApiDataSource);

    await expect(source.getTrainingSessionDetail("user-1", "session-1")).resolves.toEqual({
      id: "session-1",
      date: "16.05.2026",
      mode: "Чат-тест",
      topic: "Имущество должника",
      score: 91,
      status: "Завершено",
      criteria: [{ criterion: "legal_accuracy", score: 91, comment: "Точно." }],
      mistakes: ["Ошибок не обнаружено"],
      recommendations: ["Отличная работа"],
      messages: [
        { id: "message-ai", sessionId: "session-1", from: "ai", text: "Здравствуйте." },
        { id: "message-user", sessionId: "session-1", from: "user", text: "Добрый день." },
      ],
    });
    await expect(source.getTrainingSessionDetail("other-user", "session-1")).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "session-1" },
      include: {
        topic: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  });

  it("completes training sessions with result details", async () => {
    const prisma = createPrisma();
    const source = createTrainingsPrismaDataSource(prisma, demoFrontendApiDataSource);

    await expect(source.completeTrainingSession("user-1", "session-1", {
      score: 69,
      criteria: [{ criterion: "legal_accuracy", score: 69, comment: "Есть неточности." }],
      mistakes: ["Ошибка в сроках."],
      recommendations: ["Повторить процедуру и сроки."],
    })).resolves.toEqual({
      id: "session-1",
      score: 69,
      passed: false,
      status: "failed",
    });
    expect(prisma.trainingSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 69,
          status: "failed",
          mistakes: ["Ошибка в сроках."],
          recommendations: ["Повторить процедуру и сроки."],
        }),
      }),
    );
  });

  it("falls back to demo training data when Prisma has no records", async () => {
    const source = createTrainingsPrismaDataSource(createPrisma(), demoFrontendApiDataSource);

    await expect(source.getWeakTopics()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ topic: "Имущество должника" })]),
    );
    await expect(source.getTrainingHistory()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ mode: "Экзамен" })]),
    );
  });

  it("plugs training Prisma methods into the shared backend data source", async () => {
    const source = createBackendDataSource({
      prisma: {
        membership: {
          findFirst: vi.fn(async () => null),
        },
        ...createPrisma({
          topics: [{ id: "topic-1", title: "Имущество должника" }],
        }),
      },
    });

    await expect(source.getSessionOptions()).resolves.toEqual(
      expect.objectContaining({
        topics: ["Имущество должника"],
      }),
    );
  });
});
