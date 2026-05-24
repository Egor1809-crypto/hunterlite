import { createHash, randomBytes } from "node:crypto";
import type { AuthSessionDto, CurrentUserDto } from "@/lib/api-contracts";
import { getRoleHome, type AppRole } from "@/lib/demo-auth-state";
import { isPassingScore } from "@/lib/training-logic";
import type { AuthDataSource } from "./auth-handlers";
import { hashPassword, verifyPassword } from "./password-hash";

type UserStatus = "active" | "blocked" | "invited" | string;
type MaybePromise<T> = T | Promise<T>;

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

type TelegramCodeRecord = {
  codeHash: string;
  expiresAt: Date;
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
    create: (args: {
      data: { userId: string; provider: "password"; providerUserId: string; passwordHash: string; failedLoginAttempts: 0; lockedUntil: null };
    }) => Promise<{ id: string }>;
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
  user?: {
    findFirst: (args: {
      where: { email?: string; memberships?: { some: { role?: "employee"; status?: "active" } } };
      include: { memberships: true };
      orderBy?: { createdAt: "asc" | "desc" };
    }) => Promise<UserRecord | null>;
    create: (args: {
      data: { email: string; fullName: string; status: "active" };
    }) => Promise<UserRecord>;
  };
  membership?: {
    create: (args: {
      data: { organizationId: string; userId: string; role: "employee"; status: "active" };
    }) => Promise<{ id: string }>;
  };
  organization?: {
    findFirst: (args: {
      where: { status: "active" };
      orderBy: { createdAt: "asc" };
    }) => Promise<{ id: string } | null>;
  };
};

export type AuthLockoutOptions = {
  maxFailedAttempts?: number;
  lockMs?: number;
  passwordResetTokenMs?: number;
  telegramCodeMs?: number;
  telegramLoginEmail?: string;
  sendTelegramCode?: (payload: { recipient: string; code: string }) => MaybePromise<boolean>;
  resolveTelegramChatId?: (phone: string) => number | undefined | Promise<number | undefined>;
  resolveTelegramUserName?: (phone: string) => string | undefined | Promise<string | undefined>;
  now?: () => Date;
};

const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");
const hashTelegramCode = (phone: string, code: string) =>
  createHash("sha256").update(`${phone}:${code}`).digest("hex");

const createTelegramCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

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
    telegramCodeMs = 5 * 60 * 1000,
    telegramLoginEmail,
    sendTelegramCode,
    resolveTelegramChatId,
    resolveTelegramUserName,
    now = () => new Date(),
  }: AuthLockoutOptions = {},
): AuthDataSource => {
  const telegramCodes = new Map<string, TelegramCodeRecord>();

  return {
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

  requestTelegramCode: async (phone) => {
    const code = createTelegramCode();
    telegramCodes.set(phone, {
      codeHash: hashTelegramCode(phone, code),
      expiresAt: new Date(now().getTime() + telegramCodeMs),
    });

    const isNumericChatId = /^\d{5,}$/.test(phone) && !phone.includes("+");
    const resolvedChatId = isNumericChatId ? undefined : await resolveTelegramChatId?.(phone);
    const chatId = isNumericChatId ? phone : resolvedChatId?.toString();

    if (chatId && sendTelegramCode) {
      const sent = await sendTelegramCode({ recipient: chatId, code });
      if (sent) return { code: undefined, sent: true };
    }

    return { code, sent: false };
  },

  loginWithTelegramCode: async ({ phone, code }) => {
    const record = telegramCodes.get(phone);
    const currentTime = now();

    if (!record || record.expiresAt.getTime() <= currentTime.getTime()) {
      telegramCodes.delete(phone);
      return null;
    }

    if (record.codeHash !== hashTelegramCode(phone, code)) return null;
    telegramCodes.delete(phone);

    let user: UserRecord | null = null;

    if (telegramLoginEmail) {
      user = await prisma.user?.findFirst({
        where: { email: telegramLoginEmail.trim().toLowerCase() },
        include: { memberships: true },
      }) ?? null;
    } else {
      const tgEmail = `tg-${phone.replace(/\D/g, "")}@hunterlite.tg`;
      user = await prisma.user?.findFirst({
        where: { email: tgEmail },
        include: { memberships: true },
      }) ?? null;

      if (!user && prisma.user && prisma.organization && prisma.membership) {
        const tgName = await resolveTelegramUserName?.(phone) || "Пользователь";
        const org = await prisma.organization.findFirst({
          where: { status: "active" },
          orderBy: { createdAt: "asc" },
        });
        if (org) {
          const created = await prisma.user.create({
            data: { email: tgEmail, fullName: tgName, status: "active" },
          });
          await prisma.membership.create({
            data: { organizationId: org.id, userId: created.id, role: "employee", status: "active" },
          });
          user = await prisma.user.findFirst({
            where: { email: tgEmail },
            include: { memberships: true },
          }) ?? null;
        }
      }
    }

    const session = user ? userToSession(user) : null;

    if (!user || !session) return null;

    const createdSession = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      sessionId: createdSession.id,
      session,
    };
  },

  register: async ({ email, password, fullName }: { email: string; password: string; fullName: string }) => {
    const normalizedEmail = email.trim().toLowerCase();

    const existingAccount = await prisma.authAccount.findFirst({
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

    if (existingAccount) return null;

    const org = await prisma.organization?.findFirst({
      where: { status: "active" },
      orderBy: { createdAt: "asc" },
    });

    if (!org) return null;

    const user = await prisma.user?.create({
      data: {
        email: normalizedEmail,
        fullName,
        status: "active",
      },
    });

    if (!user) return null;

    await prisma.membership?.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "employee",
        status: "active",
      },
    });

    const hashedPassword = await hashPassword(password);
    await prisma.authAccount.create({
      data: {
        userId: user.id,
        provider: "password",
        providerUserId: normalizedEmail,
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const userWithMemberships = await prisma.user?.findFirst({
      where: { email: normalizedEmail },
      include: { memberships: true },
    });

    const session = userWithMemberships ? userToSession(userWithMemberships) : null;
    if (!session) return null;

    const createdSession = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      sessionId: createdSession.id,
      session,
    };
  },
};
};
