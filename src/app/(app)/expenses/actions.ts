"use server";

import { requireAdmin, requireUser } from "@/lib/auth/dal";
import {
  deleteExpense,
  restoreExpense,
  submitExpenses,
  updateExpense,
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

export async function deleteExpenseAction(id: number, reason: string) {
  const admin = await requireAdmin();
  return mutate(() => deleteExpense(admin, id, reason));
}

export async function restoreExpenseAction(id: number) {
  const admin = await requireAdmin();
  return mutate(() => restoreExpense(admin, id));
}
