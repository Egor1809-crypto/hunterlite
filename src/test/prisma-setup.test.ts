import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/000_init/migration.sql", "utf8");
const dockerCompose = readFileSync("infra/docker-compose.yml", "utf8");
const prismaConfig = readFileSync("prisma.config.ts", "utf8");

const requiredModels = [
  "Organization",
  "User",
  "Membership",
  "AuthAccount",
  "Session",
  "Consent",
  "TrainingTopic",
  "TrainingSession",
  "TrainingMessage",
  "ExamAttempt",
  "WeakTopic",
  "Notification",
  "ClientLead",
  "AuditLog",
  "SystemSetting",
];

describe("block 3 prisma and postgres setup", () => {
  it("uses PostgreSQL in Prisma schema", () => {
    expect(schema).toContain('provider = "postgresql"');
    expect(prismaConfig).toContain("DATABASE_URL");
  });

  it("defines all first-version Prisma models", () => {
    requiredModels.forEach((model) => {
      expect(schema).toContain(`model ${model} {`);
    });
  });

  it("keeps tenant scoped models tied to organization_id", () => {
    [
      "memberships",
      "training_sessions",
      "training_messages",
      "exam_attempts",
      "weak_topics",
      "notifications",
      "audit_logs",
      "system_settings",
    ].forEach((tableName) => {
      expect(migration).toContain(`CREATE TABLE "${tableName}"`);
      expect(migration).toContain('"organization_id" UUID NOT NULL');
    });
  });

  it("creates the initial migration SQL", () => {
    expect(migration).toContain('CREATE TABLE "organizations"');
    expect(migration).toContain('CREATE TABLE "users"');
    expect(migration).toContain('CREATE TABLE "training_sessions"');
    expect(migration).toContain('CREATE TABLE "audit_logs"');
    expect(migration).toContain('FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")');
  });

  it("defines local PostgreSQL through Docker Compose", () => {
    expect(dockerCompose).toContain("postgres:16-alpine");
    expect(dockerCompose).toContain("POSTGRES_DB: hunterlite");
    expect(dockerCompose).toContain('"5432:5432"');
  });

  it("adds database scripts and Prisma dependencies", () => {
    expect(packageJson.scripts["db:generate"]).toBe("prisma generate");
    expect(packageJson.scripts["db:migrate"]).toBe("prisma migrate dev");
    expect(packageJson.scripts["db:seed"]).toBe("prisma db seed");
    expect(packageJson.dependencies["@prisma/client"]).toBeDefined();
    expect(packageJson.devDependencies.prisma).toBeDefined();
  });
});
