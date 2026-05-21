import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://hunterlite:hunterlite@localhost:5432/hunterlite";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    url: databaseUrl,
  },
});
