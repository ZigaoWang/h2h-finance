import "server-only";
import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/dal";
import { categories, db, events, expenses, files, reimbursements } from "@/lib/db";
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
export const updateSchema = detailsSchema.extend(itemSchema.shape);

export type SubmissionInput = z.input<typeof submissionSchema>;
export type UpdateInput = z.input<typeof updateSchema>;

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("invalid", result.error.issues[0]?.path.join("."));
  return result.data;
}

function assertActiveOptions(categoryId: number, eventId: number | null | undefined) {
  const category = db.select().from(categories).where(eq(categories.id, categoryId)).get();
  if (!category || category.archivedAt) throw new AppError("inactive_option", "category");
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

function getOwnEditable(user: SessionUser, id: number) {
  const expense = db.select().from(expenses).where(eq(expenses.id, id)).get();
  if (!expense || expense.userId !== user.id) throw new AppError("not_found");
  if (expense.status !== "pending" && expense.status !== "rejected") throw new AppError("locked");
  return expense;
}

/** Members can fix a pending expense, or correct a rejected one and send it back for review. */
export function updateExpense(user: SessionUser, id: number, input: UpdateInput) {
  const expense = getOwnEditable(user, id);
  const data = parse(updateSchema, input);
  assertActiveOptions(data.categoryId, data.eventId);
  assertOwnFreeFiles(user.id, data.fileIds, id);
  const year = assertDate(data.spentOn);

  db.transaction((tx) => {
    tx.update(expenses)
      .set({
        yearId: year.id,
        categoryId: data.categoryId,
        eventId: data.eventId ?? null,
        amountCents: data.amount,
        merchant: data.merchant,
        spentOn: data.spentOn,
        description: data.description,
        note: data.note ?? null,
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .run();
    // Receipts dropped from the expense become unattached and are cleaned up later.
    tx.update(files).set({ expenseId: null }).where(eq(files.expenseId, id)).run();
    tx.update(files).set({ expenseId: id }).where(inArray(files.id, data.fileIds)).run();
    audit(tx, {
      actorId: user.id,
      action: "expense.updated",
      entity: "expense",
      entityId: id,
      data: {
        before: { amountCents: expense.amountCents, merchant: expense.merchant, spentOn: expense.spentOn, status: expense.status },
        after: { amountCents: data.amount, merchant: data.merchant, spentOn: data.spentOn },
      },
    });
  });
}

/** Pending expenses can be withdrawn by their owner. Anything reviewed stays on record. */
export function withdrawExpense(user: SessionUser, id: number) {
  const expense = getOwnEditable(user, id);
  if (expense.status !== "pending") throw new AppError("locked");
  db.transaction((tx) => {
    tx.update(files).set({ expenseId: null }).where(eq(files.expenseId, id)).run();
    tx.delete(expenses).where(eq(expenses.id, id)).run();
    audit(tx, {
      actorId: user.id,
      action: "expense.withdrawn",
      entity: "expense",
      entityId: id,
      data: { amountCents: expense.amountCents, merchant: expense.merchant, spentOn: expense.spentOn },
    });
  });
}

function getForReview(id: number, status: "pending" | "approved") {
  const expense = db.select().from(expenses).where(eq(expenses.id, id)).get();
  if (!expense) throw new AppError("not_found");
  if (expense.status !== status) throw new AppError("locked");
  return expense;
}

export function approveExpense(admin: SessionUser, id: number) {
  getForReview(id, "pending");
  db.transaction((tx) => {
    tx.update(expenses)
      .set({ status: "approved", reviewedBy: admin.id, reviewedAt: new Date() })
      .where(and(eq(expenses.id, id), eq(expenses.status, "pending")))
      .run();
    audit(tx, { actorId: admin.id, action: "expense.approved", entity: "expense", entityId: id });
  });
}

const reasonSchema = text(500);

export function rejectExpense(admin: SessionUser, id: number, reason: string) {
  const why = parse(reasonSchema, reason);
  getForReview(id, "pending");
  db.transaction((tx) => {
    tx.update(expenses)
      .set({ status: "rejected", reviewedBy: admin.id, reviewedAt: new Date(), rejectionReason: why })
      .where(and(eq(expenses.id, id), eq(expenses.status, "pending")))
      .run();
    audit(tx, { actorId: admin.id, action: "expense.rejected", entity: "expense", entityId: id, data: { reason: why } });
  });
}

/**
 * Corrects a mistaken approval in the open: the expense stays on record, marked void with a
 * reason, and drops out of the totals. Expenses already paid back can't be voided.
 */
export function voidExpense(admin: SessionUser, id: number, reason: string) {
  const why = parse(reasonSchema, reason);
  getForReview(id, "approved");
  db.transaction((tx) => {
    tx.update(expenses)
      .set({ status: "voided", voidedBy: admin.id, voidedAt: new Date(), voidReason: why })
      .where(and(eq(expenses.id, id), eq(expenses.status, "approved")))
      .run();
    audit(tx, { actorId: admin.id, action: "expense.voided", entity: "expense", entityId: id, data: { reason: why } });
  });
}

const reimbursementSchema = z.object({
  userId: z.coerce.number().int().positive(),
  expenseIds: z.array(z.coerce.number().int().positive()).min(1),
  proofFileId: z.uuid(),
  paidOn: isoDate,
  note: optionalText(500),
});

export type ReimbursementInput = z.input<typeof reimbursementSchema>;

export function createReimbursement(admin: SessionUser, input: ReimbursementInput): number {
  const data = parse(reimbursementSchema, input);
  if (data.paidOn > today()) throw new AppError("invalid", "paidOn");

  const selected = db
    .select()
    .from(expenses)
    .where(and(inArray(expenses.id, data.expenseIds), eq(expenses.userId, data.userId), eq(expenses.status, "approved")))
    .all();
  if (selected.length !== new Set(data.expenseIds).size) throw new AppError("locked");

  const proof = db.select().from(files).where(eq(files.id, data.proofFileId)).get();
  if (!proof || proof.kind !== "transfer" || proof.ownerId !== admin.id || proof.expenseId || proof.reimbursementId) {
    throw new AppError("file_missing");
  }

  const total = selected.reduce((sum, e) => sum + e.amountCents, 0);

  return db.transaction((tx) => {
    const { id } = tx
      .insert(reimbursements)
      .values({ userId: data.userId, amountCents: total, paidOn: data.paidOn, note: data.note ?? null, paidBy: admin.id })
      .returning({ id: reimbursements.id })
      .get();
    tx.update(expenses)
      .set({ status: "reimbursed", reimbursementId: id })
      .where(and(inArray(expenses.id, data.expenseIds), eq(expenses.status, "approved")))
      .run();
    tx.update(files)
      .set({ reimbursementId: id })
      .where(and(eq(files.id, data.proofFileId), isNull(files.reimbursementId)))
      .run();
    audit(tx, {
      actorId: admin.id,
      action: "reimbursement.created",
      entity: "reimbursement",
      entityId: id,
      data: { userId: data.userId, amountCents: total, expenseIds: data.expenseIds },
    });
    return id;
  });
}
