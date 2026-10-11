import "server-only";
import { and, asc, count, desc, eq, inArray, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { notFound } from "next/navigation";
import type { SessionUser } from "@/lib/auth/dal";
import {
  auditLog,
  categories,
  db,
  events,
  expenses,
  files,
  reimbursements,
  users,
  type ExpenseStatus,
  type OcrResult,
} from "@/lib/db";

const reviewers = alias(users, "reviewers");
const editors = alias(users, "editors");
const deleters = alias(users, "deleters");

const rowFields = {
  id: expenses.id,
  amountCents: expenses.amountCents,
  merchant: expenses.merchant,
  spentOn: expenses.spentOn,
  description: expenses.description,
  status: expenses.status,
  createdAt: expenses.createdAt,
  userId: expenses.userId,
  userName: users.name,
  categoryEn: categories.nameEn,
  categoryZh: categories.nameZh,
  eventEn: events.nameEn,
  eventZh: events.nameZh,
};

export type ExpenseRow = {
  id: number;
  amountCents: number;
  merchant: string;
  spentOn: string;
  description: string;
  status: ExpenseStatus;
  createdAt: Date;
  userId: number;
  userName: string;
  categoryEn: string;
  categoryZh: string;
  eventEn: string | null;
  eventZh: string | null;
};

function rows(where: SQL | undefined, limit?: number): ExpenseRow[] {
  const query = db
    .select(rowFields)
    .from(expenses)
    .innerJoin(users, eq(users.id, expenses.userId))
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(events, eq(events.id, expenses.eventId))
    .where(where)
    .orderBy(desc(expenses.spentOn), desc(expenses.id));
  return limit ? query.limit(limit).all() : query.all();
}

export function countPendingReview(): number {
  return db.select({ n: count() }).from(expenses).where(eq(expenses.status, "pending")).get()?.n ?? 0;
}

export function countAwaitingPayback(): number {
  return db.select({ n: count() }).from(expenses).where(eq(expenses.status, "approved")).get()?.n ?? 0;
}

export function listOwnExpenses(userId: number, status?: ExpenseStatus): ExpenseRow[] {
  return rows(and(eq(expenses.userId, userId), status ? eq(expenses.status, status) : undefined));
}

export function listPendingReview(): ExpenseRow[] {
  return db
    .select(rowFields)
    .from(expenses)
    .innerJoin(users, eq(users.id, expenses.userId))
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(events, eq(events.id, expenses.eventId))
    .where(eq(expenses.status, "pending"))
    .orderBy(asc(expenses.createdAt))
    .all();
}

export function listApprovedUnpaid(userId: number): ExpenseRow[] {
  return rows(and(eq(expenses.userId, userId), eq(expenses.status, "approved")));
}

export type ExpenseFile = { id: string; width: number; height: number; duplicateOfId: string | null; ocr: OcrResult | null };

export function filesFor(expenseIds: number[]) {
  if (!expenseIds.length) return new Map<number, ExpenseFile[]>();
  const list = db
    .select({ id: files.id, width: files.width, height: files.height, duplicateOfId: files.duplicateOfId, ocr: files.ocr, expenseId: files.expenseId })
    .from(files)
    .where(inArray(files.expenseId, expenseIds))
    .orderBy(asc(files.createdAt))
    .all();
  const map = new Map<number, ExpenseFile[]>();
  for (const { expenseId, ...file } of list) {
    map.set(expenseId!, [...(map.get(expenseId!) ?? []), file]);
  }
  return map;
}

export type DuplicateFlag =
  | { kind: "image"; reason: "exact" | "transaction" | "similar"; expenseId: number | null; reimbursementId: number | null }
  | { kind: "details"; expenseId: number };

/** Why an expense might be a double claim: a reused screenshot, or identical details. */
export function duplicateFlags(expenseIds: number[]): Map<number, DuplicateFlag[]> {
  const flags = new Map<number, DuplicateFlag[]>();
  if (!expenseIds.length) return flags;
  const add = (id: number, flag: DuplicateFlag) => flags.set(id, [...(flags.get(id) ?? []), flag]);

  const originals = alias(files, "originals");
  const imageMatches = db
    .select({
      expenseId: files.expenseId,
      file: files.sha256,
      original: originals.sha256,
      fileOcr: files.ocr,
      originalOcr: originals.ocr,
      originalExpenseId: originals.expenseId,
      originalReimbursementId: originals.reimbursementId,
    })
    .from(files)
    .innerJoin(originals, eq(originals.id, files.duplicateOfId))
    .where(inArray(files.expenseId, expenseIds))
    .all();
  for (const m of imageMatches) {
    add(m.expenseId!, {
      kind: "image",
      reason:
        m.file === m.original
          ? "exact"
          : m.fileOcr?.transactionId && m.fileOcr.transactionId === m.originalOcr?.transactionId
            ? "transaction"
            : "similar",
      expenseId: m.originalExpenseId,
      reimbursementId: m.originalReimbursementId,
    });
  }

  const others = alias(expenses, "others");
  const detailMatches = db
    .select({ expenseId: expenses.id, otherId: others.id })
    .from(expenses)
    .innerJoin(
      others,
      and(
        ne(others.id, expenses.id),
        eq(others.amountCents, expenses.amountCents),
        eq(others.spentOn, expenses.spentOn),
        eq(others.merchant, expenses.merchant),
        ne(others.status, "voided"),
        ne(others.status, "rejected"),
      ),
    )
    .where(inArray(expenses.id, expenseIds))
    .all();
  for (const m of detailMatches) add(m.expenseId, { kind: "details", expenseId: m.otherId });

  return flags;
}

/** Full detail for one expense. Members only ever see their own; others get a 404. */
export function getExpenseDetail(id: number, viewer: SessionUser) {
  const expense = db
    .select({
      ...rowFields,
      note: expenses.note,
      categoryId: expenses.categoryId,
      eventId: expenses.eventId,
      reviewedAt: expenses.reviewedAt,
      reviewerName: reviewers.name,
      rejectionReason: expenses.rejectionReason,
      reimbursementId: expenses.reimbursementId,
      voidedAt: expenses.voidedAt,
      voidReason: expenses.voidReason,
      voidedByName: deleters.name,
      updatedAt: expenses.updatedAt,
      updatedByName: editors.name,
    })
    .from(expenses)
    .innerJoin(users, eq(users.id, expenses.userId))
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(events, eq(events.id, expenses.eventId))
    .leftJoin(reviewers, eq(reviewers.id, expenses.reviewedBy))
    .leftJoin(editors, eq(editors.id, expenses.updatedBy))
    .leftJoin(deleters, eq(deleters.id, expenses.voidedBy))
    .where(eq(expenses.id, id))
    .get();
  if (!expense || (viewer.role !== "admin" && expense.userId !== viewer.id)) notFound();

  const payers = alias(users, "payers");
  const reimbursement = expense.reimbursementId
    ? db
        .select({ id: reimbursements.id, paidOn: reimbursements.paidOn, createdAt: reimbursements.createdAt, payerName: payers.name })
        .from(reimbursements)
        .innerJoin(payers, eq(payers.id, reimbursements.paidBy))
        .where(eq(reimbursements.id, expense.reimbursementId))
        .get()
    : undefined;
  const proof = reimbursement
    ? db.select({ id: files.id }).from(files).where(eq(files.reimbursementId, reimbursement.id)).get()
    : undefined;

  const history = db
    .select({ action: auditLog.action, createdAt: auditLog.createdAt, actorName: users.name, data: auditLog.data })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(and(eq(auditLog.entity, "expense"), eq(auditLog.entityId, String(id))))
    .orderBy(asc(auditLog.id))
    .all();

  return {
    expense,
    files: filesFor([id]).get(id) ?? [],
    flags: duplicateFlags([id]).get(id) ?? [],
    reimbursement,
    proofFileId: proof?.id,
    history,
  };
}

export type ExpenseDetail = ReturnType<typeof getExpenseDetail>;
