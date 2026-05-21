export const databaseEngine = "postgresql" as const;

export const dataTables = [
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
] as const;

export type DataTableName = (typeof dataTables)[number];

export type FieldType =
  | "uuid"
  | "text"
  | "integer"
  | "boolean"
  | "jsonb"
  | "timestamp"
  | "date";

export type DataField = {
  name: string;
  type: FieldType;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  references?: DataTableName;
};

export type DataTable = {
  name: DataTableName;
  tenantScoped: boolean;
  containsPersonalData: boolean;
  demoSeed: boolean;
  fields: readonly DataField[];
  indexes: readonly string[];
};

export const dataModel = [
  {
    name: "organizations",
    tenantScoped: false,
    containsPersonalData: false,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "name", type: "text" },
      { name: "slug", type: "text", unique: true },
      { name: "status", type: "text" },
      { name: "created_at", type: "timestamp" },
      { name: "updated_at", type: "timestamp" },
    ],
    indexes: ["organizations_slug_unique"],
  },
  {
    name: "users",
    tenantScoped: false,
    containsPersonalData: true,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "email", type: "text", unique: true },
      { name: "full_name", type: "text" },
      { name: "avatar_url", type: "text", nullable: true },
      { name: "status", type: "text" },
      { name: "last_login_at", type: "timestamp", nullable: true },
      { name: "created_at", type: "timestamp" },
      { name: "updated_at", type: "timestamp" },
    ],
    indexes: ["users_email_unique", "users_status_idx"],
  },
  {
    name: "memberships",
    tenantScoped: true,
    containsPersonalData: true,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "user_id", type: "uuid", references: "users" },
      { name: "role", type: "text" },
      { name: "status", type: "text" },
      { name: "created_at", type: "timestamp" },
      { name: "updated_at", type: "timestamp" },
    ],
    indexes: ["memberships_organization_id_idx", "memberships_user_id_idx", "memberships_org_user_unique"],
  },
  {
    name: "auth_accounts",
    tenantScoped: false,
    containsPersonalData: true,
    demoSeed: false,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "user_id", type: "uuid", references: "users" },
      { name: "provider", type: "text" },
      { name: "provider_user_id", type: "text" },
      { name: "password_hash", type: "text", nullable: true },
      { name: "failed_login_attempts", type: "integer" },
      { name: "locked_until", type: "timestamp", nullable: true },
      { name: "created_at", type: "timestamp" },
      { name: "updated_at", type: "timestamp" },
    ],
    indexes: ["auth_accounts_user_id_idx", "auth_accounts_provider_user_unique"],
  },
  {
    name: "password_reset_tokens",
    tenantScoped: false,
    containsPersonalData: true,
    demoSeed: false,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "user_id", type: "uuid", references: "users" },
      { name: "token_hash", type: "text" },
      { name: "expires_at", type: "timestamp" },
      { name: "used_at", type: "timestamp", nullable: true },
      { name: "created_at", type: "timestamp" },
    ],
    indexes: [
      "password_reset_tokens_token_hash_key",
      "password_reset_tokens_user_id_idx",
      "password_reset_tokens_expires_at_idx",
    ],
  },
  {
    name: "sessions",
    tenantScoped: false,
    containsPersonalData: true,
    demoSeed: false,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "user_id", type: "uuid", references: "users" },
      { name: "expires_at", type: "timestamp" },
      { name: "revoked_at", type: "timestamp", nullable: true },
      { name: "created_at", type: "timestamp" },
    ],
    indexes: ["sessions_user_id_idx", "sessions_expires_at_idx"],
  },
  {
    name: "consents",
    tenantScoped: true,
    containsPersonalData: true,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "user_id", type: "uuid", references: "users" },
      { name: "version", type: "text" },
      { name: "accepted_at", type: "timestamp" },
    ],
    indexes: ["consents_organization_id_idx", "consents_user_id_idx"],
  },
  {
    name: "training_topics",
    tenantScoped: true,
    containsPersonalData: false,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "title", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "is_active", type: "boolean" },
      { name: "created_at", type: "timestamp" },
    ],
    indexes: ["training_topics_organization_id_idx"],
  },
  {
    name: "training_sessions",
    tenantScoped: true,
    containsPersonalData: true,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "user_id", type: "uuid", references: "users" },
      { name: "topic_id", type: "uuid", references: "training_topics" },
      { name: "mode", type: "text" },
      { name: "difficulty", type: "text" },
      { name: "format", type: "text" },
      { name: "character", type: "text" },
      { name: "question_count", type: "integer" },
      { name: "score", type: "integer", nullable: true },
      { name: "evaluation_criteria", type: "jsonb", nullable: true },
      { name: "mistakes", type: "jsonb", nullable: true },
      { name: "recommendations", type: "jsonb", nullable: true },
      { name: "status", type: "text" },
      { name: "started_at", type: "timestamp" },
      { name: "completed_at", type: "timestamp", nullable: true },
    ],
    indexes: ["training_sessions_organization_id_idx", "training_sessions_user_id_idx", "training_sessions_topic_id_idx"],
  },
  {
    name: "training_messages",
    tenantScoped: true,
    containsPersonalData: true,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "training_session_id", type: "uuid", references: "training_sessions" },
      { name: "sender", type: "text" },
      { name: "content", type: "text" },
      { name: "created_at", type: "timestamp" },
    ],
    indexes: ["training_messages_organization_id_idx", "training_messages_session_id_idx"],
  },
  {
    name: "exam_attempts",
    tenantScoped: true,
    containsPersonalData: true,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "user_id", type: "uuid", references: "users" },
      { name: "topic_id", type: "uuid", references: "training_topics" },
      { name: "score", type: "integer", nullable: true },
      { name: "passing_score", type: "integer" },
      { name: "status", type: "text" },
      { name: "started_at", type: "timestamp" },
      { name: "completed_at", type: "timestamp", nullable: true },
    ],
    indexes: ["exam_attempts_organization_id_idx", "exam_attempts_user_id_idx", "exam_attempts_topic_id_idx"],
  },
  {
    name: "weak_topics",
    tenantScoped: true,
    containsPersonalData: true,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "user_id", type: "uuid", references: "users" },
      { name: "topic_id", type: "uuid", references: "training_topics" },
      { name: "errors_count", type: "integer" },
      { name: "recommendation", type: "text" },
      { name: "updated_at", type: "timestamp" },
    ],
    indexes: ["weak_topics_organization_id_idx", "weak_topics_user_id_idx", "weak_topics_topic_id_idx"],
  },
  {
    name: "notifications",
    tenantScoped: true,
    containsPersonalData: true,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "user_id", type: "uuid", references: "users" },
      { name: "type", type: "text" },
      { name: "title", type: "text" },
      { name: "body", type: "text" },
      { name: "read_at", type: "timestamp", nullable: true },
      { name: "created_at", type: "timestamp" },
    ],
    indexes: ["notifications_organization_id_idx", "notifications_user_id_idx", "notifications_read_at_idx"],
  },
  {
    name: "client_leads",
    tenantScoped: false,
    containsPersonalData: true,
    demoSeed: false,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations", nullable: true },
      { name: "name", type: "text" },
      { name: "phone", type: "text", nullable: true },
      { name: "email", type: "text", nullable: true },
      { name: "question", type: "text" },
      { name: "status", type: "text" },
      { name: "created_at", type: "timestamp" },
    ],
    indexes: ["client_leads_organization_id_idx", "client_leads_status_idx"],
  },
  {
    name: "audit_logs",
    tenantScoped: true,
    containsPersonalData: true,
    demoSeed: false,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "actor_user_id", type: "uuid", references: "users", nullable: true },
      { name: "action", type: "text" },
      { name: "target_type", type: "text" },
      { name: "target_id", type: "uuid", nullable: true },
      { name: "metadata", type: "jsonb" },
      { name: "created_at", type: "timestamp" },
    ],
    indexes: ["audit_logs_organization_id_idx", "audit_logs_actor_user_id_idx", "audit_logs_action_idx"],
  },
  {
    name: "system_settings",
    tenantScoped: true,
    containsPersonalData: false,
    demoSeed: true,
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "organization_id", type: "uuid", references: "organizations" },
      { name: "key", type: "text" },
      { name: "value", type: "jsonb" },
      { name: "updated_at", type: "timestamp" },
    ],
    indexes: ["system_settings_organization_id_idx", "system_settings_org_key_unique"],
  },
] as const satisfies readonly DataTable[];

export const getTable = (name: DataTableName) =>
  dataModel.find((table) => table.name === name);

export const getField = (tableName: DataTableName, fieldName: string) =>
  getTable(tableName)?.fields.find((field) => field.name === fieldName);

export const tenantScopedTables = dataModel.filter((table) => table.tenantScoped);

export const personalDataTables = dataModel.filter((table) => table.containsPersonalData);
