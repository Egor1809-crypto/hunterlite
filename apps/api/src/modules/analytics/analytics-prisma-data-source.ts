import type {
  CurrentUserDto,
  DashboardSummaryDto,
  EmployeeDto,
  EmployeeProfileDto,
  ManagerSummaryDto,
  TrainingHistoryItemDto,
  WeakTopicDto,
} from "@/lib/api-contracts";
import type { AppRole } from "@/lib/demo-auth-state";
import type { FrontendApiDataSource } from "../../routes/frontend-api-handlers";
import type { TrainingsPrismaClient } from "../trainings/trainings-prisma-data-source";

type UserRecord = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  lastLoginAt?: Date | null;
};

type MembershipRecord = {
  id: string;
  role: string;
  status: string;
  createdAt: Date;
  user: UserRecord;
};

export type AnalyticsPrismaClient = TrainingsPrismaClient & {
  membership: {
    findMany: (args: {
      where?: { role?: AppRole };
      include: { user: true };
      orderBy?: { createdAt: "asc" | "desc" };
    }) => Promise<MembershipRecord[]>;
  };
};

const roleLabels: Record<string, string> = {
  employee: "Юрист-консультант",
  manager: "Руководитель",
  admin: "Администратор",
};

const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;

const statusLabel = (status: string): CurrentUserDto["status"] =>
  status === "active" ? "Допущен" : "Активен";

const employeeStatus = (membership: MembershipRecord): EmployeeDto["status"] =>
  membership.status === "active" ? "Допущен" : "Не допущен";

const examStatus = (score: number): EmployeeDto["exam"] => {
  if (score >= 70) return "Сдан";
  if (score > 0) return "Не сдан";
  return "На проверке";
};

const weakLabel = (topics: WeakTopicDto[]) =>
  topics.length ? topics.slice(0, 2).map((topic) => topic.topic).join(", ") : "—";

const lastActiveLabel = (date?: Date | null) => {
  if (!date) return "Нет данных";

  const today = new Date("2026-05-15T00:00:00.000Z");
  const diffDays = Math.max(0, Math.round((today.getTime() - date.getTime()) / 86_400_000));

  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  return `${diffDays} дн. назад`;
};

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

const toCurrentUser = (
  membership: MembershipRecord,
  avgScore: number,
  weeklyTrainings: number,
): CurrentUserDto => {
  const role = membership.role as AppRole;

  return {
    id: membership.user.id,
    name: membership.user.fullName,
    firstName: firstNameOf(membership.user.fullName),
    role,
    roleLabel: roleLabels[role] ?? role,
    email: membership.user.email,
    status: statusLabel(membership.status),
    avgScore,
    examPassed: avgScore >= 70,
    weeklyTrainings,
  };
};

const historyStatus = (status: string): TrainingHistoryItemDto["status"] =>
  status === "failed" ? "Не сдан" : status === "passed" ? "Сдан" : "Завершено";

