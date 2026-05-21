import type {
  CurrentUserDto,
  DashboardSummaryDto,
  DialogMessageDto,
  EmployeeDto,
  EmployeeProfileDto,
  ManagerSummaryDto,
  NotificationDto,
  ProfileSummaryDto,
  SessionOptionsDto,
  TrainingHistoryItemDto,
  WeakTopicDto,
} from "@/lib/api-contracts";
import { getDemoUser, type AppRole } from "@/lib/demo-auth-state";
import {
  characters,
  dialogScript,
  difficulties,
  employees,
  formats,
  history,
  notifications,
  topics,
  weakTopics,
} from "@/lib/mock";

const scoreByRole: Record<AppRole, Pick<CurrentUserDto, "avgScore" | "examPassed" | "weeklyTrainings">> = {
  employee: { avgScore: 82, examPassed: true, weeklyTrainings: 6 },
  manager: { avgScore: 88, examPassed: true, weeklyTrainings: 0 },
  admin: { avgScore: 0, examPassed: true, weeklyTrainings: 0 },
  client: { avgScore: 0, examPassed: false, weeklyTrainings: 0 },
};

export const getCurrentUser = (role?: AppRole): CurrentUserDto => {
  const user = getDemoUser(role);

  return {
    id: user.role,
    name: user.name,
    firstName: user.firstName,
    role: user.role,
    roleLabel: user.roleLabel,
    email: user.email,
    status: user.status,
    ...scoreByRole[user.role],
  };
};

export const getWeakTopics = (): WeakTopicDto[] =>
  weakTopics.map((topic, index) => ({
    id: String(index + 1),
    topic: topic.topic,
    errors: topic.errors,
    recommendation: topic.recommendation,
  }));

export const getNotifications = (): NotificationDto[] => [
  {
    id: "daily-training",
    title: "Ежедневная тренировка",
    body: "Сегодня 15 минут: возражения клиента и безопасные формулировки.",
    time: "09:00",
    tone: "info",
    unread: true,
    actionUrl: "/session/setup?mode=talk",
  },
  {
    id: "weekly-streak",
    title: "Серия 6 дней",
    body: "Осталась одна короткая сессия, чтобы закрыть норму недели.",
    time: "Сегодня",
    tone: "success",
    unread: true,
    actionUrl: "/session/setup?mode=talk",
  },
  ...notifications.map((item) => ({
    id: String(item.id),
    title: item.title,
    body: item.text,
    time: item.time,
    tone: item.type,
    unread: item.id <= 2,
    actionUrl: "/notifications",
  })),
];

export const getTrainingHistory = (): TrainingHistoryItemDto[] =>
  history.map((item) => ({
    id: String(item.id),
    date: item.date,
    mode: item.mode,
    topic: item.topic,
    score: item.score,
    status: item.status as TrainingHistoryItemDto["status"],
  }));

export const getProfileSummary = (role?: AppRole): ProfileSummaryDto => ({
  user: getCurrentUser(role),
  weakTopics: getWeakTopics(),
});

export const getDashboardSummary = (role?: AppRole): DashboardSummaryDto => {
  const trainingHistory = getTrainingHistory();

  return {
    user: getCurrentUser(role),
    weakTopics: getWeakTopics(),
    notifications: getNotifications().slice(0, 3),
    lastSession: trainingHistory[1] || trainingHistory[0],
    nextTask: {
      title: "Аттестация: Имущество должника",
      dueDate: "до 5 мая 2026",
      readiness: 74,
    },
  };
};

export const getEmployees = (): EmployeeDto[] =>
  employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    score: employee.score,
    exam: employee.exam as EmployeeDto["exam"],
    status: employee.status as EmployeeDto["status"],
    weak: employee.weak,
    lastActive: employee.lastActive,
  }));

export const getManagerSummary = (): ManagerSummaryDto => {
  const team = getEmployees();
  const allowedEmployees = team.filter((employee) => employee.status === "Допущен").length;
  const blockedEmployees = team.filter((employee) => employee.status === "Не допущен").length;
  const avgScore = Math.round(team.reduce((sum, employee) => sum + employee.score, 0) / team.length);

  return {
    employees: team,
    kpi: {
      totalEmployees: team.length,
      allowedEmployees,
      blockedEmployees,
      avgScore,
      weeklyExams: 14,
      weakestTopic: "Имущество",
    },
    scoreTrend: [
      { week: "Н1", score: 62 },
      { week: "Н2", score: 65 },
      { week: "Н3", score: 64 },
      { week: "Н4", score: 68 },
      { week: "Н5", score: 71 },
      { week: "Н6", score: 70 },
      { week: "Н7", score: 74 },
      { week: "Н8", score: 76 },
      { week: "Н9", score: 75 },
      { week: "Н10", score: 78 },
      { week: "Н11", score: 80 },
      { week: "Н12", score: 82 },
    ],
    topWeakTopics: [
      { topic: "Имущество должника", errors: 38 },
      { topic: "Ипотечное жильё", errors: 34 },
      { topic: "Долги без списания", errors: 29 },
      { topic: "Сроки процедуры", errors: 22 },
      { topic: "Стоимость и риски", errors: 18 },
    ],
  };
};

export const getEmployeeProfile = (id?: string): EmployeeProfileDto => {
  const employee = getEmployees().find((item) => item.id === id) ?? getEmployees()[0];

  return {
    employee,
    history: getTrainingHistory().slice(0, 4),
    weakTopics: getWeakTopics(),
    strongTopics: ["Условия процедуры", "Тон коммуникации", "Возражения клиента"],
    recommendation: "Назначьте сотруднику курс по теме «Имущество должника» и пробный экзамен через 7 дней.",
  };
};

export const getSessionOptions = (): SessionOptionsDto => ({
  topics: [...topics],
  difficulties: [...difficulties],
  characters: [...characters],
  formats: [...formats],
});

export const getDialogScript = (): DialogMessageDto[] =>
  dialogScript.map((message) => ({
    from: message.from as DialogMessageDto["from"],
    text: message.text,
  }));
