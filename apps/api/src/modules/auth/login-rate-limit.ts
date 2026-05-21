import type { ApiFailure } from "../../http/api-response";
import { fail } from "../../http/api-response";

type LoginAttempt = {
  count: number;
  resetAt: number;
};

export type LoginRateLimiterOptions = {
  maxAttempts?: number;
  windowMs?: number;
  now?: () => number;
};

export type LoginRateLimiter = {
  check: (key: string) => ApiFailure | null;
  reset: (key: string) => void;
};

export const createLoginRateLimiter = ({
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  now = Date.now,
}: LoginRateLimiterOptions = {}): LoginRateLimiter => {
  const attempts = new Map<string, LoginAttempt>();

  return {
    check: (key) => {
      const currentTime = now();
      const current = attempts.get(key);

      if (!current || current.resetAt <= currentTime) {
        attempts.set(key, {
          count: 1,
          resetAt: currentTime + windowMs,
        });
        return null;
      }

      if (current.count >= maxAttempts) {
        return fail("RATE_LIMITED", "Too many login attempts", {
          retryAfterMs: Math.max(0, current.resetAt - currentTime),
        });
      }

      current.count += 1;
      return null;
    },
    reset: (key) => {
      attempts.delete(key);
    },
  };
};

export const loginRateLimiter = createLoginRateLimiter();
