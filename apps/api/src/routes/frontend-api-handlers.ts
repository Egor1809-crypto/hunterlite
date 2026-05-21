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
  TrainingMessageCreateRequestDto,
  TrainingMessageCreatedDto,
  TrainingHistoryItemDto,
  TrainingSessionCompleteRequestDto,
  TrainingSessionCompletedDto,
  TrainingSessionCreateRequestDto,
  TrainingSessionCreatedDto,
  TrainingSessionDetailDto,
  AdminUserDto,
  AdminUserCreateRequestDto,
  AdminUserUpdateRequestDto,
  TestQuestionDto,
  TestQuestionCreateRequestDto,
  CaseTemplateDto,
  CaseTemplateCreateRequestDto,
  ObjectionTemplateDto,
  ObjectionTemplateCreateRequestDto,
  CallScriptDto,
  CallScriptCreateRequestDto,
  CallScriptDeletedDto,
  CallScriptUpdateRequestDto,
} from "@/lib/api-contracts";
import type { AppRole } from "@/lib/demo-auth-state";
import {
  getCurrentUser,
  getDashboardSummary,
  getDialogScript,
  getEmployeeProfile,
  getEmployees,
  getManagerSummary,
  getNotifications,
  getProfileSummary,
  getSessionOptions,
  getTrainingHistory,
  getWeakTopics,
} from "@/lib/demo-api";
import type { ApiFailure, ApiResponse, ApiSuccess } from "../http/api-response";
import { fail, ok } from "../http/api-response";
import type { BackendModuleName } from "../modules/module-registry";

export type ApiMethod = "GET" | "POST";
type MaybePromise<T> = T | Promise<T>;

export type FrontendApiRoute = {
  method: ApiMethod;
  path: string;
  module: BackendModuleName;
  requiresAuth: boolean;
};

export const frontendApiRoutes = [
  { method: "POST", path: "/api/auth/login", module: "auth", requiresAuth: false },
  { method: "POST", path: "/api/auth/password-reset/request", module: "auth", requiresAuth: false },
  { method: "POST", path: "/api/auth/password-reset/complete", module: "auth", requiresAuth: false },
  { method: "GET", path: "/api/auth/session", module: "auth", requiresAuth: true },
  { method: "POST", path: "/api/auth/logout", module: "auth", requiresAuth: true },
  { method: "GET", path: "/api/users/me", module: "users", requiresAuth: true },
  { method: "GET", path: "/api/users/profile", module: "users", requiresAuth: true },
  { method: "GET", path: "/api/analytics/dashboard", module: "analytics", requiresAuth: true },
  { method: "GET", path: "/api/analytics/manager", module: "analytics", requiresAuth: true },
  { method: "GET", path: "/api/analytics/manager/employees/:id", module: "analytics", requiresAuth: true },
  { method: "GET", path: "/api/notifications", module: "notifications", requiresAuth: true },
  { method: "GET", path: "/api/trainings/weak-topics", module: "trainings", requiresAuth: true },
  { method: "GET", path: "/api/trainings/history", module: "trainings", requiresAuth: true },
  { method: "GET", path: "/api/trainings/session-options", module: "trainings", requiresAuth: true },
  { method: "GET", path: "/api/trainings/dialog-script", module: "trainings", requiresAuth: true },
  { method: "GET", path: "/api/trainings/call-scripts", module: "trainings", requiresAuth: true },
  { method: "POST", path: "/api/trainings/sessions", module: "trainings", requiresAuth: true },
  { method: "GET", path: "/api/trainings/sessions/:id", module: "trainings", requiresAuth: true },
  { method: "POST", path: "/api/trainings/sessions/:id/messages", module: "trainings", requiresAuth: true },
  { method: "POST", path: "/api/trainings/sessions/:id/complete", module: "trainings", requiresAuth: true },
  { method: "GET", path: "/api/admin/users", module: "admin", requiresAuth: true },
  { method: "POST", path: "/api/admin/users", module: "admin", requiresAuth: true },
  { method: "POST", path: "/api/admin/users/:id", module: "admin", requiresAuth: true },
  { method: "GET", path: "/api/admin/tests", module: "admin", requiresAuth: true },
  { method: "POST", path: "/api/admin/tests", module: "admin", requiresAuth: true },
  { method: "GET", path: "/api/admin/cases", module: "admin", requiresAuth: true },
  { method: "POST", path: "/api/admin/cases", module: "admin", requiresAuth: true },
  { method: "GET", path: "/api/admin/objections", module: "admin", requiresAuth: true },
  { method: "POST", path: "/api/admin/objections", module: "admin", requiresAuth: true },
  { method: "GET", path: "/api/admin/call-scripts", module: "admin", requiresAuth: true },
  { method: "POST", path: "/api/admin/call-scripts", module: "admin", requiresAuth: true },
  { method: "POST", path: "/api/admin/call-scripts/:id", module: "admin", requiresAuth: true },
  { method: "POST", path: "/api/admin/call-scripts/:id/delete", module: "admin", requiresAuth: true },
] as const satisfies readonly FrontendApiRoute[];

