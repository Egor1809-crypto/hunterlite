import {
  demoFrontendApiDataSource,
  type FrontendApiDataSource,
} from "../routes/frontend-api-handlers";
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

export type BackendDataSourceOptions = {
  prisma?: UsersPrismaClient & TrainingsPrismaClient & NotificationsPrismaClient & AnalyticsPrismaClient & AdminPrismaClient;
  ai?: NavyAiClient;
};

export const createBackendDataSource = (
  options: BackendDataSourceOptions = {},
): FrontendApiDataSource => {
  if (!options.prisma) return demoFrontendApiDataSource;

  const users = createUsersPrismaDataSource(options.prisma, demoFrontendApiDataSource);
  const trainings = createTrainingsPrismaDataSource(options.prisma, demoFrontendApiDataSource);
  const notifications = createNotificationsPrismaDataSource(options.prisma, demoFrontendApiDataSource);
  const analytics = createAnalyticsPrismaDataSource(options.prisma, demoFrontendApiDataSource);
  const admin = createAdminPrismaDataSource(options.prisma, demoFrontendApiDataSource);

  const source: FrontendApiDataSource = {
    ...demoFrontendApiDataSource,
    ...users,
    ...trainings,
    ...notifications,
    ...analytics,
    ...admin,
    ...(options.ai ?? {}),
  };

  return {
    ...source,
    getProfileSummary: async (role) => ({
      user: await users.getCurrentUser(role),
      weakTopics: await trainings.getWeakTopics(),
    }),
  };
};
