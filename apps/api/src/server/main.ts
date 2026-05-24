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
import { createTelegramBotServer } from "../modules/telegram/telegram-bot-server";
import { createApiHttpServer } from "./http-server";
import { arenaQuestions } from "../../../../src/lib/arena-questions";

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
const ai = createNavyAiClient(env);

const telegramBot = createTelegramBotServer({
  env,
  ai,
  prisma,
  quizQuestions: arenaQuestions,
  platformUrl: env.PLATFORM_URL ?? "https://hunterlite.ru",
});

const server = createApiHttpServer({
  source: createBackendDataSource({
    prisma,
    ai,
    telegram,
  }),
  auth: createAuthPrismaDataSource(prisma, {
    telegramLoginEmail: env.TELEGRAM_LOGIN_EMAIL,
    sendTelegramCode: ({ recipient, code }) => telegram.sendLoginCode({ recipient, code }),
    resolveTelegramChatId: (phone) => telegramBot?.getChatIdByPhone(phone),
    resolveTelegramUserName: (phone) => telegramBot?.getUserNameByPhone(phone),
  }),
  secureCookies: env.NODE_ENV === "production",
  corsOrigins: env.CORS_ORIGINS,
});

server.listen(env.API_PORT, () => {
  console.log(`hunterlite-api listening on http://127.0.0.1:${env.API_PORT}`);
  telegramBot?.start();
});

const shutdown = () => {
  telegramBot?.stop();
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
