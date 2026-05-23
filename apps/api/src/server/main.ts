import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseEnv } from "../config/env";
import { createAuthPrismaDataSource } from "../modules/auth/auth-prisma-data-source";
import { createBackendDataSource } from "../modules/backend-data-source";
import { createNavyAiClient } from "../modules/ai/navy-ai-client";
import { configureCsrfSecret } from "../modules/auth/csrf";
import { createTelegramBotClient } from "../modules/telegram/telegram-bot-client";
import { createApiHttpServer } from "./http-server";

const env = parseEnv({
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgresql://hunterlite:hunterlite@localhost:5432/hunterlite",
});

configureCsrfSecret(env.HUNTERLITE_CSRF_SECRET);

const pool = new Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const telegram = createTelegramBotClient(env);

const server = createApiHttpServer({
  source: createBackendDataSource({
    prisma,
    ai: createNavyAiClient(env),
    telegram,
  }),
  auth: createAuthPrismaDataSource(prisma, {
    telegramLoginEmail: env.TELEGRAM_LOGIN_EMAIL,
    sendTelegramCode: ({ recipient, code }) => telegram.sendLoginCode({ recipient, code }),
  }),
  authDemoFallback: env.AUTH_DEMO_FALLBACK,
  secureCookies: env.NODE_ENV === "production",
  corsOrigins: env.CORS_ORIGINS,
});

server.listen(env.API_PORT, () => {
  console.log(`hunterlite-api listening on http://127.0.0.1:${env.API_PORT}`);
});

const shutdown = () => {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
