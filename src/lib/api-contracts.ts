import type { AppRole } from "@/lib/demo-auth-state";

export type UserStatusLabel = "Допущен" | "Активен";

export type CurrentUserDto = {
  id: string;
  name: string;
  firstName: string;
  role: AppRole;
  roleLabel: string;
  email: string;
  status: UserStatusLabel;
  avgScore: number;
  examPassed: boolean;
  weeklyTrainings: number;
};

export type WeakTopicDto = {
  id: string;
  topic: string;
  errors: number;
  recommendation: string;
};

export type NotificationTone = "info" | "success" | "warning" | "destructive";

export type NotificationDto = {
  id: string;
  title: string;
  body: string;
  time: string;
  tone: NotificationTone;
  unread: boolean;
  actionUrl?: string;
};

export type ProfileSummaryDto = {
  user: CurrentUserDto;
  weakTopics: WeakTopicDto[];
};

export type TrainingHistoryItemDto = {
  id: string;
  date: string;
  mode: string;
  topic: string;
  score: number;
  status: "Сдан" | "Не сдан" | "Завершено";
};

export type DashboardSummaryDto = {
  user: CurrentUserDto;
  weakTopics: WeakTopicDto[];
  notifications: NotificationDto[];
  lastSession: TrainingHistoryItemDto;
  nextTask: {
    title: string;
    dueDate: string;
    readiness: number;
  };
};

export type EmployeeStatus = "Допущен" | "Не допущен" | "На проверке" | "Требуется курс";
export type EmployeeExamStatus = "Сдан" | "Не сдан" | "На проверке";

export type EmployeeDto = {
  id: string;
  name: string;
  score: number;
  exam: EmployeeExamStatus;
  status: EmployeeStatus;
  weak: string;
  lastActive: string;
};

export type ManagerSummaryDto = {
  employees: EmployeeDto[];
  kpi: {
    totalEmployees: number;
    allowedEmployees: number;
    blockedEmployees: number;
    avgScore: number;
    weeklyExams: number;
    weakestTopic: string;
  };
  scoreTrend: Array<{ week: string; score: number }>;
  topWeakTopics: Array<{ topic: string; errors: number }>;
};

export type ManagerReportsDto = {
  periodLabel: string;
  summary: {
    passedExams: number;
    failedExams: number;
    reviewExams: number;
    avgScore: number;
    completedTrainings: number;
    activeEmployees: number;
  };
  scoreDistribution: Array<{
    range: string;
    employees: number;
    percent: number;
    status: "destructive" | "warning" | "success";
  }>;
  weakTopics: Array<{
    topic: string;
    errors: number;
    affectedPercent: number;
    recommendation: string;
  }>;
  attention: Array<{
    employeeId: string;
    name: string;
    score: number;
    issue: string;
    action: string;
  }>;
  recommendations: string[];
};

export type EmployeeProfileDto = {
  employee: EmployeeDto;
  history: TrainingHistoryItemDto[];
  weakTopics: WeakTopicDto[];
  strongTopics: string[];
  recommendation: string;
};

export type EmployeeCourseAssignRequestDto = {
  topic: string;
  reason?: string;
};

export type EmployeeCourseAssignedDto = {
  assigned: true;
  employeeId: string;
  topic: string;
  notificationId: string;
};

export type SessionOptionsDto = {
  topics: string[];
  difficulties: string[];
  characters: string[];
  formats: string[];
};

export type DialogMessageDto = {
  from: "ai" | "user";
  text: string;
};

export type TrainingModeDto = "talk" | "exam" | "chat_test";
export type TrainingDifficultyDto = "basic" | "medium" | "hard";
export type TrainingFormatDto = "text" | "voice" | "sequence";
export type AiClientCharacterDto = "anxious" | "aggressive" | "skeptical" | "distrustful" | "rushed";

export type TrainingEvaluationCriterionDto =
  | "legal_accuracy"
  | "answer_structure"
  | "safe_wording"
  | "empathy"
  | "objection_handling";

export type TrainingSessionCreateRequestDto = {
  topic: string;
  mode: TrainingModeDto;
  difficulty: TrainingDifficultyDto;
  format: TrainingFormatDto;
  character: AiClientCharacterDto;
  questionCount?: number;
};

export type TrainingSessionCreatedDto = {
  id: string;
  topic: string;
  mode: TrainingModeDto;
  difficulty: TrainingDifficultyDto;
  format: TrainingFormatDto;
  character: AiClientCharacterDto;
  questionCount: number;
  status: "draft" | "active" | "completed" | "failed";
};

export type TrainingMessageCreateRequestDto = {
  from: "ai" | "user";
  text: string;
};

export type TrainingMessageCreatedDto = {
  id: string;
  sessionId: string;
  from: "ai" | "user";
  text: string;
};

export type TrainingSessionCompleteRequestDto = {
  score: number;
  criteria: Array<{
    criterion: TrainingEvaluationCriterionDto;
    score: number;
    comment: string;
  }>;
  mistakes: string[];
  recommendations: string[];
};

export type TrainingSessionCompletedDto = {
  id: string;
  score: number;
  passed: boolean;
  status: "completed" | "failed";
};