export type FrontendApiDataSource = {
  getCurrentUser: (role?: AppRole) => MaybePromise<CurrentUserDto>;
  getProfileSummary: (role?: AppRole) => MaybePromise<ProfileSummaryDto>;
  getDashboardSummary: (role?: AppRole) => MaybePromise<DashboardSummaryDto>;
  getNotifications: () => MaybePromise<NotificationDto[]>;
  getWeakTopics: () => MaybePromise<WeakTopicDto[]>;
  getTrainingHistory: (userId?: string) => MaybePromise<TrainingHistoryItemDto[]>;
  getEmployees: () => MaybePromise<EmployeeDto[]>;
  getManagerSummary: () => MaybePromise<ManagerSummaryDto>;
  getEmployeeProfile: (id?: string) => MaybePromise<EmployeeProfileDto>;
  getSessionOptions: () => MaybePromise<SessionOptionsDto>;
  getDialogScript: () => MaybePromise<DialogMessageDto[]>;
  createTrainingSession: (userId: string, payload: TrainingSessionCreateRequestDto) => MaybePromise<TrainingSessionCreatedDto | null>;
  getTrainingSessionDetail: (userId: string, sessionId: string, role?: AppRole) => MaybePromise<TrainingSessionDetailDto | null>;
  addTrainingMessage: (userId: string, sessionId: string, payload: TrainingMessageCreateRequestDto) => MaybePromise<TrainingMessageCreatedDto | null>;
  completeTrainingSession: (userId: string, sessionId: string, payload: TrainingSessionCompleteRequestDto) => MaybePromise<TrainingSessionCompletedDto | null>;
  getAdminUsers: () => MaybePromise<AdminUserDto[]>;
  createAdminUser: (payload: AdminUserCreateRequestDto) => MaybePromise<AdminUserDto | null>;
  updateAdminUser: (id: string, payload: AdminUserUpdateRequestDto) => MaybePromise<AdminUserDto | null>;
  getTestQuestions: () => MaybePromise<TestQuestionDto[]>;
  createTestQuestion: (payload: TestQuestionCreateRequestDto) => MaybePromise<TestQuestionDto | null>;
  getCaseTemplates: () => MaybePromise<CaseTemplateDto[]>;
  createCaseTemplate: (payload: CaseTemplateCreateRequestDto) => MaybePromise<CaseTemplateDto | null>;
  getObjectionTemplates: () => MaybePromise<ObjectionTemplateDto[]>;
  createObjectionTemplate: (payload: ObjectionTemplateCreateRequestDto) => MaybePromise<ObjectionTemplateDto | null>;
  getCallScripts: () => MaybePromise<CallScriptDto[]>;
  createCallScript: (payload: CallScriptCreateRequestDto) => MaybePromise<CallScriptDto | null>;
  updateCallScript: (id: string, payload: CallScriptUpdateRequestDto) => MaybePromise<CallScriptDto | null>;
  deleteCallScript: (id: string) => MaybePromise<boolean>;
};

export const demoFrontendApiDataSource: FrontendApiDataSource = {
  getCurrentUser,
  getProfileSummary,
  getDashboardSummary,
  getNotifications,
  getWeakTopics,
  getTrainingHistory,
  getEmployees,
  getManagerSummary,
  getEmployeeProfile,
  getSessionOptions,
  getDialogScript,
  createTrainingSession: async () => null,
  getTrainingSessionDetail: async () => null,
  addTrainingMessage: async () => null,
  completeTrainingSession: async () => null,
  getAdminUsers: async () => [],
  createAdminUser: async () => null,
  updateAdminUser: async () => null,
  getTestQuestions: async () => [],
  createTestQuestion: async () => null,
  getCaseTemplates: async () => [],
  createCaseTemplate: async () => null,
  getObjectionTemplates: async () => [],
  createObjectionTemplate: async () => null,
  getCallScripts: async () => [],
  createCallScript: async () => null,
  updateCallScript: async () => null,
  deleteCallScript: async () => false,
};

type HandlerResult<TData> = ApiSuccess<TData> | ApiFailure;

