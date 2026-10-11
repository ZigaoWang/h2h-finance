import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExpenseList } from "@/components/expense-list";
import { EmptyState, Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listMembers } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { EXPENSE_STATUSES, type ExpenseStatus } from "@/lib/db/schema";
import { listAllExpenses } from "@/lib/expenses/queries";
import { formatMoney } from "@/lib/money";
import { ExpenseFilters } from "./filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("allExpenses") };
}

const TABS = ["all", "pending", "approved", "reimbursed", "rejected", "voided"] as const;

/** Every expense, for admins to find, open, correct or delete. */
export default async function AllExpensesPage({ searchParams }: PageProps<"/all-expenses">) {
  await requireAdmin();
  const t = await getTranslations();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = EXPENSE_STATUSES.includes(one(params.status) as ExpenseStatus) ? (one(params.status) as ExpenseStatus) : undefined;
  const userId = Number(one(params.member)) || undefined;
  const query = one(params.q) ?? "";

  const items = listAllExpenses({ status, userId, query });
  const total = items.filter((e) => e.status === "approved" || e.status === "reimbursed").reduce((sum, e) => sum + e.amountCents, 0);
  const members = listMembers().map((m) => ({ id: m.id, name: m.name }));
  const link = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { status, member: userId ? String(userId) : undefined, q: query || undefined, ...next };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const qs = search.toString();
    return qs ? `/all-expenses?${qs}` : "/all-expenses";
  };

  return (
    <>
      <PageHeader title={t("allExpenses.title")} description={t("allExpenses.description")} />

      <ExpenseFilters members={members} member={userId} query={query} />

      <nav className="mb-3 flex gap-1 overflow-x-auto" aria-label={t("expenses.filter")}>
        {TABS.map((tab) => {
          const active = (tab === "all" && !status) || tab === status;
          return (
            <Link
              key={tab}
              href={link({ status: tab === "all" ? undefined : tab })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-md px-3 text-[13px] transition-colors",
                active ? "bg-ink font-medium text-white" : "text-ink-2 hover:bg-subtle",
              )}
            >
              {tab === "all" ? t("expenses.all") : t(`status.${tab}`)}
            </Link>
          );
        })}
      </nav>

      <Panel>
        {items.length ? (
          <ExpenseList items={items} href={(item) => `/expenses/${item.id}`} />
        ) : (
          <EmptyState title={t("expenses.emptyFiltered")} />
        )}
      </Panel>
      {items.length > 0 && (
        <p className="mt-3 text-right text-[13px] text-muted">
          {t("allExpenses.summary", { count: items.length, total: formatMoney(total) })}
        </p>
      )}
    </>
  );
}