export type TrainingSessionDetailDto = {
  id: string;
  date: string;
  mode: string;
  topic: string;
  score: number;
  status: "Сдан" | "Не сдан" | "Завершено";
  criteria: TrainingSessionCompleteRequestDto["criteria"];
  mistakes: string[];
  recommendations: string[];
  messages: TrainingMessageCreatedDto[];
};

export type AiTrainingReplyRequestDto = {
  sessionId?: string;
  topic: string;
  mode: TrainingModeDto;
  difficulty?: TrainingDifficultyDto;
  character?: AiClientCharacterDto;
  step: number;
  totalSteps: number;
  userMessage: string;
  messages: DialogMessageDto[];
  memory?: {
    summary?: string;
    facts?: string[];
  };
  scriptContext?: {
    title?: string;
    nextClientReplica?: string;
    keywordRules?: unknown;
  };
};

export type AiTrainingReplyDto = {
  reply: string;
  scoreDelta: number;
  mistakes: string[];
  recommendations: string[];
  sessionEnded: boolean;
};

export type AiSpeechRequestDto = {
  text: string;
};

export type AiSpeechDto = {
  audioBase64: string;
  contentType: string;
};

export type AiTranscriptionRequestDto = {
  audioBase64: string;
  mimeType: string;
  fileName?: string;
};

export type AiTranscriptionDto = {
  text: string;
};

export type AuthRegisterRequestDto = {
  email: string;
  password: string;
  fullName: string;
};

export type AuthLoginRequestDto = {
  email: string;
  password?: string;
};

export type AuthPasswordResetRequestDto = {
  email: string;
};

export type AuthPasswordResetRequestedDto = {
  sent: true;
  devToken?: string;
};

export type AuthPasswordResetCompleteDto = {
  token: string;
  newPassword: string;
};

export type AuthPasswordResetCompletedDto = {
  reset: true;
};

export type AuthSessionDto = {
  user: CurrentUserDto;
  homePath: string;
};

export type AdminUserDto = {
  id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  roleLabel: string;
  status: "active" | "blocked" | "invited";
  statusLabel: "Активен" | "Заблокирован" | "Приглашён";
};

export type AdminUserCreateRequestDto = {
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  password?: string;
};

export type AdminUserUpdateRequestDto = {
  role?: "employee" | "manager" | "admin";
  status?: "active" | "blocked" | "invited";
};

export type TestQuestionDto = {
  id: string;
  title: string;
  text: string;
  type: "single_choice" | "multiple_choice" | "true_false" | "text_input" | "number_input" | "matching";
  difficulty: "basic" | "medium" | "hard";
  needsUpdate: boolean;
  options?: unknown;
  correctAnswer: unknown;
  explanation?: string;
  tags?: string[];
};

export type TestQuestionCreateRequestDto = Omit<TestQuestionDto, "id" | "needsUpdate">;

export type CaseStepDto = {
  id: string;
  caseId: string;
  question: string;
  answerFormat: "options" | "text" | "voice";
  options?: unknown;
  correctOptionId?: string;
  keywordRules?: unknown;
  referenceAnswer?: string;
  isRedFlag: boolean;
};

export type CaseTemplateDto = {
  id: string;
  title: string;
  introText: string;
  attachments: string[];
  difficulty: "basic" | "medium" | "hard";
  tags: string[];
  steps?: CaseStepDto[];
};

export type CaseStepCreateRequestDto = Omit<CaseStepDto, "id" | "caseId">;
export type CaseTemplateCreateRequestDto = Omit<CaseTemplateDto, "id" | "steps"> & {
  steps: CaseStepCreateRequestDto[];
};

export type ObjectionTemplateDto = {
  id: string;
  category: string;
  clientPhrase: string;
  targetRole: "manager" | "lawyer" | "all";
  answerFormat: "options" | "text" | "voice";
  options?: unknown;
  correctOptionId?: string;
  keywordRules?: unknown;
  referenceAnswer: string;
  explanation?: string;
  difficulty: "basic" | "medium" | "hard";
};

export type ObjectionTemplateCreateRequestDto = Omit<ObjectionTemplateDto, "id">;

export type CallScriptNodeDto = {
  id: string;
  scriptId: string;
  clientReplica: string;
  answerFormat: "options" | "text" | "voice";
  options?: unknown;
  keywordRules?: unknown;
  isSuccessEnd: boolean;
  isFailEnd: boolean;
};

export type CallScriptDto = {
  id: string;
  title: string;
  clientProfile: unknown;
  firstNodeId?: string;
  nodes?: CallScriptNodeDto[];
};

export type CallScriptNodeCreateRequestDto = Omit<CallScriptNodeDto, "id" | "scriptId">;
export type CallScriptCreateRequestDto = Omit<CallScriptDto, "id" | "nodes"> & {
  nodes: CallScriptNodeCreateRequestDto[];
};
export type CallScriptUpdateRequestDto = Partial<Omit<CallScriptCreateRequestDto, "nodes">> & {
  nodes?: CallScriptNodeCreateRequestDto[];
};
export type CallScriptDeletedDto = {
  deleted: true;
  id: string;
};
