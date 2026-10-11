import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, expenses, files, reimbursements, users } from "@/lib/db";

const payers = alias(users, "payers");
const undoers = alias(users, "undoers");

export function listReimbursements(limit = 50) {
  return db
    .select({
      id: reimbursements.id,
      amountCents: reimbursements.amountCents,
      paidOn: reimbursements.paidOn,
      note: reimbursements.note,
      payee: users.name,
      payer: payers.name,
      expenseCount: sql<number>`(select count(*) from ${expenses} where ${expenses.reimbursementId} = ${reimbursements.id})`.mapWith(Number),
      proofFileId: sql<string | null>`(select ${files.id} from ${files} where ${files.reimbursementId} = ${reimbursements.id} limit 1)`,
      undoneAt: reimbursements.undoneAt,
      undoReason: reimbursements.undoReason,
      undoneBy: undoers.name,
    })
    .from(reimbursements)
    .innerJoin(users, eq(users.id, reimbursements.userId))
    .innerJoin(payers, eq(payers.id, reimbursements.paidBy))
    .leftJoin(undoers, eq(undoers.id, reimbursements.undoneBy))
    .orderBy(desc(reimbursements.paidOn), desc(reimbursements.id))
    .limit(limit)
    .all();
}

export function getMember(id: number) {
  return db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, id)).get();
}
