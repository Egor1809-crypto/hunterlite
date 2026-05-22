import type {
  AdminUserCreateRequestDto,
  AdminUserDto,
  AdminUserUpdateRequestDto,
  TestQuestionDto,
  TestQuestionCreateRequestDto,
  CaseTemplateDto,
  CaseTemplateCreateRequestDto,
  ObjectionTemplateDto,
  ObjectionTemplateCreateRequestDto,
  CallScriptDto,
  CallScriptCreateRequestDto,
  CallScriptUpdateRequestDto,
} from "@/lib/api-contracts";
import type { FrontendApiDataSource } from "../../routes/frontend-api-handlers";
import { hashPassword } from "../auth/password-hash";

type PrismaArgs = Record<string, unknown>;
type UserRecord = {
  id: string;
  email: string;
  fullName: string;
  status: AdminUserDto["status"];
};
type MembershipRecord = {
  id: string;
  role: AdminUserDto["role"];
  status: AdminUserDto["status"];
  user: UserRecord;
};
type TestQuestionRecord = TestQuestionDto & { createdAt?: Date };
type CaseStepRecord = {
  id: string;
  caseId: string;
  question: string;
  answerFormat: string;
  options?: unknown;
  correctOptionId?: string | null;
  keywordRules?: unknown;
  referenceAnswer?: string | null;
  isRedFlag: boolean;
};
type CaseTemplateRecord = {
  id: string;
  title: string;
  introText: string;
  attachments: string[];
  difficulty: CaseTemplateDto["difficulty"];
  tags: string[];
  steps: CaseStepRecord[];
};
type ObjectionTemplateRecord = {
  id: string;
  category: string;
  clientPhrase: string;
  targetRole: string;
  answerFormat: string;
  options?: unknown;
  correctOptionId?: string | null;
  keywordRules?: unknown;
  referenceAnswer: string;
  explanation?: string | null;
  difficulty: ObjectionTemplateDto["difficulty"];
};
type CallScriptNodeRecord = {
  id: string;
  scriptId: string;
  clientReplica: string;
  answerFormat: string;
  options?: unknown;
  keywordRules?: unknown;
  isSuccessEnd: boolean;
  isFailEnd: boolean;
};
type CallScriptRecord = {
  id: string;
  title: string;
  clientProfile: unknown;
  firstNodeId?: string | null;
  nodes: CallScriptNodeRecord[];
};

const mapAnswerFormat = (f: "options" | "text" | "voice" | string) => f === "options" ? "choice" : "text_manual";
const unmapAnswerFormat = (f: string): "options" | "text" => f === "choice" ? "options" : "text";

const mapTargetRole = (r: string) => r === "all" ? "both" : r;
const unmapTargetRole = (r: string): ObjectionTemplateDto["targetRole"] =>
  r === "both" ? "all" : (r as ObjectionTemplateDto["targetRole"]);

// Временный тип, чтобы не импортировать полный PrismaClient
export type AdminPrismaClient = {
  user: {
    create: (args: PrismaArgs) => Promise<UserRecord>;
    update: (args: PrismaArgs) => Promise<UserRecord>;
  };
  membership: {
    findMany: (args?: PrismaArgs) => Promise<MembershipRecord[]>;
    findFirst: (args?: PrismaArgs) => Promise<MembershipRecord | null>;
    create: (args: PrismaArgs) => Promise<MembershipRecord>;
    update: (args: PrismaArgs) => Promise<MembershipRecord>;
  };
  authAccount: {
    create: (args: PrismaArgs) => Promise<unknown>;
  };
  testQuestion: {
    findMany: (args?: PrismaArgs) => Promise<TestQuestionRecord[]>;
    create: (args: PrismaArgs) => Promise<TestQuestionRecord>;
  };
  caseTemplate: {
    findMany: (args?: PrismaArgs) => Promise<CaseTemplateRecord[]>;
    create: (args: PrismaArgs) => Promise<CaseTemplateRecord>;
  };
  objectionTemplate: {
    findMany: (args?: PrismaArgs) => Promise<ObjectionTemplateRecord[]>;
    create: (args: PrismaArgs) => Promise<ObjectionTemplateRecord>;
  };
  callScript: {
    findMany: (args?: PrismaArgs) => Promise<CallScriptRecord[]>;
    create: (args: PrismaArgs) => Promise<CallScriptRecord>;
    update: (args: PrismaArgs) => Promise<CallScriptRecord>;
    delete: (args: PrismaArgs) => Promise<unknown>;
  };
  organization: {
    findFirst: (args?: PrismaArgs) => Promise<{ id: string } | null>;
  }
};

