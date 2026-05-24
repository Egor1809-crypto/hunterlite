import type { CurrentUserDto, ProfileSummaryDto } from "@/lib/api-contracts";
import type { AppRole } from "@/lib/demo-auth-state";
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
        userId?: string;
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
    roleLabel: roleLabels[role] ?? role,
    email: membership.user.email,
    status: statusLabel(membership.status),
    avgScore: 0,
    examPassed: false,
    weeklyTrainings: 0,
  };
};

export const createUsersPrismaDataSource = (
  prisma: UsersPrismaClient,
): Pick<FrontendApiDataSource, "getCurrentUser"> => {
  const getCurrentUser = async (userId: string): Promise<CurrentUserDto> => {
    const membership = await prisma.membership.findFirst({
      where: { userId },
      include: { user: true },
    });

    if (!membership) {
      return {
        id: userId,
        name: "Пользователь",
        firstName: "Пользователь",
        role: "employee",
        roleLabel: roleLabels.employee,
        email: "",
        status: "Активен",
        avgScore: 0,
        examPassed: false,
        weeklyTrainings: 0,
      };
    }

    return mapMembershipToCurrentUser(membership);
  };

  return {
    getCurrentUser,
  };
};
