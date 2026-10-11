import "server-only";
import { and, desc, gte, lte } from "drizzle-orm";
import { budgetYears, db } from "@/lib/db";
import { today } from "@/lib/dates";

export type BudgetYear = typeof budgetYears.$inferSelect;

export function listYears(): BudgetYear[] {
  return db.select().from(budgetYears).orderBy(desc(budgetYears.startsOn)).all();
}

export function yearForDate(iso: string): BudgetYear | undefined {
  return db
    .select()
    .from(budgetYears)
    .where(and(lte(budgetYears.startsOn, iso), gte(budgetYears.endsOn, iso)))
    .get();
}

/** The year covering today, or the most recent one if today falls between years. */
export function currentYear(): BudgetYear | undefined {
  return yearForDate(today()) ?? listYears()[0];
}

/** Picks the year from a `?year=` search param, falling back to the current year. */
export function selectYear(param: string | string[] | undefined): BudgetYear | undefined {
  const id = Number(Array.isArray(param) ? param[0] : param);
  const years = listYears();
  return (Number.isInteger(id) && years.find((y) => y.id === id)) || currentYear();
}
