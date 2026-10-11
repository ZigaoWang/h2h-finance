import "server-only";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import { categories, db, events, expenses, users } from "@/lib/db";
import { today } from "@/lib/dates";
import type { BudgetYear } from "@/lib/years";

// What counts as spent: every expense that hasn't been deleted.
const COUNTED = ["approved", "reimbursed"] as const;

export type Slice = { key: string; nameEn: string; nameZh: string; cents: number; count: number };

const total = sql<number>`coalesce(sum(${expenses.amountCents}), 0)`.mapWith(Number);
const tally = sql<number>`count(*)`.mapWith(Number);

function inYear(year: BudgetYear) {
  return and(eq(expenses.yearId, year.id), inArray(expenses.status, COUNTED));
}

function months(year: BudgetYear): string[] {
  const list: string[] = [];
  let [y, m] = year.startsOn.split("-").map(Number);
  const end = year.endsOn.slice(0, 7);
  while (list.length < 24) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    list.push(key);
    if (key >= end) break;
    m = m === 12 ? 1 : m + 1;
    if (m === 1) y++;
  }
  return list;
}

export function yearSummary(year: BudgetYear, { includePeople }: { includePeople: boolean }) {
  const spent = db.select({ cents: total, count: tally }).from(expenses).where(inYear(year)).get() ?? { cents: 0, count: 0 };

  const byCategory: Slice[] = db
    .select({ id: categories.id, nameEn: categories.nameEn, nameZh: categories.nameZh, cents: total, count: tally })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .where(inYear(year))
    .groupBy(categories.id)
    .orderBy(desc(total))
    .all()
    .map(({ id, ...rest }) => ({ key: String(id), ...rest }));

  const byEvent: Slice[] = db
    .select({ id: events.id, nameEn: events.nameEn, nameZh: events.nameZh, cents: total, count: tally })
    .from(expenses)
    .leftJoin(events, eq(events.id, expenses.eventId))
    .where(inYear(year))
    .groupBy(events.id)
    .orderBy(desc(total))
    .all()
    .map(({ id, nameEn, nameZh, ...rest }) => ({ key: id ? String(id) : "none", nameEn: nameEn ?? "", nameZh: nameZh ?? "", ...rest }));

  const byPerson: Slice[] = includePeople
    ? db
        .select({ id: users.id, name: users.name, cents: total, count: tally })
        .from(expenses)
        .innerJoin(users, eq(users.id, expenses.userId))
        .where(inYear(year))
        .groupBy(users.id)
        .orderBy(desc(total))
        .all()
        .map(({ id, name, ...rest }) => ({ key: String(id), nameEn: name, nameZh: name, ...rest }))
    : [];

  const monthly = new Map(
    db
      .select({ month: sql<string>`substr(${expenses.spentOn}, 1, 7)`, cents: total })
      .from(expenses)
      .where(inYear(year))
      .groupBy(sql`substr(${expenses.spentOn}, 1, 7)`)
      .all()
      .map((r) => [r.month, r.cents]),
  );

  const daily = db
    .select({ date: expenses.spentOn, cents: total, count: tally })
    .from(expenses)
    .where(inYear(year))
    .groupBy(expenses.spentOn)
    .all();

  const largest = db.select({ cents: max(expenses.amountCents) }).from(expenses).where(inYear(year)).get()?.cents ?? 0;
  const now = today();
  const thisMonth = now.slice(0, 7);
  const [y, m] = thisMonth.split("-").map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  // How far through the year we are, to read spending against: 40% spent at 50% of the year is on pace.
  const span = Date.parse(year.endsOn) - Date.parse(year.startsOn) + 86_400_000;
  const yearProgress = Math.min(1, Math.max(0, (Date.parse(now) - Date.parse(year.startsOn) + 86_400_000) / span));

  return {
    budgetCents: year.budgetCents,
    spent,
    averageCents: spent.count ? Math.round(spent.cents / spent.count) : 0,
    largestCents: largest,
    thisMonthCents: monthly.get(thisMonth) ?? 0,
    lastMonthCents: monthly.get(lastMonth) ?? 0,
    yearProgress,
    remainingCents: year.budgetCents - spent.cents,
    byCategory,
    byEvent,
    byPerson,
    monthly: months(year).map((month) => ({ month, cents: monthly.get(month) ?? 0 })),
    daily,
    startsOn: year.startsOn,
    endsOn: year.endsOn,
  };
}

export type YearSummary = ReturnType<typeof yearSummary>;

export type Transaction = {
  id: number;
  spentOn: string;
  description: string;
  merchant: string | null;
  amountCents: number;
  status: (typeof COUNTED)[number];
  categoryEn: string;
  categoryZh: string;
  eventEn: string | null;
  eventZh: string | null;
  userName: string | null;
  userId: number | null;
};

/**
 * Recent counted spending. The public version leaves out who spent it and where, since
 * merchants and names can identify members; the description is written to be public.
 */
export function recentTransactions(year: BudgetYear, { publicView, limit }: { publicView: boolean; limit?: number }): Transaction[] {
  const query = db
    .select({
      id: expenses.id,
      spentOn: expenses.spentOn,
      description: expenses.description,
      merchant: publicView ? sql<null>`null` : expenses.merchant,
      amountCents: expenses.amountCents,
      status: sql<(typeof COUNTED)[number]>`${expenses.status}`,
      categoryEn: categories.nameEn,
      categoryZh: categories.nameZh,
      eventEn: events.nameEn,
      eventZh: events.nameZh,
      userName: publicView ? sql<null>`null` : users.name,
      userId: publicView ? sql<null>`null` : users.id,
    })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .innerJoin(users, eq(users.id, expenses.userId))
    .leftJoin(events, eq(events.id, expenses.eventId))
    .where(inYear(year))
    .orderBy(desc(expenses.spentOn), desc(expenses.id));
  return limit ? query.limit(limit).all() : query.all();
}

