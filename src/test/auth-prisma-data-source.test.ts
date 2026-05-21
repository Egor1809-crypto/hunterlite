import { describe, expect, it, vi } from "vitest";
import { createAuthPrismaDataSource, hashPassword, verifyPassword, type AuthPrismaClient } from "../../apps/api/src";

const user = {
  id: "user-1",
  email: "manager@hunterlite.ru",
  fullName: "Ольга Литвинова",
  status: "active",
  memberships: [{ role: "manager", status: "active" }],
};

const createPrisma = (
  passwordHash: string,
  accountOverrides: Partial<{
    failedLoginAttempts: number;
    lockedUntil: Date | null;
  }> = {},
): AuthPrismaClient => ({
  authAccount: {
    findFirst: vi.fn(async () => ({
      id: "account-1",
      provider: "password",
      passwordHash,
      failedLoginAttempts: accountOverrides.failedLoginAttempts ?? 0,
      lockedUntil: accountOverrides.lockedUntil ?? null,
      user,
    })),
    update: vi.fn(async () => ({})),
  },
  passwordResetToken: {
    create: vi.fn(async () => ({ id: "reset-1" })),
    findFirst: vi.fn(async () => ({
      id: "reset-1",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user: {
        ...user,
        authAccounts: [{
          id: "account-1",
          provider: "password",
          passwordHash,
          failedLoginAttempts: accountOverrides.failedLoginAttempts ?? 0,
          lockedUntil: accountOverrides.lockedUntil ?? null,
        }],
      },
    })),
    update: vi.fn(async () => ({})),
  },
  session: {
    create: vi.fn(async () => ({ id: "session-1" })),
    findUnique: vi.fn(async () => ({
      id: "session-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    })),
    update: vi.fn(async () => ({})),
  },
});

describe("auth Prisma data source", () => {
  it("creates database sessions on password login", async () => {
    const prisma = createPrisma(await hashPassword("secret", "test-salt"));
    const source = createAuthPrismaDataSource(prisma);

    await expect(source.login({ email: "MANAGER@hunterlite.ru", password: "secret" })).resolves.toEqual({
      sessionId: "session-1",
      session: {
        user: expect.objectContaining({
          id: "user-1",
          role: "manager",
          name: "Ольга Литвинова",
        }),
        homePath: "/manager",
      },
    });
    expect(prisma.authAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider: "password",
          providerUserId: "manager@hunterlite.ru",
        },
      }),
    );
    expect(prisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });

  it("returns active sessions by database session id", async () => {
    const source = createAuthPrismaDataSource(createPrisma(await hashPassword("secret", "test-salt")));

    await expect(source.session("session-1")).resolves.toEqual({
      user: expect.objectContaining({
        role: "manager",
        email: "manager@hunterlite.ru",
      }),
      homePath: "/manager",
    });
  });

  it("revokes sessions on logout", async () => {
    const prisma = createPrisma(await hashPassword("secret", "test-salt"));
    const source = createAuthPrismaDataSource(prisma);

    await source.logout?.("session-1");

    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("rejects invalid passwords before creating sessions", async () => {
    const prisma = createPrisma(await hashPassword("secret", "test-salt"));
    const source = createAuthPrismaDataSource(prisma, {
      maxFailedAttempts: 2,
      lockMs: 60_000,
      now: () => new Date("2026-05-16T08:00:00.000Z"),
    });

    await expect(source.login({ email: "manager@hunterlite.ru", password: "wrong" })).resolves.toBeNull();
    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(prisma.authAccount.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: {
        failedLoginAttempts: 1,
        lockedUntil: null,
      },
    });
  });

  it("temporarily locks accounts after repeated invalid passwords", async () => {
    const prisma = createPrisma(await hashPassword("secret", "test-salt"), {
      failedLoginAttempts: 1,
    });
    const source = createAuthPrismaDataSource(prisma, {
      maxFailedAttempts: 2,
      lockMs: 60_000,
      now: () => new Date("2026-05-16T08:00:00.000Z"),
    });

    await expect(source.login({ email: "manager@hunterlite.ru", password: "wrong" })).resolves.toBeNull();
    expect(prisma.authAccount.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: {
        failedLoginAttempts: 2,
        lockedUntil: new Date("2026-05-16T08:01:00.000Z"),
      },
    });
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it("does not create sessions for locked accounts", async () => {
    const prisma = createPrisma(await hashPassword("secret", "test-salt"), {
      failedLoginAttempts: 2,
      lockedUntil: new Date("2026-05-16T08:05:00.000Z"),
    });
    const source = createAuthPrismaDataSource(prisma, {
      now: () => new Date("2026-05-16T08:00:00.000Z"),
    });

    await expect(source.login({ email: "manager@hunterlite.ru", password: "secret" })).resolves.toBeNull();
    expect(prisma.authAccount.update).not.toHaveBeenCalled();
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it("resets failed login counters after a successful password login", async () => {
    const prisma = createPrisma(await hashPassword("secret", "test-salt"), {
      failedLoginAttempts: 2,
      lockedUntil: new Date("2026-05-16T07:55:00.000Z"),
    });
    const source = createAuthPrismaDataSource(prisma, {
      now: () => new Date("2026-05-16T08:00:00.000Z"),
    });

    await expect(source.login({ email: "manager@hunterlite.ru", password: "secret" })).resolves.toEqual(
      expect.objectContaining({ sessionId: "session-1" }),
    );
    expect(prisma.authAccount.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  });

  it("creates password reset tokens without returning raw tokens to the database", async () => {
    const prisma = createPrisma(await hashPassword("secret", "test-salt"));
    const source = createAuthPrismaDataSource(prisma, {
      passwordResetTokenMs: 60_000,
      now: () => new Date("2026-05-16T08:00:00.000Z"),
    });

    const reset = await source.requestPasswordReset?.("MANAGER@hunterlite.ru");

    expect(reset?.token).toEqual(expect.any(String));
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: new Date("2026-05-16T08:01:00.000Z"),
      },
    });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tokenHash: reset?.token }),
      }),
    );
  });

  it("resets passwords with valid reset tokens and marks tokens as used", async () => {
    const prisma = createPrisma(await hashPassword("secret", "test-salt"));
    const source = createAuthPrismaDataSource(prisma, {
      now: () => new Date("2026-05-16T08:00:00.000Z"),
    });

    await expect(source.completePasswordReset?.({
      token: "reset-token",
      newPassword: "new-secret",
    })).resolves.toBe(true);

    expect(prisma.authAccount.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: {
        passwordHash: expect.stringMatching(/^scrypt:/),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: "reset-1" },
      data: { usedAt: new Date("2026-05-16T08:00:00.000Z") },
    });
  });

  it("hashes and verifies passwords with scrypt", async () => {
    const hash = await hashPassword("hunterlite-demo", "stable-salt");

    expect(hash).toMatch(/^scrypt:stable-salt:/);
    await expect(verifyPassword("hunterlite-demo", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
    await expect(verifyPassword(undefined, hash)).resolves.toBe(false);
  });
});
