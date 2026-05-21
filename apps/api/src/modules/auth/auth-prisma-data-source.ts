import { createHash, randomBytes } from "node:crypto";
import type { AuthSessionDto, CurrentUserDto } from "@/lib/api-contracts";
import { getRoleHome, type AppRole } from "@/lib/demo-auth-state";
import { isPassingScore } from "@/lib/training-logic";
import type { AuthDataSource } from "./auth-handlers";
import { hashPassword, verifyPassword } from "./password-hash";

type UserStatus = "active" | "blocked" | "invited" | string;

type MembershipRecord = {
  role: string;
  status: UserStatus;
};

type UserRecord = {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
  memberships: MembershipRecord[];
};

type AuthAccountRecord = {
  id: string;
  provider: string;
  passwordHash: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  user: UserRecord;
};

type UserAuthAccountRecord = Omit<AuthAccountRecord, "user">;

type SessionRecord = {
  id: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: UserRecord;
};

type PasswordResetRecord = {
  id: string;
  expiresAt: Date;
  usedAt: Date | null;
  user: UserRecord & { authAccounts: UserAuthAccountRecord[] };
};

export type AuthPrismaClient = {
  authAccount: {
    findFirst: (args: {
      where: { provider: "password"; providerUserId: string };
      include: { user: { include: { memberships: true } } };
    }) => Promise<AuthAccountRecord | null>;
    update: (args: {
      where: { id: string };
      data: { passwordHash?: string; failedLoginAttempts?: number; lockedUntil?: Date | null };
    }) => Promise<unknown>;
  };
  passwordResetToken: {
    create: (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => Promise<{ id: string }>;
    findFirst: (args: {
      where: { tokenHash: string; usedAt: null; expiresAt: { gt: Date } };
      include: { user: { include: { memberships: true; authAccounts: true } } };
    }) => Promise<PasswordResetRecord | null>;
    update: (args: { where: { id: string }; data: { usedAt: Date } }) => Promise<unknown>;
  };
  session: {
    create: (args: { data: { userId: string; expiresAt: Date } }) => Promise<{ id: string }>;
    findUnique: (args: {
      where: { id: string };
      include: { user: { include: { memberships: true } } };
    }) => Promise<SessionRecord | null>;
    update: (args: { where: { id: string }; data: { revokedAt: Date } }) => Promise<unknown>;
  };
};

export type AuthLockoutOptions = {
  maxFailedAttempts?: number;
  lockMs?: number;
  passwordResetTokenMs?: number;
  now?: () => Date;
};

const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

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

const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;

const statusLabel = (status: UserStatus): CurrentUserDto["status"] =>
  status === "active" ? "Допущен" : "Активен";

const userToSession = (user: UserRecord): AuthSessionDto | null => {
  const role = user.memberships[0]?.role as AppRole | undefined;

  if (!role) return null;

  return {
    user: {
      id: user.id,
      name: user.fullName,
      firstName: firstNameOf(user.fullName),
      role,
      roleLabel: roleLabels[role],
      email: user.email,
      status: statusLabel(user.memberships[0]?.status ?? user.status),
      ...scoreByRole[role],
    },
    homePath: getRoleHome(role),
  };
};

export const createAuthPrismaDataSource = (
  prisma: AuthPrismaClient,
  {
    maxFailedAttempts = 5,
    lockMs = 15 * 60 * 1000,
    passwordResetTokenMs = 60 * 60 * 1000,
    now = () => new Date(),
  }: AuthLockoutOptions = {},
): AuthDataSource => ({
  login: async ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const currentTime = now();
    const account = await prisma.authAccount.findFirst({
      where: {
        provider: "password",
        providerUserId: normalizedEmail,
      },
      include: {
        user: {
          include: {
            memberships: true,
          },
        },
      },
    });
    const session = account ? userToSession(account.user) : null;

    if (!account || !session) return null;
    if (account.lockedUntil && account.lockedUntil.getTime() > currentTime.getTime()) {
      return null;
    }
    if (!(await verifyPassword(password, account.passwordHash))) {
      const failedLoginAttempts = account.failedLoginAttempts + 1;

      await prisma.authAccount.update({
        where: { id: account.id },
        data: {
          failedLoginAttempts,
          lockedUntil:
            failedLoginAttempts >= maxFailedAttempts
              ? new Date(currentTime.getTime() + lockMs)
              : null,
        },
      });

      return null;
    }

    if (account.failedLoginAttempts > 0 || account.lockedUntil) {
      await prisma.authAccount.update({
        where: { id: account.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    const createdSession = await prisma.session.create({
      data: {
        userId: account.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      sessionId: createdSession.id,
      session,
    };
  },

  session: async (sessionId) => {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            memberships: true,
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;

    return userToSession(session.user);
  },

  logout: async (sessionId) => {
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  },

  requestPasswordReset: async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const account = await prisma.authAccount.findFirst({
      where: {
        provider: "password",
        providerUserId: normalizedEmail,
      },
      include: {
        user: {
          include: {
            memberships: true,
          },
        },
      },
    });

    if (!account) return null;

    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: account.user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(now().getTime() + passwordResetTokenMs),
      },
    });

    return { token };
  },

  completePasswordReset: async ({ token, newPassword }) => {
    const currentTime = now();
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hashResetToken(token),
        usedAt: null,
        expiresAt: {
          gt: currentTime,
        },
      },
      include: {
        user: {
          include: {
            memberships: true,
            authAccounts: true,
          },
        },
      },
    });

    const passwordAccount = resetToken?.user.authAccounts.find((account) => account.provider === "password");

    if (!resetToken || !passwordAccount) return false;

    await prisma.authAccount.update({
      where: { id: passwordAccount.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: currentTime },
    });

    return true;
  },
});
