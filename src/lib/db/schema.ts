import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export const ROLES = ["member", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Members pick their name when signing in, so names are unique regardless of case.
    name: text("name").notNull(),
    role: text("role", { enum: ROLES }).notNull().default("member"),
    // Removed members keep their history but can no longer sign in.
    removedAt: integer("removed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_name_unique").on(sql`lower(${t.name})`)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    // SHA-256 of the cookie token, so a leaked database can't be used to sign in.
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Every password attempt, kept briefly, so repeated guessing from one address can be slowed down.
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ip: text("ip").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_ip_idx").on(t.ip, t.createdAt)],
);

export const budgetYears = sqliteTable(
  "budget_years",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    label: text("label").notNull(),
    // Inclusive ISO dates (YYYY-MM-DD). An expense belongs to the year its date falls in.
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    budgetCents: integer("budget_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("budget_years_budget_check", sql`${t.budgetCents} >= 0`),
    check("budget_years_range_check", sql`${t.startsOn} <= ${t.endsOn}`),
  ],
);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameEn: text("name_en").notNull(),
  nameZh: text("name_zh").notNull(),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameEn: text("name_en").notNull(),
  nameZh: text("name_zh").notNull(),
  heldOn: text("held_on"),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const EXPENSE_STATUSES = ["pending", "approved", "rejected", "reimbursed", "voided"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const expenses = sqliteTable(
  "expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    yearId: integer("year_id")
      .notNull()
      .references(() => budgetYears.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    eventId: integer("event_id").references(() => events.id),
    amountCents: integer("amount_cents").notNull(),
    merchant: text("merchant").notNull(),
    spentOn: text("spent_on").notNull(),
    // Shown on the public page. Private details go in `note`.
    description: text("description").notNull(),
    note: text("note"),
    status: text("status", { enum: EXPENSE_STATUSES }).notNull().default("pending"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    rejectionReason: text("rejection_reason"),
    reimbursementId: integer("reimbursement_id").references(() => reimbursements.id),
    voidedBy: integer("voided_by").references(() => users.id),
    voidedAt: integer("voided_at", { mode: "timestamp_ms" }),
    voidReason: text("void_reason"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    updatedBy: integer("updated_by").references(() => users.id),
  },
  (t) => [
    index("expenses_user_idx").on(t.userId, t.status),
    index("expenses_year_idx").on(t.yearId, t.status),
    index("expenses_status_idx").on(t.status, t.createdAt),
    check("expenses_amount_check", sql`${t.amountCents} > 0`),
  ],
);

export const reimbursements = sqliteTable(
  "reimbursements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    paidOn: text("paid_on").notNull(),
    note: text("note"),
    paidBy: integer("paid_by")
      .notNull()
      .references(() => users.id),
    // An undone reimbursement stays on record; its expenses go back to "to be paid back".
    undoneAt: integer("undone_at", { mode: "timestamp_ms" }),
    undoneBy: integer("undone_by").references(() => users.id),
    undoReason: text("undo_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("reimbursements_user_idx").on(t.userId),
    check("reimbursements_amount_check", sql`${t.amountCents} > 0`),
  ],
);

// Every earlier version of every expense, written by database triggers on each change or
// deletion, so no edit can go unrecorded however it's made.
export const expenseRevisions = sqliteTable(
  "expense_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    expenseId: integer("expense_id").notNull(),
    row: text("row", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("expense_revisions_expense_idx").on(t.expenseId)],
);

export const FILE_KINDS = ["receipt", "transfer"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", { enum: FILE_KINDS }).notNull(),
    size: integer("size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    // SHA-256 of the uploaded bytes catches exact re-uploads; the difference hash catches
    // the same screenshot after it has been re-saved or recompressed by a chat app.
    sha256: text("sha256").notNull(),
    dhash: text("dhash").notNull(),
    duplicateOfId: text("duplicate_of_id"),
    ocr: text("ocr", { mode: "json" }).$type<OcrResult>(),
    expenseId: integer("expense_id").references(() => expenses.id),
    reimbursementId: integer("reimbursement_id").references(() => reimbursements.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("files_sha_idx").on(t.sha256),
    index("files_expense_idx").on(t.expenseId),
    index("files_reimbursement_idx").on(t.reimbursementId),
  ],
);

export type OcrResult = {
  amountCents?: number;
  merchant?: string;
  spentOn?: string;
  // "21:47", when the screenshot shows it.
  paidAt?: string;
  // The payment platform's own transaction number, the strongest duplicate signal there is.
  transactionId?: string;
};

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: integer("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
