import "server-only";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/dal";
import { categories, db, events, expenses, files } from "@/lib/db";
import { isIsoDate, today } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { parseMoney } from "@/lib/money";
import { yearForDate } from "@/lib/years";

const MAX_SUBMISSIONS_PER_HOUR = 40;
const MAX_FILES_PER_EXPENSE = 5;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullish();
const isoDate = z.string().refine(isIsoDate);
const amount = z.string().transform((v, ctx) => parseMoney(v) ?? (ctx.addIssue({ code: "custom" }), z.NEVER));

const detailsSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  eventId: z.coerce
    .number()
    .int()
    .positive()
    .nullish()
    .catch(null),
  description: text(200),
  note: optionalText(1000),
});

const itemSchema = z.object({
  fileIds: z.array(z.uuid()).min(1).max(MAX_FILES_PER_EXPENSE),
  amount,
  merchant: text(80),
  spentOn: isoDate,
});

export const submissionSchema = detailsSchema.extend({ items: z.array(itemSchema).min(1).max(20) });
// Corrections change the details; the receipts themselves stay as submitted.
export const updateSchema = detailsSchema.extend(itemSchema.omit({ fileIds: true }).shape);

export type SubmissionInput = z.input<typeof submissionSchema>;
export type UpdateInput = z.input<typeof updateSchema>;

type Expense = typeof expenses.$inferSelect;
type Details = Pick<Expense, "amountCents" | "merchant" | "spentOn" | "description" | "note" | "categoryId" | "eventId">;
type Names = { en: string; zh: string } | null;

function names(table: typeof categories | typeof events, id: number | null): Names {
  if (!id) return null;
  const row = db.select({ en: table.nameEn, zh: table.nameZh }).from(table).where(eq(table.id, id)).get();
  return row ?? null;
}

/** What changed, field by field, in a form the history can show without looking anything up. */
function describeChanges(before: Details, after: Details) {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const key of ["amountCents", "merchant", "spentOn", "description", "note"] as const) {
    if ((before[key] ?? null) !== (after[key] ?? null)) changes[key] = [before[key] ?? null, after[key] ?? null];
  }
  if (before.categoryId !== after.categoryId) changes.category = [names(categories, before.categoryId), names(categories, after.categoryId)];
  if ((before.eventId ?? null) !== (after.eventId ?? null)) changes.event = [names(events, before.eventId), names(events, after.eventId)];
  return changes;
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("invalid", result.error.issues[0]?.path.join("."));
  return result.data;
}

function assertActiveOptions(categoryId: number, eventId: number | null | undefined, { categoryChanged = true } = {}) {
  const category = db.select().from(categories).where(eq(categories.id, categoryId)).get();
  if (!category || (categoryChanged && category.archivedAt)) throw new AppError("inactive_option", "category");
  if (eventId) {
    const event = db.select().from(events).where(eq(events.id, eventId)).get();
    if (!event || event.archivedAt) throw new AppError("inactive_option", "event");
  }
}

function assertDate(spentOn: string) {
  if (spentOn > today()) throw new AppError("invalid", "spentOn");
  const year = yearForDate(spentOn);
  if (!year) throw new AppError("no_year", spentOn);
  return year;
}

/** Receipts must be the member's own, freshly uploaded, and not already used elsewhere. */
function assertOwnFreeFiles(userId: number, fileIds: string[], expenseId?: number) {
  const rows = db.select().from(files).where(inArray(files.id, fileIds)).all();
  const ok =
    rows.length === new Set(fileIds).size &&
    rows.every(
      (f) =>
        f.ownerId === userId &&
        f.kind === "receipt" &&
        f.reimbursementId === null &&
        (f.expenseId === null || f.expenseId === expenseId),
    );
  if (!ok) throw new AppError("file_missing");
}