export const createAnalyticsPrismaDataSource = (
  prisma: AnalyticsPrismaClient,
  fallback: FrontendApiDataSource,
): Pick<FrontendApiDataSource, "getDashboardSummary" | "getManagerSummary" | "getEmployeeProfile"> => {
  const loadCore = async () => {
    const [memberships, sessions, exams, weakTopics] = await Promise.all([
      prisma.membership.findMany({
        where: { role: "employee" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.trainingSession.findMany({
        include: { topic: true },
        orderBy: { startedAt: "desc" },
        take: 50,
      }),
      prisma.examAttempt.findMany({
        include: { topic: true },
        orderBy: { startedAt: "desc" },
        take: 50,
      }),
      prisma.weakTopic.findMany({
        include: { topic: true },
        orderBy: { errorsCount: "desc" },
        take: 50,
      }),
    ]);

    const weakTopicDtos: WeakTopicDto[] = weakTopics.map((topic) => ({
      id: topic.id,
      topic: topic.topic.title,
      errors: topic.errorsCount,
      recommendation: topic.recommendation,
    }));

    return { memberships, sessions, exams, weakTopicDtos };
  };

  const buildEmployees = async (): Promise<EmployeeDto[]> => {
    const { memberships, sessions, exams, weakTopicDtos } = await loadCore();

    return memberships.map((membership) => {
      const scores = [
        ...sessions.filter((session) => session.userId === membership.user.id).map((session) => session.score ?? 0),
        ...exams.filter((exam) => exam.userId === membership.user.id).map((exam) => exam.score ?? 0),
      ].filter((score) => score > 0);
      const score = average(scores);
      const latestExamScore = exams.find((exam) => exam.userId === membership.user.id)?.score ?? 0;

      return {
        id: membership.user.id,
        name: membership.user.fullName,
        score,
        exam: examStatus(latestExamScore),
        status: employeeStatus(membership),
        weak: weakLabel(weakTopicDtos),
        lastActive: lastActiveLabel(membership.user.lastLoginAt),
      };
    });
  };

  return {
    getDashboardSummary: async (role?: AppRole): Promise<DashboardSummaryDto> => {
      try {
        const fallbackDashboard = await fallback.getDashboardSummary(role);
        const { memberships, sessions, exams, weakTopicDtos } = await loadCore();
        const membership = memberships[0];

        if (!membership) return fallbackDashboard;

        const scores = [
          ...sessions.map((session) => session.score ?? 0),
          ...exams.map((exam) => exam.score ?? 0),
        ].filter((score) => score > 0);

        const user = toCurrentUser(
          membership,
          average(scores),
          sessions.filter((session) => session.userId === membership.user.id).length,
        );

        return {
          ...fallbackDashboard,
          user,
          weakTopics: weakTopicDtos.length ? weakTopicDtos : fallbackDashboard.weakTopics,
          lastSession: fallbackDashboard.lastSession,
        };
      } catch {
        return fallback.getDashboardSummary(role);
      }
    },

    getManagerSummary: async (): Promise<ManagerSummaryDto> => {
      try {
        const [fallbackManager, employees, { weakTopicDtos, exams }] = await Promise.all([
          fallback.getManagerSummary(),
          buildEmployees(),
          loadCore(),
        ]);

        if (!employees.length) return fallbackManager;

        return {
          ...fallbackManager,
          employees,
          kpi: {
            totalEmployees: employees.length,
            allowedEmployees: employees.filter((employee) => employee.status === "Допущен").length,
            blockedEmployees: employees.filter((employee) => employee.status === "Не допущен").length,
            avgScore: average(employees.map((employee) => employee.score).filter((score) => score > 0)),
            weeklyExams: exams.length,
            weakestTopic: weakTopicDtos[0]?.topic.split(" ")[0] ?? fallbackManager.kpi.weakestTopic,
          },
          topWeakTopics: weakTopicDtos.length
            ? weakTopicDtos.slice(0, 5).map((topic) => ({ topic: topic.topic, errors: topic.errors }))
            : fallbackManager.topWeakTopics,
        };
      } catch {
        return fallback.getManagerSummary();
      }
    },

    getEmployeeProfile: async (id?: string): Promise<EmployeeProfileDto> => {
      try {
        const [fallbackProfile, employees, { sessions, exams, weakTopicDtos }] = await Promise.all([
          fallback.getEmployeeProfile(id),
          buildEmployees(),
          loadCore(),
        ]);
        const employee = employees.find((item) => item.id === id) ?? employees[0];

        if (!employee) return fallbackProfile;

        const history = [
          ...sessions
            .filter((session) => session.userId === employee.id)
            .map((session) => ({
              id: session.id,
              date: new Intl.DateTimeFormat("ru-RU").format(session.completedAt ?? session.startedAt),
              mode: "Тренировка",
              topic: session.topic.title,
              score: session.score ?? 0,
              status: historyStatus(session.status),
            })),
          ...exams
            .filter((exam) => exam.userId === employee.id)
            .map((exam) => ({
              id: exam.id,
              date: new Intl.DateTimeFormat("ru-RU").format(exam.completedAt ?? exam.startedAt),
              mode: "Экзамен",
              topic: exam.topic.title,
              score: exam.score ?? 0,
              status: historyStatus(exam.status),
            })),
        ];

        return {
          ...fallbackProfile,
          employee,
          history: history.length ? history : fallbackProfile.history,
          weakTopics: weakTopicDtos.length ? weakTopicDtos : fallbackProfile.weakTopics,
        };
      } catch {
        return fallback.getEmployeeProfile(id);
      }
    },
  };
};
