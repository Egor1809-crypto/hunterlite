import type {
  SessionOptionsDto,
  TrainingMessageCreateRequestDto,
  TrainingMessageCreatedDto,
  TrainingHistoryItemDto,
  TrainingSessionCompleteRequestDto,
  TrainingSessionCompletedDto,
  TrainingSessionCreateRequestDto,
  TrainingSessionCreatedDto,
  TrainingSessionDetailDto,
  WeakTopicDto,
} from "@/lib/api-contracts";
import { getMaxQuestionCount, isPassingScore, validateScore, type TrainingDifficulty } from "@/lib/training-logic";
import type { AppRole } from "@/lib/demo-auth-state";
import type { FrontendApiDataSource } from "../../routes/frontend-api-handlers";

type TopicRecord = {
  id: string;
  title: string;
  organizationId?: string;
};

type WeakTopicRecord = {
  id: string;
  errorsCount: number;
  recommendation: string;
  topic: TopicRecord;
};

type TrainingSessionRecord = {
  id: string;
  topicId?: string;
  difficulty?: string;
  format?: string;
  character?: string;
  questionCount?: number;
  userId?: string;
  mode: string;
  score: number | null;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  evaluationCriteria?: unknown;
  mistakes?: unknown;
  recommendations?: unknown;
  topic: TopicRecord;
  messages?: Array<TrainingMessageRecord & { id: string; trainingSessionId: string }>;
};

type MembershipRecord = {
  organizationId: string;
  userId: string;
};

type ExamAttemptRecord = {
  id: string;
  userId?: string;
  score: number | null;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  topic: TopicRecord;
};

type TrainingMessageRecord = {
  sender: string;
  content: string;
  createdAt: Date;
};