export function submitExpenses(user: SessionUser, input: SubmissionInput): number[] {
  const data = parse(submissionSchema, input);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = db
    .select({ n: count() })
    .from(expenses)
    .where(and(eq(expenses.userId, user.id), gt(expenses.createdAt, hourAgo)))
    .get();
  if ((recent?.n ?? 0) + data.items.length > MAX_SUBMISSIONS_PER_HOUR) throw new AppError("rate_limited");

  assertActiveOptions(data.categoryId, data.eventId);
  assertOwnFreeFiles(
    user.id,
    data.items.flatMap((item) => item.fileIds),
  );
  const years = data.items.map((item) => assertDate(item.spentOn));

  return db.transaction((tx) =>
    data.items.map((item, index) => {
      const { id } = tx
        .insert(expenses)
        .values({
          userId: user.id,
          yearId: years[index].id,
          categoryId: data.categoryId,
          eventId: data.eventId ?? null,
          amountCents: item.amount,
          merchant: item.merchant,
          spentOn: item.spentOn,
          description: data.description,
          note: data.note ?? null,
          // Expenses count as soon as they're submitted; the club trusts its members.
          status: "approved",
        })
        .returning({ id: expenses.id })
        .get();
      tx.update(files).set({ expenseId: id }).where(inArray(files.id, item.fileIds)).run();
      audit(tx, {
        actorId: user.id,
        action: "expense.submitted",
        entity: "expense",
        entityId: id,
        data: { amountCents: item.amount, fileIds: item.fileIds },
      });
      return id;
    }),
  );
}

/**
 * Corrects an expense's details. Members can fix their own and admins anyone's; receipts stay
 * as submitted. Nothing is quiet: who changed what is recorded, and the database keeps the old version.
 */
export function updateExpense(user: SessionUser, id: number, input: UpdateInput) {
  const expense = db.select().from(expenses).where(eq(expenses.id, id)).get();
  if (!expense || (user.role !== "admin" && expense.userId !== user.id)) throw new AppError("not_found");
  if (expense.status === "voided") throw new AppError("locked");
  const data = parse(updateSchema, input);
  const after: Details = {
    amountCents: data.amount,
    merchant: data.merchant,
    spentOn: data.spentOn,
    description: data.description,
    note: data.note ?? null,
    categoryId: data.categoryId,
    eventId: data.eventId ?? null,
  };
  const changes = describeChanges(expense, after);
  if (!Object.keys(changes).length) return;
  // Only newly chosen options must be active; an expense may keep an archived one.
  assertActiveOptions(
    changes.category ? data.categoryId : expense.categoryId,
    changes.event ? data.eventId : null,
    { categoryChanged: !!changes.category },
  );
  const year = assertDate(data.spentOn);

  db.transaction((tx) => {
    tx.update(expenses)
      .set({ ...after, yearId: year.id, updatedAt: new Date(), updatedBy: user.id })
      .where(eq(expenses.id, id))
      .run();
    audit(tx, { actorId: user.id, action: "expense.updated", entity: "expense", entityId: id, data: { changes } });
  });
}

const reasonSchema = text(500);

/**
 * Deletes an expense in the open: it stays on record, marked deleted with who and why, and drops
 * out of every total.
 */
export function deleteExpense(admin: SessionUser, id: number, reason: string) {
  const why = parse(reasonSchema, reason);
  const expense = db.select().from(expenses).where(eq(expenses.id, id)).get();
  if (!expense) throw new AppError("not_found");
  if (expense.status === "voided") throw new AppError("locked");
  db.transaction((tx) => {
    tx.update(expenses)
      .set({ status: "voided", voidedBy: admin.id, voidedAt: new Date(), voidReason: why })
      .where(eq(expenses.id, id))
      .run();
    audit(tx, { actorId: admin.id, action: "expense.voided", entity: "expense", entityId: id, data: { reason: why, from: expense.status } });
  });
}

/** Brings a deleted expense back into the accounts. */
export function restoreExpense(admin: SessionUser, id: number) {
  const expense = db.select().from(expenses).where(eq(expenses.id, id)).get();
  if (!expense) throw new AppError("not_found");
  if (expense.status !== "voided") throw new AppError("locked");
  assertDate(expense.spentOn);
  db.transaction((tx) => {
    tx.update(expenses)
      .set({
        status: "approved",
        voidedBy: null,
        voidedAt: null,
        voidReason: null,
        updatedAt: new Date(),
        updatedBy: admin.id,
      })
      .where(eq(expenses.id, id))
      .run();
    audit(tx, { actorId: admin.id, action: "expense.restored", entity: "expense", entityId: id });
  });
}
