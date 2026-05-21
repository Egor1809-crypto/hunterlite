import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_COOKIE_NAME: z.string().min(1).default("hunterlite_session"),
  CORS_ORIGINS: z.string().min(1).default("http://127.0.0.1:8080,http://localhost:8080"),
  AUTH_DEMO_FALLBACK: z.enum(["true", "false"]).optional(),
});

export type ApiEnv = Omit<z.infer<typeof envSchema>, "AUTH_DEMO_FALLBACK"> & {
  AUTH_DEMO_FALLBACK: boolean;
};

export const parseEnv = (source: Record<string, string | undefined>): ApiEnv => {
  const env = envSchema.parse(source);

  return {
    ...env,
    AUTH_DEMO_FALLBACK:
      env.AUTH_DEMO_FALLBACK === undefined
        ? env.NODE_ENV !== "production"
        : env.AUTH_DEMO_FALLBACK === "true",
  };
};

export const parseCorsOrigins = (origins: string) =>
  origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