const roleLabels: Record<AdminUserDto["role"], string> = {
  employee: "Юрист",
  manager: "Руководитель",
  admin: "Администратор",
};

const statusLabels: Record<AdminUserDto["status"], AdminUserDto["statusLabel"]> = {
  active: "Активен",
  blocked: "Заблокирован",
  invited: "Приглашён",
};

const mapMembershipToAdminUser = (membership: MembershipRecord): AdminUserDto => ({
  id: membership.user.id,
  name: membership.user.fullName,
  email: membership.user.email,
  role: membership.role,
  roleLabel: roleLabels[membership.role as AdminUserDto["role"]] ?? membership.role,
  status: membership.status,
  statusLabel: statusLabels[membership.status as AdminUserDto["status"]] ?? membership.status,
});

export const createAdminPrismaDataSource = (
  prisma: AdminPrismaClient,
  fallback: FrontendApiDataSource,
): Pick<FrontendApiDataSource, "getAdminUsers" | "createAdminUser" | "updateAdminUser" | "getTestQuestions" | "createTestQuestion" | "getCaseTemplates" | "createCaseTemplate" | "getObjectionTemplates" | "createObjectionTemplate" | "getCallScripts" | "createCallScript" | "updateCallScript" | "deleteCallScript"> => ({
  getAdminUsers: async (): Promise<AdminUserDto[]> => {
    try {
      const records = await prisma.membership.findMany({
        include: { user: true },
        orderBy: { createdAt: "asc" },
      });

      return records.map(mapMembershipToAdminUser);
    } catch {
      return fallback.getAdminUsers();
    }
  },

  createAdminUser: async (payload: AdminUserCreateRequestDto): Promise<AdminUserDto | null> => {
    try {
      const org = await prisma.organization.findFirst();
      if (!org) return null;

      const user = await prisma.user.create({
        data: {
          email: payload.email,
          fullName: payload.name,
          status: "active",
        },
      });

      await prisma.authAccount.create({
        data: {
          userId: user.id,
          provider: "password",
          providerUserId: payload.email,
          passwordHash: await hashPassword(payload.password || "hunterlite-demo"),
        },
      });

      const membership = await prisma.membership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: payload.role,
          status: "active",
        },
        include: { user: true },
      });

      return mapMembershipToAdminUser(membership);
    } catch {
      return fallback.createAdminUser(payload);
    }
  },

  updateAdminUser: async (id: string, payload: AdminUserUpdateRequestDto): Promise<AdminUserDto | null> => {
    try {
      const membership = await prisma.membership.findFirst({
        where: { userId: id },
        include: { user: true },
      });

      if (!membership) return null;

      const status = payload.status;
      if (status) {
        await prisma.user.update({
          where: { id },
          data: { status },
        });
      }

      const updated = await prisma.membership.update({
        where: { id: membership.id },
        data: {
          ...(payload.role ? { role: payload.role } : {}),
          ...(status ? { status } : {}),
        },
        include: { user: true },
      });

      return mapMembershipToAdminUser(updated);
    } catch {
      return fallback.updateAdminUser(id, payload);
    }
  },

  getTestQuestions: async (): Promise<TestQuestionDto[]> => {
    try {
      const records = await prisma.testQuestion.findMany({
        orderBy: { createdAt: "desc" },
      });

      if (!records.length) return fallback.getTestQuestions();

      return records.map((r) => ({
        id: r.id,
        title: r.title,
        text: r.text,
        type: r.type,
        difficulty: r.difficulty,
        needsUpdate: r.needsUpdate,
        options: r.options,
        correctAnswer: r.correctAnswer,
        explanation: r.explanation,
        tags: r.tags,
      }));
    } catch {
      return fallback.getTestQuestions();
    }
  },

  createTestQuestion: async (
    payload: TestQuestionCreateRequestDto,
  ): Promise<TestQuestionDto | null> => {
    try {
      // Ищем дефолтную организацию (в MVP у нас одна)
      const org = await prisma.organization.findFirst();
      if (!org) return null;

      const created = await prisma.testQuestion.create({
        data: {
          organizationId: org.id,
          title: payload.title,
          text: payload.text,
          type: payload.type,
          difficulty: payload.difficulty,
          options: payload.options ?? null,
          correctAnswer: payload.correctAnswer ?? {},
          explanation: payload.explanation ?? null,
          tags: payload.tags ?? [],
        },
      });

      return {
        id: created.id,
        title: created.title,
        text: created.text,
        type: created.type,
        difficulty: created.difficulty,
        needsUpdate: created.needsUpdate,
        options: created.options,
        correctAnswer: created.correctAnswer,
        explanation: created.explanation,
        tags: created.tags,
      };
    } catch {
      return fallback.createTestQuestion(payload);
    }
  },

  getCaseTemplates: async (): Promise<CaseTemplateDto[]> => {
    try {
      const records = await prisma.caseTemplate.findMany({
        include: { steps: true },
        orderBy: { title: "asc" },
      });

      return records.map((r) => ({
        id: r.id,
        title: r.title,
        introText: r.introText,
        attachments: r.attachments,
        difficulty: r.difficulty,
        tags: r.tags,
        steps: r.steps.map((s) => ({
          id: s.id,
          caseId: s.caseId,
          question: s.question,
          answerFormat: unmapAnswerFormat(s.answerFormat),
          options: s.options,
          correctOptionId: s.correctOptionId,
          keywordRules: s.keywordRules,
          referenceAnswer: s.referenceAnswer,
          isRedFlag: s.isRedFlag,
        })),
      }));
    } catch {
      return fallback.getCaseTemplates();
    }
  },

  createCaseTemplate: async (
    payload: CaseTemplateCreateRequestDto,
  ): Promise<CaseTemplateDto | null> => {
    try {
      const org = await prisma.organization.findFirst();
      if (!org) return null;

      const created = await prisma.caseTemplate.create({
        data: {
          organizationId: org.id,
          title: payload.title,
          introText: payload.introText,
          attachments: payload.attachments ?? [],
          difficulty: payload.difficulty,
          tags: payload.tags ?? [],
          steps: {
            create: payload.steps.map((s) => ({
              question: s.question,
              answerFormat: mapAnswerFormat(s.answerFormat),
              options: s.options ?? null,
              correctOptionId: s.correctOptionId ?? null,
              keywordRules: s.keywordRules ?? null,
              referenceAnswer: s.referenceAnswer ?? null,
              isRedFlag: s.isRedFlag ?? false,
            })),
          },
        },
        include: { steps: true },
      });

      return {
        id: created.id,
        title: created.title,
        introText: created.introText,
        attachments: created.attachments,
        difficulty: created.difficulty,
        tags: created.tags,
        steps: created.steps.map((s) => ({
          id: s.id,
          caseId: s.caseId,
          question: s.question,
          answerFormat: unmapAnswerFormat(s.answerFormat),
          options: s.options,
          correctOptionId: s.correctOptionId,
          keywordRules: s.keywordRules,
          referenceAnswer: s.referenceAnswer,
          isRedFlag: s.isRedFlag,
        })),
      };
    } catch {
      return fallback.createCaseTemplate(payload);
    }
  },

  getObjectionTemplates: async (): Promise<ObjectionTemplateDto[]> => {
    try {
      const records = await prisma.objectionTemplate.findMany({
        orderBy: { category: "asc" },
      });

      return records.map((r) => ({
        id: r.id,
        category: r.category,
        clientPhrase: r.clientPhrase,
        targetRole: unmapTargetRole(r.targetRole),
        answerFormat: unmapAnswerFormat(r.answerFormat),
        options: r.options,
        correctOptionId: r.correctOptionId,
        keywordRules: r.keywordRules,
        referenceAnswer: r.referenceAnswer,
        explanation: r.explanation,
        difficulty: r.difficulty,
      }));
    } catch {
      return fallback.getObjectionTemplates();
    }
  },

  createObjectionTemplate: async (
    payload: ObjectionTemplateCreateRequestDto,
  ): Promise<ObjectionTemplateDto | null> => {
    try {
      const org = await prisma.organization.findFirst();
      if (!org) return null;

      const created = await prisma.objectionTemplate.create({
        data: {
          organizationId: org.id,
          category: payload.category,
          clientPhrase: payload.clientPhrase,
          targetRole: mapTargetRole(payload.targetRole),
          answerFormat: mapAnswerFormat(payload.answerFormat),
          options: payload.options ?? null,
          correctOptionId: payload.correctOptionId ?? null,
          keywordRules: payload.keywordRules ?? null,
          referenceAnswer: payload.referenceAnswer,
          explanation: payload.explanation ?? null,
          difficulty: payload.difficulty,
        },
      });

      return {
        id: created.id,
        category: created.category,
        clientPhrase: created.clientPhrase,
        targetRole: unmapTargetRole(created.targetRole),
        answerFormat: unmapAnswerFormat(created.answerFormat),
        options: created.options,
        correctOptionId: created.correctOptionId,
        keywordRules: created.keywordRules,
        referenceAnswer: created.referenceAnswer,
        explanation: created.explanation,
        difficulty: created.difficulty,
      };
    } catch {
      return fallback.createObjectionTemplate(payload);
    }
  },

  getCallScripts: async (): Promise<CallScriptDto[]> => {
    try {
      const records = await prisma.callScript.findMany({
        include: { nodes: true },
        orderBy: { title: "asc" },
      });

      return records.map((r) => ({
        id: r.id,
        title: r.title,
        clientProfile: r.clientProfile,
        firstNodeId: r.firstNodeId ?? undefined,
        nodes: r.nodes.map((n) => ({
          id: n.id,
          scriptId: n.scriptId,
          clientReplica: n.clientReplica,
          answerFormat: unmapAnswerFormat(n.answerFormat),
          options: n.options,
          keywordRules: n.keywordRules,
          isSuccessEnd: n.isSuccessEnd,
          isFailEnd: n.isFailEnd,
        })),
      }));
    } catch {
      return fallback.getCallScripts();
    }
  },

  createCallScript: async (
    payload: CallScriptCreateRequestDto,
  ): Promise<CallScriptDto | null> => {
    try {
      const org = await prisma.organization.findFirst();
      if (!org) return null;

      const created = await prisma.callScript.create({
        data: {
          organizationId: org.id,
          title: payload.title,
          clientProfile: payload.clientProfile ?? {},
          firstNodeId: payload.firstNodeId ?? null,
          nodes: {
            create: payload.nodes.map((n) => ({
              clientReplica: n.clientReplica,
              answerFormat: mapAnswerFormat(n.answerFormat),
              options: n.options ?? null,
              keywordRules: n.keywordRules ?? null,
              isSuccessEnd: n.isSuccessEnd ?? false,
              isFailEnd: n.isFailEnd ?? false,
            })),
          },
        },
        include: { nodes: true },
      });

      return {
        id: created.id,
        title: created.title,
        clientProfile: created.clientProfile,
        firstNodeId: created.firstNodeId ?? undefined,
        nodes: created.nodes.map((n) => ({
          id: n.id,
          scriptId: n.scriptId,
          clientReplica: n.clientReplica,
          answerFormat: unmapAnswerFormat(n.answerFormat),
          options: n.options,
          keywordRules: n.keywordRules,
          isSuccessEnd: n.isSuccessEnd,
          isFailEnd: n.isFailEnd,
        })),
      };
    } catch (error) {
      console.error("Prisma createCallScript error:", error);
      return fallback.createCallScript(payload);
    }
  },

  updateCallScript: async (
    id: string,
    payload: CallScriptUpdateRequestDto,
  ): Promise<CallScriptDto | null> => {
    try {
      const updated = await prisma.callScript.update({
        where: { id },
        data: {
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.clientProfile !== undefined ? { clientProfile: payload.clientProfile } : {}),
          ...(payload.nodes
            ? {
                nodes: {
                  deleteMany: {},
                  create: payload.nodes.map((n) => ({
                    clientReplica: n.clientReplica,
                    answerFormat: mapAnswerFormat(n.answerFormat),
                    options: n.options ?? null,
                    keywordRules: n.keywordRules ?? null,
                    isSuccessEnd: n.isSuccessEnd ?? false,
                    isFailEnd: n.isFailEnd ?? false,
                  })),
                },
              }
            : {}),
        },
        include: { nodes: true },
      });

      return {
        id: updated.id,
        title: updated.title,
        clientProfile: updated.clientProfile,
        firstNodeId: updated.firstNodeId ?? undefined,
        nodes: updated.nodes.map((n) => ({
          id: n.id,
          scriptId: n.scriptId,
          clientReplica: n.clientReplica,
          answerFormat: unmapAnswerFormat(n.answerFormat),
          options: n.options,
          keywordRules: n.keywordRules,
          isSuccessEnd: n.isSuccessEnd,
          isFailEnd: n.isFailEnd,
        })),
      };
    } catch {
      return fallback.updateCallScript(id, payload);
    }
  },

  deleteCallScript: async (id: string): Promise<boolean> => {
    try {
      await prisma.callScript.delete({
        where: { id },
      });

      return true;
    } catch {
      return fallback.deleteCallScript(id);
    }
  },
});