export const createFrontendApiHandlers = (source: FrontendApiDataSource = demoFrontendApiDataSource) => ({
  getMe: async (role?: AppRole): Promise<ApiResponse<CurrentUserDto>> => ok(await source.getCurrentUser(role)),

  getProfile: async (role?: AppRole): Promise<ApiResponse<ProfileSummaryDto>> => ok(await source.getProfileSummary(role)),

  getDashboard: async (role?: AppRole): Promise<ApiResponse<DashboardSummaryDto>> => ok(await source.getDashboardSummary(role)),

  getNotifications: async (): Promise<ApiResponse<NotificationDto[]>> => ok(await source.getNotifications()),

  getWeakTopics: async (): Promise<ApiResponse<WeakTopicDto[]>> => ok(await source.getWeakTopics()),

  getTrainingHistory: async (userId?: string): Promise<ApiResponse<TrainingHistoryItemDto[]>> => ok(await source.getTrainingHistory(userId)),

  getManagerSummary: async (): Promise<ApiResponse<ManagerSummaryDto>> => ok(await source.getManagerSummary()),

  getEmployeeProfile: async (id: string): Promise<HandlerResult<EmployeeProfileDto>> => {
    const employees = await source.getEmployees();
    const exists = employees.some((employee) => employee.id === id);

    if (!exists) {
      return fail("NOT_FOUND", "Employee not found", { id });
    }

    return ok(await source.getEmployeeProfile(id));
  },

  getSessionOptions: async (): Promise<ApiResponse<SessionOptionsDto>> => ok(await source.getSessionOptions()),

  getDialogScript: async (): Promise<ApiResponse<DialogMessageDto[]>> => ok(await source.getDialogScript()),

  getAdminUsers: async (): Promise<ApiResponse<AdminUserDto[]>> => ok(await source.getAdminUsers()),

  createAdminUser: async (payload: unknown): Promise<HandlerResult<AdminUserDto>> => {
    const request = payload as Partial<AdminUserCreateRequestDto> | undefined;
    const email = request?.email?.trim().toLowerCase();

    if (!request?.name?.trim() || !email || !request.role) {
      return fail("VALIDATION_ERROR", "User name, email and role are required");
    }

    const created = await source.createAdminUser({
      name: request.name.trim(),
      email,
      role: request.role,
      password: request.password,
    });

    if (!created) return fail("VALIDATION_ERROR", "Could not create user");

    return ok(created);
  },

  updateAdminUser: async (id: string, payload: unknown): Promise<HandlerResult<AdminUserDto>> => {
    const request = payload as Partial<AdminUserUpdateRequestDto> | undefined;

    if (!request?.role && !request?.status) {
      return fail("VALIDATION_ERROR", "Role or status is required");
    }

    const updated = await source.updateAdminUser(id, {
      role: request.role,
      status: request.status,
    });

    if (!updated) return fail("NOT_FOUND", "User not found", { id });

    return ok(updated);
  },

  createTrainingSession: async (
    userId: string,
    payload: unknown,
  ): Promise<HandlerResult<TrainingSessionCreatedDto>> => {
    const request = payload as Partial<TrainingSessionCreateRequestDto> | undefined;

    if (!request?.topic || !request.mode || !request.difficulty || !request.format || !request.character) {
      return fail("VALIDATION_ERROR", "Training session parameters are required");
    }

    const created = await source.createTrainingSession(userId, {
      topic: request.topic,
      mode: request.mode,
      difficulty: request.difficulty,
      format: request.format,
      character: request.character,
      questionCount: request.questionCount,
    });

    if (!created) return fail("NOT_FOUND", "Training topic or user membership not found");

    return ok(created);
  },

  getTrainingSessionDetail: async (
    userId: string,
    sessionId: string,
    role?: AppRole,
  ): Promise<HandlerResult<TrainingSessionDetailDto>> => {
    const detail = await source.getTrainingSessionDetail(userId, sessionId, role);

    if (!detail) return fail("NOT_FOUND", "Training session not found", { id: sessionId });

    return ok(detail);
  },

  addTrainingMessage: async (
    userId: string,
    sessionId: string,
    payload: unknown,
  ): Promise<HandlerResult<TrainingMessageCreatedDto>> => {
    const request = payload as Partial<TrainingMessageCreateRequestDto> | undefined;

    if ((request?.from !== "ai" && request?.from !== "user") || !request.text?.trim()) {
      return fail("VALIDATION_ERROR", "Message sender and text are required");
    }

    const created = await source.addTrainingMessage(userId, sessionId, {
      from: request.from,
      text: request.text.trim(),
    });

    if (!created) return fail("NOT_FOUND", "Training session not found");

    return ok(created);
  },

  completeTrainingSession: async (
    userId: string,
    sessionId: string,
    payload: unknown,
  ): Promise<HandlerResult<TrainingSessionCompletedDto>> => {
    const request = payload as Partial<TrainingSessionCompleteRequestDto> | undefined;

    if (typeof request?.score !== "number" || !Array.isArray(request.criteria)) {
      return fail("VALIDATION_ERROR", "Training result is required");
    }

    const completed = await source.completeTrainingSession(userId, sessionId, {
      score: request.score,
      criteria: request.criteria as TrainingSessionCompleteRequestDto["criteria"],
      mistakes: Array.isArray(request.mistakes) ? request.mistakes : [],
      recommendations: Array.isArray(request.recommendations) ? request.recommendations : [],
    });

    if (!completed) return fail("VALIDATION_ERROR", "Training session result is invalid");

    return ok(completed);
  },

  getTestQuestions: async (): Promise<ApiResponse<TestQuestionDto[]>> => ok(await source.getTestQuestions()),

  createTestQuestion: async (
    payload: unknown,
  ): Promise<HandlerResult<TestQuestionDto>> => {
    const request = payload as Partial<TestQuestionCreateRequestDto> | undefined;

    if (!request?.title || !request.text || !request.type || !request.difficulty || !request.correctAnswer) {
      return fail("VALIDATION_ERROR", "Required fields are missing");
    }

    const created = await source.createTestQuestion(request as TestQuestionCreateRequestDto);
    if (!created) return fail("VALIDATION_ERROR", "Could not create question");

    return ok(created);
  },

  getCaseTemplates: async (): Promise<ApiResponse<CaseTemplateDto[]>> => ok(await source.getCaseTemplates()),

  createCaseTemplate: async (
    payload: unknown,
  ): Promise<HandlerResult<CaseTemplateDto>> => {
    const request = payload as Partial<CaseTemplateCreateRequestDto> | undefined;

    if (!request?.title || !request.introText || !request.difficulty || !Array.isArray(request.steps)) {
      return fail("VALIDATION_ERROR", "Required case fields are missing");
    }

    const created = await source.createCaseTemplate(request as CaseTemplateCreateRequestDto);
    if (!created) return fail("VALIDATION_ERROR", "Could not create case template");

    return ok(created);
  },

  getObjectionTemplates: async (): Promise<ApiResponse<ObjectionTemplateDto[]>> => ok(await source.getObjectionTemplates()),

  createObjectionTemplate: async (
    payload: unknown,
  ): Promise<HandlerResult<ObjectionTemplateDto>> => {
    const request = payload as Partial<ObjectionTemplateCreateRequestDto> | undefined;

    if (!request?.category || !request.clientPhrase || !request.referenceAnswer) {
      return fail("VALIDATION_ERROR", "Required objection fields are missing");
    }

    const created = await source.createObjectionTemplate(request as ObjectionTemplateCreateRequestDto);
    if (!created) return fail("VALIDATION_ERROR", "Could not create objection template");

    return ok(created);
  },

  getCallScripts: async (): Promise<ApiResponse<CallScriptDto[]>> => ok(await source.getCallScripts()),

  createCallScript: async (
    payload: unknown,
  ): Promise<HandlerResult<CallScriptDto>> => {
    const request = payload as Partial<CallScriptCreateRequestDto> | undefined;

    if (!request?.title || !request.clientProfile || !Array.isArray(request.nodes)) {
      return fail("VALIDATION_ERROR", "Required script fields are missing");
    }

    const created = await source.createCallScript(request as CallScriptCreateRequestDto);
    if (!created) return fail("VALIDATION_ERROR", "Could not create call script");

    return ok(created);
  },

  updateCallScript: async (id: string, payload: unknown): Promise<HandlerResult<CallScriptDto>> => {
    const request = payload as Partial<CallScriptUpdateRequestDto> | undefined;

    if (!request?.title && !request?.clientProfile && !Array.isArray(request?.nodes)) {
      return fail("VALIDATION_ERROR", "Script fields are required");
    }

    const updated = await source.updateCallScript(id, request as CallScriptUpdateRequestDto);
    if (!updated) return fail("NOT_FOUND", "Call script not found", { id });

    return ok(updated);
  },

  deleteCallScript: async (id: string): Promise<HandlerResult<CallScriptDeletedDto>> => {
    const deleted = await source.deleteCallScript(id);
    if (!deleted) return fail("NOT_FOUND", "Call script not found", { id });

    return ok({ deleted: true, id });
  },
});
