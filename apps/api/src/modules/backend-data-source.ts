import { type FrontendApiDataSource } from "../routes/frontend-api-handlers";
import {
  createUsersPrismaDataSource,
  type UsersPrismaClient,
} from "./users/users-prisma-data-source";
import {
  createTrainingsPrismaDataSource,
  type TrainingsPrismaClient,
} from "./trainings/trainings-prisma-data-source";
import {
  createNotificationsPrismaDataSource,
  type NotificationsPrismaClient,
} from "./notifications/notifications-prisma-data-source";
import {
  createAnalyticsPrismaDataSource,
  type AnalyticsPrismaClient,
} from "./analytics/analytics-prisma-data-source";
import {
  createAdminPrismaDataSource,
  type AdminPrismaClient,
} from "./admin/admin-prisma-data-source";
import type { NavyAiClient } from "./ai/navy-ai-client";
import type { TelegramBotClient } from "./telegram/telegram-bot-client";

export type BackendDataSourceOptions = {
  prisma: UsersPrismaClient & TrainingsPrismaClient & NotificationsPrismaClient & AnalyticsPrismaClient & AdminPrismaClient;
  ai?: NavyAiClient;
  telegram?: TelegramBotClient;
};

export const createBackendDataSource = (
  options: BackendDataSourceOptions,
): FrontendApiDataSource => {
  const users = createUsersPrismaDataSource(options.prisma);
  const trainings = createTrainingsPrismaDataSource(options.prisma, {
    telegram: options.telegram,
  });
  const notifications = createNotificationsPrismaDataSource(options.prisma);
  const analytics = createAnalyticsPrismaDataSource(options.prisma);
  const admin = createAdminPrismaDataSource(options.prisma);

  return {
    ...users,
    ...trainings,
    ...notifications,
    ...analytics,
    ...admin,
    generateTrainingReply: async (payload) => options.ai?.generateTrainingReply(payload) ?? null,
    synthesizeSpeech: async (payload) => options.ai?.synthesizeSpeech(payload) ?? null,
    transcribeSpeech: async (payload) => options.ai?.transcribeSpeech(payload) ?? null,
    getProfileSummary: async (userId) => ({
      user: await users.getCurrentUser(userId),
      weakTopics: await trainings.getWeakTopics(userId),
    }),
  };
};