export type TrainingsPrismaClient = {
  membership?: {
    findFirst: (args: {
      where: { userId: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }) => Promise<MembershipRecord | null>;
  };
  weakTopic: {
    findMany: (args: {
      include: { topic: true };
      orderBy: { errorsCount: "asc" | "desc" };
      take?: number;
    }) => Promise<WeakTopicRecord[]>;
  };
  trainingSession: {
    findMany: (args: {
      where?: { userId?: string };
      include: { topic: true };
      orderBy: { startedAt: "asc" | "desc" };
      take?: number;
    }) => Promise<TrainingSessionRecord[]>;
    create?: (args: {
      data: {
        organizationId: string;
        userId: string;
        topicId: string;
        mode: "talk" | "exam_prep" | "chat_test";
        difficulty: "basic" | "medium" | "hard";
        format: string;
        character: string;
        questionCount: number;
        status: "active";
        startedAt: Date;
      };
      include: { topic: true };
    }) => Promise<TrainingSessionRecord>;
    findUnique?: (args: {
      where: { id: string };
      include?: { topic?: true; messages?: { orderBy: { createdAt: "asc" | "desc" } } };
    }) => Promise<(TrainingSessionRecord & { organizationId?: string }) | null>;
    update?: (args: {
      where: { id: string };
      data: {
        score?: number;
        status?: "completed" | "failed";
        completedAt?: Date;
        evaluationCriteria?: unknown;
        mistakes?: unknown;
        recommendations?: unknown;
      };
    }) => Promise<TrainingSessionRecord>;
  };
  examAttempt: {
    findMany: (args: {
      where?: { userId?: string };
      include: { topic: true };
      orderBy: { startedAt: "asc" | "desc" };
      take?: number;
    }) => Promise<ExamAttemptRecord[]>;
  };
  trainingTopic: {
    findMany: (args: {
      where: { isActive: true };
      orderBy: { createdAt: "asc" | "desc" };
    }) => Promise<TopicRecord[]>;
    findFirst?: (args: {
      where: { title: string; isActive: true };
    }) => Promise<TopicRecord | null>;
  };
  trainingMessage: {
    findMany: (args: {
      orderBy: { createdAt: "asc" | "desc" };
      take?: number;
    }) => Promise<TrainingMessageRecord[]>;
    create?: (args: {
      data: {
        organizationId: string;
        trainingSessionId: string;
        sender: "ai" | "user";
        content: string;
      };
    }) => Promise<TrainingMessageRecord & { id: string; trainingSessionId: string }>;
  };
};

const toPrismaMode = (mode: TrainingSessionCreateRequestDto["mode"]) =>
  mode === "exam" ? "exam_prep" : mode;

const fromPrismaMode = (mode: string): TrainingSessionCreatedDto["mode"] =>
  mode === "exam_prep" ? "exam" : mode === "chat_test" ? "chat_test" : "talk";

const normalizeQuestionCount = (difficulty: TrainingDifficulty, questionCount?: number) => {
  const max = getMaxQuestionCount(difficulty);
  if (!questionCount) return max;
  return Math.min(Math.max(1, Math.floor(questionCount)), max);
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

const modeLabel = (mode: string) => {
  if (mode === "chat_test") return "Чат-тест";
  if (mode === "exam_prep") return "Экзамен";
  return "Тренировка";
};

const workStatusLabel = (status: string): TrainingHistoryItemDto["status"] =>
  status === "failed" ? "Не сдан" : "Завершено";

const examStatusLabel = (status: string): TrainingHistoryItemDto["status"] =>
  status === "failed" ? "Не сдан" : status === "passed" ? "Сдан" : "Завершено";

export const createTrainingsPrismaDataSource = (
  prisma: TrainingsPrismaClient,
  fallback: FrontendApiDataSource,
): Pick<
  FrontendApiDataSource,
  | "getWeakTopics"
  | "getTrainingHistory"
  | "getSessionOptions"
  | "createTrainingSession"
  | "getTrainingSessionDetail"
  | "addTrainingMessage"
  | "completeTrainingSession"
> => ({
  getWeakTopics: async (): Promise<WeakTopicDto[]> => {
    try {
      const records = await prisma.weakTopic.findMany({
        include: { topic: true },
        orderBy: { errorsCount: "desc" },
        take: 10,
      });

      if (!records.length) return fallback.getWeakTopics();

      return records.map((record) => ({
        id: record.id,
        topic: record.topic.title,
        errors: record.errorsCount,
        recommendation: record.recommendation,
      }));
    } catch {
      return fallback.getWeakTopics();
    }
  },

  getTrainingHistory: async (userId?: string): Promise<TrainingHistoryItemDto[]> => {
    try {
      const where = userId ? { userId } : undefined;
      const [sessions, exams] = await Promise.all([
        prisma.trainingSession.findMany({
          where,
          include: { topic: true },
          orderBy: { startedAt: "desc" },
          take: 20,
        }),
        prisma.examAttempt.findMany({
          where,
          include: { topic: true },
          orderBy: { startedAt: "desc" },
          take: 20,
        }),
      ]);

      const history = [
        ...sessions.map((session) => ({
          id: session.id,
          date: formatDate(session.completedAt ?? session.startedAt),
          mode: modeLabel(session.mode),
          topic: session.topic.title,
          score: session.score ?? 0,
          status: workStatusLabel(session.status),
          sortAt: session.completedAt ?? session.startedAt,
        })),
        ...exams.map((exam) => ({
          id: exam.id,
          date: formatDate(exam.completedAt ?? exam.startedAt),
          mode: "Экзамен",
          topic: exam.topic.title,
          score: exam.score ?? 0,
          status: examStatusLabel(exam.status),
          sortAt: exam.completedAt ?? exam.startedAt,
        })),
      ]
        .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
        .map(({ sortAt, ...item }) => item);

      return history.length ? history : fallback.getTrainingHistory();
    } catch {
      return fallback.getTrainingHistory();
    }
  },

  getTrainingSessionDetail: async (
    userId: string,
    sessionId: string,
    role?: AppRole,
  ): Promise<TrainingSessionDetailDto | null> => {
    try {
      if (!prisma.trainingSession.findUnique) return null;

      const session = await prisma.trainingSession.findUnique({
        where: { id: sessionId },
        include: {
          topic: true,
          messages: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!session) return null;

      if (session.userId !== userId) {
        const canReadOrganizationSession = role === "manager" || role === "admin";
        const membership = canReadOrganizationSession
          ? await prisma.membership?.findFirst({
              where: { userId },
              orderBy: { createdAt: "asc" },
            })
          : null;

        if (!canReadOrganizationSession || membership?.organizationId !== session.organizationId) {
          return null;
        }
      }

      const criteria = Array.isArray(session.evaluationCriteria)
        ? session.evaluationCriteria as TrainingSessionDetailDto["criteria"]
        : [];
      const mistakes = Array.isArray(session.mistakes)
        ? session.mistakes.filter((item): item is string => typeof item === "string")
        : [];
      const recommendations = Array.isArray(session.recommendations)
        ? session.recommendations.filter((item): item is string => typeof item === "string")
        : [];

      return {
        id: session.id,
        date: formatDate(session.completedAt ?? session.startedAt),
        mode: modeLabel(session.mode),
        topic: session.topic.title,
        score: session.score ?? 0,
        status: workStatusLabel(session.status),
        criteria,
        mistakes: mistakes.length ? mistakes : ["Ошибок не обнаружено"],
        recommendations: recommendations.length ? recommendations : ["Повторить слабые темы"],
        messages: (session.messages ?? [])
          .filter((message) => message.sender === "ai" || message.sender === "user")
          .map((message) => ({
            id: message.id,
            sessionId: message.trainingSessionId,
            from: message.sender as "ai" | "user",
            text: message.content,
          })),
      };
    } catch {
      return null;
    }
  },

  getSessionOptions: async (): Promise<SessionOptionsDto> => {
    try {
      const [topics, fallbackOptions] = await Promise.all([
        prisma.trainingTopic.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        }),
        fallback.getSessionOptions(),
      ]);

      return {
        ...fallbackOptions,
        topics: topics.length ? topics.map((topic) => topic.title) : fallbackOptions.topics,
      };
    } catch {
      return fallback.getSessionOptions();
    }
  },

  createTrainingSession: async (
    userId: string,
    payload: TrainingSessionCreateRequestDto,
  ): Promise<TrainingSessionCreatedDto | null> => {
    const membership = await prisma.membership?.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    const topic = await prisma.trainingTopic.findFirst?.({
      where: { title: payload.topic, isActive: true },
    });

    if (!membership || !topic || !prisma.trainingSession.create) return null;

    const questionCount = normalizeQuestionCount(payload.difficulty, payload.questionCount);
    const session = await prisma.trainingSession.create({
      data: {
        organizationId: membership.organizationId,
        userId,
        topicId: topic.id,
        mode: toPrismaMode(payload.mode),
        difficulty: payload.difficulty,
        format: payload.format,
        character: payload.character,
        questionCount,
        status: "active",
        startedAt: new Date(),
      },
      include: { topic: true },
    });

    return {
      id: session.id,
      topic: session.topic.title,
      mode: fromPrismaMode(session.mode),
      difficulty: (session.difficulty ?? payload.difficulty) as TrainingSessionCreatedDto["difficulty"],
      format: (session.format ?? payload.format) as TrainingSessionCreatedDto["format"],
      character: (session.character ?? payload.character) as TrainingSessionCreatedDto["character"],
      questionCount: session.questionCount ?? questionCount,
      status: "active",
    };
  },

  addTrainingMessage: async (
    userId: string,
    sessionId: string,
    payload: TrainingMessageCreateRequestDto,
  ): Promise<TrainingMessageCreatedDto | null> => {
    const session = await prisma.trainingSession.findUnique?.({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId || !session.topicId || !prisma.trainingMessage.create) return null;

    const membership = await prisma.membership?.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) return null;

    const message = await prisma.trainingMessage.create({
      data: {
        organizationId: membership.organizationId,
        trainingSessionId: sessionId,
        sender: payload.from,
        content: payload.text,
      },
    });

    return {
      id: message.id,
      sessionId: message.trainingSessionId,
      from: message.sender as TrainingMessageCreatedDto["from"],
      text: message.content,
    };
  },

  completeTrainingSession: async (
    userId: string,
    sessionId: string,
    payload: TrainingSessionCompleteRequestDto,
  ): Promise<TrainingSessionCompletedDto | null> => {
    if (!validateScore(payload.score)) return null;

    const session = await prisma.trainingSession.findUnique?.({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId || !prisma.trainingSession.update) return null;

    const passed = isPassingScore(payload.score);
    const status = passed ? "completed" : "failed";
    const updated = await prisma.trainingSession.update({
      where: { id: sessionId },
      data: {
        score: payload.score,
        status,
        completedAt: new Date(),
        evaluationCriteria: payload.criteria,
        mistakes: payload.mistakes,
        recommendations: payload.recommendations,
      },
    });

    return {
      id: updated.id,
      score: payload.score,
      passed,
      status,
    };
  },
});
