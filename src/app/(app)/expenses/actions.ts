"use server";

import { requireAdmin, requireUser } from "@/lib/auth/dal";
import {
  adminUpdateExpense,
  approveExpense,
  createReimbursement,
  rejectExpense,
  submitExpenses,
  deleteExpense,
  restoreExpense,
  updateExpense,
  withdrawExpense,
  type AdminUpdateInput,
  type ReimbursementInput,
  type SubmissionInput,
  type UpdateInput,
} from "@/lib/expenses/mutations";
import { mutate } from "@/lib/mutate";

export async function submitExpensesAction(input: SubmissionInput) {
  const user = await requireUser();
  return mutate(() => submitExpenses(user, input));
}

export async function updateExpenseAction(id: number, input: UpdateInput) {
  const user = await requireUser();
  return mutate(() => updateExpense(user, id, input));
}

export async function adminUpdateExpenseAction(id: number, input: AdminUpdateInput) {
  const admin = await requireAdmin();
  return mutate(() => adminUpdateExpense(admin, id, input));
}

export async function withdrawExpenseAction(id: number) {
  const user = await requireUser();
  return mutate(() => withdrawExpense(user, id));
}

export async function approveExpenseAction(id: number) {
  const admin = await requireAdmin();
  return mutate(() => approveExpense(admin, id));
}

export async function rejectExpenseAction(id: number, reason: string) {
  const admin = await requireAdmin();
  return mutate(() => rejectExpense(admin, id, reason));
}

export async function deleteExpenseAction(id: number, reason: string) {
  const admin = await requireAdmin();
  return mutate(() => deleteExpense(admin, id, reason));
}

export async function restoreExpenseAction(id: number) {
  const admin = await requireAdmin();
  return mutate(() => restoreExpense(admin, id));
}

export async function createReimbursementAction(input: ReimbursementInput) {
  const admin = await requireAdmin();
  return mutate(() => createReimbursement(admin, input));
}
