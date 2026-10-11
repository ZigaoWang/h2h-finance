import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExpenseList } from "@/components/expense-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/dal";
import { EXPENSE_STATUSES, type ExpenseStatus } from "@/lib/db/schema";
import { listOwnExpenses } from "@/lib/expenses/queries";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("expenses") };
}

const FILTERS = ["all", "pending", "approved", "reimbursed", "rejected"] as const;

export default async function MyExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const user = await requireUser();
  const t = await getTranslations("expenses");
  const ts = await getTranslations("status");
  const param = (await searchParams).status;
  const status = EXPENSE_STATUSES.includes(param as ExpenseStatus) ? (param as ExpenseStatus) : undefined;

  const all = listOwnExpenses(user.id);
  const shown = status ? all.filter((e) => e.status === status) : all;
  const sumOf = (s: ExpenseStatus) => all.filter((e) => e.status === s).reduce((n, e) => n + e.amountCents, 0);
  const countOf = (s: ExpenseStatus) => all.filter((e) => e.status === s).length;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={t("awaitingReview")} value={formatMoney(sumOf("pending"))} />
        <Stat label={t("awaitingPayback")} value={formatMoney(sumOf("approved"))} />
        <Stat label={t("paidBack")} value={formatMoney(sumOf("reimbursed"))} className="max-sm:hidden" />
      </dl>

      <Card>
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2" aria-label={t("filter")}>
          {FILTERS.map((f) => {
            const active = (f === "all" && !status) || f === status;
            const count = f === "all" ? all.length : countOf(f);
            return (
              <Link
                key={f}
                href={f === "all" ? "/expenses" : `/expenses?status=${f}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm",
                  active ? "bg-subtle font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {f === "all" ? t("all") : ts(f)}
                <span className="num text-xs text-faint">{count}</span>
              </Link>
            );
          })}
        </nav>
        {shown.length ? (
          <ExpenseList items={shown} href={(item) => `/expenses/${item.id}`} />
        ) : (
          <EmptyState
            title={status ? t("emptyFiltered") : t("empty")}
            description={status ? undefined : t("emptyHint")}
            action={!status && <ButtonLink href="/expenses/new">{t("new")}</ButtonLink>}
          />
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface px-4 py-3", className)}>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="num mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}
