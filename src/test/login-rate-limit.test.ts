import { describe, expect, it } from "vitest";
import { createLoginRateLimiter } from "../../apps/api/src";

describe("login rate limiter", () => {
  it("blocks attempts after the configured limit until the window resets", () => {
    let now = 1000;
    const limiter = createLoginRateLimiter({
      maxAttempts: 2,
      windowMs: 500,
      now: () => now,
    });

    expect(limiter.check("10.0.0.1:user@example.com")).toBeNull();
    expect(limiter.check("10.0.0.1:user@example.com")).toBeNull();
    expect(limiter.check("10.0.0.1:user@example.com")).toEqual({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many login attempts",
        details: { retryAfterMs: 500 },
      },
    });

    now = 1500;
    expect(limiter.check("10.0.0.1:user@example.com")).toBeNull();
  });

  it("keeps different users and addresses in separate buckets", () => {
    const limiter = createLoginRateLimiter({
      maxAttempts: 1,
      windowMs: 500,
      now: () => 1000,
    });

    expect(limiter.check("10.0.0.1:user@example.com")).toBeNull();
    expect(limiter.check("10.0.0.1:user@example.com")?.error.code).toBe("RATE_LIMITED");
    expect(limiter.check("10.0.0.2:user@example.com")).toBeNull();
    expect(limiter.check("10.0.0.1:another@example.com")).toBeNull();
  });

  it("can reset a key after a successful login", () => {
    const limiter = createLoginRateLimiter({
      maxAttempts: 1,
      windowMs: 500,
      now: () => 1000,
    });

    expect(limiter.check("10.0.0.1:user@example.com")).toBeNull();
    expect(limiter.check("10.0.0.1:user@example.com")?.error.code).toBe("RATE_LIMITED");

    limiter.reset("10.0.0.1:user@example.com");

    expect(limiter.check("10.0.0.1:user@example.com")).toBeNull();
  });
});
