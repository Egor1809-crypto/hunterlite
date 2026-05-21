import type { CurrentUserDto, ProfileSummaryDto } from "@/lib/api-contracts";
import type { AppRole } from "@/lib/demo-auth-state";
import { isPassingScore } from "@/lib/training-logic";
import type { FrontendApiDataSource } from "../../routes/frontend-api-handlers";

type PrismaUserRecord = {
  id: string;
  email: string;
  fullName: string;
  status: string;
};

type PrismaMembershipRecord = {
  role: string;
  status: string;
  user: PrismaUserRecord;
};

export type UsersPrismaClient = {
  membership: {
    findFirst: (args: {
      where: {
        role?: AppRole;
        user?: { email?: string };
      };
      include: { user: true };
      orderBy?: { createdAt: "asc" | "desc" };
    }) => Promise<PrismaMembershipRecord | null>;
  };
};

const roleLabels: Record<AppRole, string> = {
  employee: "Юрист-консультант",
  manager: "Руководитель",
  admin: "Администратор",
  client: "Клиент",
};

const scoreByRole: Record<AppRole, Pick<CurrentUserDto, "avgScore" | "examPassed" | "weeklyTrainings">> = {
  employee: { avgScore: 82, examPassed: isPassingScore(82), weeklyTrainings: 6 },
  manager: { avgScore: 88, examPassed: true, weeklyTrainings: 0 },
  admin: { avgScore: 0, examPassed: true, weeklyTrainings: 0 },
  client: { avgScore: 0, examPassed: false, weeklyTrainings: 0 },
};

const emailByRole: Partial<Record<AppRole, string>> = {
  employee: "a.petrova@hunterlite.ru",
  manager: "manager@hunterlite.ru",
  admin: "admin@hunterlite.ru",
};

const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;

const statusLabel = (status: string): CurrentUserDto["status"] =>
  status === "active" ? "Допущен" : "Активен";

const mapMembershipToCurrentUser = (membership: PrismaMembershipRecord): CurrentUserDto => {
  const role = membership.role as AppRole;

  return {
    id: membership.user.id,
    name: membership.user.fullName,
    firstName: firstNameOf(membership.user.fullName),
    role,
    roleLabel: roleLabels[role],
    email: membership.user.email,
    status: statusLabel(membership.status),
    ...scoreByRole[role],
  };
};

const findMembershipByRole = async (prisma: UsersPrismaClient, role: AppRole) =>
  prisma.membership.findFirst({
    where: emailByRole[role] ? { role, user: { email: emailByRole[role] } } : { role },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

export const createUsersPrismaDataSource = (
  prisma: UsersPrismaClient,
  fallback: FrontendApiDataSource,
): Pick<FrontendApiDataSource, "getCurrentUser" | "getProfileSummary"> => {
  const getCurrentUser = async (role: AppRole = "employee"): Promise<CurrentUserDto> => {
    if (role === "client") return fallback.getCurrentUser(role);

    try {
      const membership = await findMembershipByRole(prisma, role);

      if (!membership) return fallback.getCurrentUser(role);
      return mapMembershipToCurrentUser(membership);
    } catch {
      return fallback.getCurrentUser(role);
    }
  };

  return {
    getCurrentUser,
    getProfileSummary: async (role?: AppRole): Promise<ProfileSummaryDto> => ({
      user: await getCurrentUser(role),
      weakTopics: (await fallback.getProfileSummary(role)).weakTopics,
    }),
  };
};
