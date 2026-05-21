import { describe, expect, it } from "vitest";
import {
  databaseEngine,
  dataModel,
  dataTables,
  getField,
  getTable,
  personalDataTables,
  tenantScopedTables,
  type DataTableName,
} from "@/lib/data-model";

const expectedTables = [
  "organizations",
  "users",
  "memberships",
  "auth_accounts",
  "password_reset_tokens",
  "sessions",
  "consents",
  "training_topics",
  "training_sessions",
  "training_messages",
  "exam_attempts",
  "weak_topics",
  "notifications",
  "client_leads",
  "audit_logs",
  "system_settings",
] as const satisfies readonly DataTableName[];

const tenantScopedTableNames = [
  "memberships",
  "consents",
  "training_topics",
  "training_sessions",
  "training_messages",
  "exam_attempts",
  "weak_topics",
  "notifications",
  "audit_logs",
  "system_settings",
] as const satisfies readonly DataTableName[];

const requiredForeignKeys: Record<DataTableName, Record<string, DataTableName>> = {
  organizations: {},
  users: {},
  memberships: {
    organization_id: "organizations",
    user_id: "users",
  },
  auth_accounts: {
    user_id: "users",
  },
  password_reset_tokens: {
    user_id: "users",
  },
  sessions: {
    user_id: "users",
  },
  consents: {
    organization_id: "organizations",
    user_id: "users",
  },
  training_topics: {
    organization_id: "organizations",
  },
  training_sessions: {
    organization_id: "organizations",
    user_id: "users",
    topic_id: "training_topics",
  },
  training_messages: {
    organization_id: "organizations",
    training_session_id: "training_sessions",
  },
  exam_attempts: {
    organization_id: "organizations",
    user_id: "users",
    topic_id: "training_topics",
  },
  weak_topics: {
    organization_id: "organizations",
    user_id: "users",
    topic_id: "training_topics",
  },
  notifications: {
    organization_id: "organizations",
    user_id: "users",
  },
  client_leads: {
    organization_id: "organizations",
  },
  audit_logs: {
    organization_id: "organizations",
    actor_user_id: "users",
  },
  system_settings: {
    organization_id: "organizations",
  },
};

describe("block 2 data model", () => {
  it("uses PostgreSQL as the primary relational database", () => {
    expect(databaseEngine).toBe("postgresql");
  });

  it("defines the expected first-version tables", () => {
    expect(dataTables).toEqual(expectedTables);
    expect(dataModel.map((table) => table.name)).toEqual(expectedTables);
  });

  it("does not duplicate table names", () => {
    const uniqueTableNames = new Set(dataModel.map((table) => table.name));

    expect(uniqueTableNames.size).toBe(dataModel.length);
  });

  it("gives every table one UUID primary key named id", () => {
    dataModel.forEach((table) => {
      const primaryKeys = table.fields.filter((field) => field.primaryKey);

      expect(primaryKeys).toHaveLength(1);
      expect(primaryKeys[0]).toMatchObject({ name: "id", type: "uuid" });
    });
  });

  it("adds organization_id to every tenant-scoped table", () => {
    expect(tenantScopedTables.map((table) => table.name)).toEqual(tenantScopedTableNames);

    tenantScopedTables.forEach((table) => {
      expect(getField(table.name, "organization_id")).toMatchObject({
        type: "uuid",
        references: "organizations",
      });
      expect(table.indexes.some((index) => index.includes("organization_id"))).toBe(true);
    });
  });

  it("keeps global identity and auth tables outside tenant scoping", () => {
    ["organizations", "users", "auth_accounts", "sessions"].forEach((tableName) => {
      expect(getTable(tableName as DataTableName)?.tenantScoped).toBe(false);
    });
  });

  it("allows client leads to exist before assignment to an organization", () => {
    expect(getTable("client_leads")?.tenantScoped).toBe(false);
    expect(getField("client_leads", "organization_id")).toMatchObject({
      nullable: true,
      references: "organizations",
    });
  });

  it("defines required foreign keys", () => {
    Object.entries(requiredForeignKeys).forEach(([tableName, fields]) => {
      Object.entries(fields).forEach(([fieldName, referencedTable]) => {
        expect(getField(tableName as DataTableName, fieldName)).toMatchObject({
          references: referencedTable,
        });
      });
    });
  });

  it("marks tables with personal data", () => {
    const personalTableNames = personalDataTables.map((table) => table.name);

    expect(personalTableNames).toEqual([
      "users",
      "memberships",
      "auth_accounts",
      "password_reset_tokens",
      "sessions",
      "consents",
      "training_sessions",
      "training_messages",
      "exam_attempts",
      "weak_topics",
      "notifications",
      "client_leads",
      "audit_logs",
    ]);
  });

  it("keeps password hashes only in auth_accounts", () => {
    const fieldsNamedPasswordHash = dataModel.flatMap((table) =>
      table.fields
        .filter((field) => field.name === "password_hash")
        .map((field) => ({ table: table.name, field })),
    );

    expect(fieldsNamedPasswordHash).toHaveLength(1);
    expect(fieldsNamedPasswordHash[0].table).toBe("auth_accounts");
    expect(fieldsNamedPasswordHash[0].field.nullable).toBe(true);
  });

  it("supports the employee product flow data", () => {
    expect(getField("training_sessions", "score")).toBeDefined();
    expect(getField("training_sessions", "status")).toBeDefined();
    expect(getField("exam_attempts", "passing_score")).toBeDefined();
    expect(getField("weak_topics", "recommendation")).toBeDefined();
    expect(getField("notifications", "read_at")).toBeDefined();
  });

  it("supports manager reports through indexed organization and user fields", () => {
    ["training_sessions", "exam_attempts", "weak_topics", "notifications"].forEach((tableName) => {
      const table = getTable(tableName as DataTableName);

      expect(table?.indexes.some((index) => index.includes("organization_id"))).toBe(true);
      expect(table?.indexes.some((index) => index.includes("user_id"))).toBe(true);
    });
  });

  it("keeps security-sensitive runtime tables out of demo seed", () => {
    expect(getTable("auth_accounts")?.demoSeed).toBe(false);
    expect(getTable("sessions")?.demoSeed).toBe(false);
    expect(getTable("client_leads")?.demoSeed).toBe(false);
    expect(getTable("audit_logs")?.demoSeed).toBe(false);
  });
});
