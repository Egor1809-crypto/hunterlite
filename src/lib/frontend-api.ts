import { useQuery, type QueryKey } from "@tanstack/react-query";
import type {
  CurrentUserDto,
  DashboardSummaryDto,
  EmployeeProfileDto,
  ManagerSummaryDto,
  ManagerReportsDto,
  EmployeeCourseAssignedDto,
  EmployeeCourseAssignRequestDto,
  NotificationDto,
  ProfileSummaryDto,
  SessionOptionsDto,
  TrainingHistoryItemDto,
  TrainingMessageCreateRequestDto,
  TrainingMessageCreatedDto,
  TrainingSessionCompleteRequestDto,
  TrainingSessionCompletedDto,
  TrainingSessionCreateRequestDto,
  TrainingSessionCreatedDto,
  TrainingSessionDetailDto,
  WeakTopicDto,
  AuthLoginRequestDto,
  AuthPasswordResetCompleteDto,
  AuthPasswordResetCompletedDto,
  AuthPasswordResetRequestDto,
  AuthPasswordResetRequestedDto,
  AuthSessionDto,
  AiSpeechDto,
  AiSpeechRequestDto,
  AiTrainingReplyDto,
  AiTrainingReplyRequestDto,
  AiTranscriptionDto,
  AiTranscriptionRequestDto,
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
import { apiGet, apiPost } from "@/lib/api-client";
import type { AppRole } from "@/lib/demo-auth-state";
import {
  getCurrentUser,
  getDashboardSummary,
  getEmployeeProfile,
  getManagerSummary,
  getManagerReports,
  getNotifications,
  getProfileSummary,
  getSessionOptions,
  getTrainingHistory,
  getWeakTopics,
} from "@/lib/demo-api";

const roleQuery = (role?: AppRole) => (role ? `?role=${encodeURIComponent(role)}` : "");

export const frontendApi = {
  login: (payload: AuthLoginRequestDto) => apiPost<AuthSessionDto, AuthLoginRequestDto>("/auth/login", payload),
  requestPasswordReset: (payload: AuthPasswordResetRequestDto) =>
    apiPost<AuthPasswordResetRequestedDto, AuthPasswordResetRequestDto>("/auth/password-reset/request", payload),
  completePasswordReset: (payload: AuthPasswordResetCompleteDto) =>
    apiPost<AuthPasswordResetCompletedDto, AuthPasswordResetCompleteDto>("/auth/password-reset/complete", payload),
  logout: () => apiPost<{ loggedOut: true }>("/auth/logout"),
  session: () => apiGet<AuthSessionDto>("/auth/session"),
  currentUser: (role?: AppRole) => apiGet<CurrentUserDto>(`/users/me${roleQuery(role)}`),
  profile: (role?: AppRole) => apiGet<ProfileSummaryDto>(`/users/profile${roleQuery(role)}`),
  dashboard: (role?: AppRole) => apiGet<DashboardSummaryDto>(`/analytics/dashboard${roleQuery(role)}`),
  notifications: () => apiGet<NotificationDto[]>("/notifications"),
  weakTopics: () => apiGet<WeakTopicDto[]>("/trainings/weak-topics"),
  trainingHistory: () => apiGet<TrainingHistoryItemDto[]>("/trainings/history"),
  generateTrainingReply: (payload: AiTrainingReplyRequestDto) =>
    apiPost<AiTrainingReplyDto, AiTrainingReplyRequestDto>("/ai/chat", payload),
  synthesizeSpeech: (payload: AiSpeechRequestDto) =>
    apiPost<AiSpeechDto, AiSpeechRequestDto>("/ai/speech", payload),
  transcribeSpeech: (payload: AiTranscriptionRequestDto) =>
    apiPost<AiTranscriptionDto, AiTranscriptionRequestDto>("/ai/transcriptions", payload),
  managerSummary: () => apiGet<ManagerSummaryDto>("/analytics/manager"),
  managerReports: () => apiGet<ManagerReportsDto>("/analytics/manager/reports"),
  employeeProfile: (id?: string) =>
    apiGet<EmployeeProfileDto>(`/analytics/manager/employees/${encodeURIComponent(id || "1")}`),
  assignEmployeeCourse: (id: string, payload: EmployeeCourseAssignRequestDto) =>
    apiPost<EmployeeCourseAssignedDto, EmployeeCourseAssignRequestDto>(
      `/analytics/manager/employees/${encodeURIComponent(id)}/course`,
      payload,
    ),
  sessionOptions: () => apiGet<SessionOptionsDto>("/trainings/session-options"),
  createTrainingSession: (payload: TrainingSessionCreateRequestDto) =>
    apiPost<TrainingSessionCreatedDto, TrainingSessionCreateRequestDto>("/trainings/sessions", payload),
  addTrainingMessage: (sessionId: string, payload: TrainingMessageCreateRequestDto) =>
    apiPost<TrainingMessageCreatedDto, TrainingMessageCreateRequestDto>(
      `/trainings/sessions/${encodeURIComponent(sessionId)}/messages`,
      payload,
    ),
  trainingSessionDetail: (sessionId: string) =>
    apiGet<TrainingSessionDetailDto>(`/trainings/sessions/${encodeURIComponent(sessionId)}`),
  completeTrainingSession: (sessionId: string, payload: TrainingSessionCompleteRequestDto) =>
    apiPost<TrainingSessionCompletedDto, TrainingSessionCompleteRequestDto>(
      `/trainings/sessions/${encodeURIComponent(sessionId)}/complete`,
      payload,
    ),
  getAdminUsers: () => apiGet<AdminUserDto[]>("/admin/users"),
  createAdminUser: (payload: AdminUserCreateRequestDto) =>
    apiPost<AdminUserDto, AdminUserCreateRequestDto>("/admin/users", payload),
  updateAdminUser: (id: string, payload: AdminUserUpdateRequestDto) =>
    apiPost<AdminUserDto, AdminUserUpdateRequestDto>(`/admin/users/${encodeURIComponent(id)}`, payload),
  getTestQuestions: () => apiGet<TestQuestionDto[]>("/admin/tests"),
  createTestQuestion: (payload: TestQuestionCreateRequestDto) =>
    apiPost<TestQuestionDto, TestQuestionCreateRequestDto>("/admin/tests", payload),
  getCaseTemplates: () => apiGet<CaseTemplateDto[]>("/admin/cases"),
  createCaseTemplate: (payload: CaseTemplateCreateRequestDto) =>
    apiPost<CaseTemplateDto, CaseTemplateCreateRequestDto>("/admin/cases", payload),
  getObjectionTemplates: () => apiGet<ObjectionTemplateDto[]>("/admin/objections"),
  createObjectionTemplate: (payload: ObjectionTemplateCreateRequestDto) =>
    apiPost<ObjectionTemplateDto, ObjectionTemplateCreateRequestDto>("/admin/objections", payload),
  getTrainingCallScripts: () => apiGet<CallScriptDto[]>("/trainings/call-scripts"),
  getCallScripts: () => apiGet<CallScriptDto[]>("/admin/call-scripts"),
  createCallScript: (payload: CallScriptCreateRequestDto) =>
    apiPost<CallScriptDto, CallScriptCreateRequestDto>("/admin/call-scripts", payload),
  updateCallScript: (id: string, payload: CallScriptUpdateRequestDto) =>
    apiPost<CallScriptDto, CallScriptUpdateRequestDto>(`/admin/call-scripts/${encodeURIComponent(id)}`, payload),
  deleteCallScript: (id: string) =>
    apiPost<CallScriptDeletedDto>(`/admin/call-scripts/${encodeURIComponent(id)}/delete`),
};

export async function withDemoFallback<TData>(
  request: () => Promise<TData>,
  fallback: () => TData,
): Promise<TData> {
  try {
    return await request();
  } catch {
    return fallback();
  }
}

export function useApiData<TData>({
  queryKey,
  request,
  fallback,
}: {
  queryKey: QueryKey;
  request: () => Promise<TData>;
  fallback: () => TData;
}) {
  return useQuery({
    queryKey,
    queryFn: request,
    initialData: fallback,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export const frontendFallbacks = {
  currentUser: getCurrentUser,
  profile: getProfileSummary,
  dashboard: getDashboardSummary,
  notifications: getNotifications,
  weakTopics: getWeakTopics,
  trainingHistory: getTrainingHistory,
  managerSummary: getManagerSummary,
  managerReports: getManagerReports,
  employeeProfile: getEmployeeProfile,
  sessionOptions: getSessionOptions,
};
