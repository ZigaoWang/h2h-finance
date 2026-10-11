import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExpenseList } from "@/components/expense-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { EXPENSE_STATUSES, type ExpenseStatus } from "@/lib/db/schema";
import { listOwnExpenses } from "@/lib/expenses/queries";
import { formatMoney } from "@/lib/money";

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

      <Panel className="mb-10 grid grid-cols-3 divide-x divide-line">
        <Figure label={t("awaitingReview")} value={formatMoney(sumOf("pending"))} />
        <Figure label={t("awaitingPayback")} value={formatMoney(sumOf("approved"))} />
        <Figure label={t("paidBack")} value={formatMoney(sumOf("reimbursed"))} />
      </Panel>

      <nav className="mb-3 flex gap-1 overflow-x-auto" aria-label={t("filter")}>
        {FILTERS.map((f) => {
          const active = (f === "all" && !status) || f === status;
          return (
            <Link
              key={f}
              href={f === "all" ? "/expenses" : `/expenses?status=${f}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors",
                active ? "bg-ink font-medium text-white" : "text-ink-2 hover:bg-subtle",
              )}
            >
              {f === "all" ? t("all") : ts(f)}
              <span className={cn("num text-xs", active ? "text-white/60" : "text-faint")}>{f === "all" ? all.length : countOf(f)}</span>
            </Link>
          );
        })}
      </nav>

      <Panel>
        {shown.length ? (
          <ExpenseList items={shown} href={(item) => `/expenses/${item.id}`} showMember={false} />
        ) : (
          <EmptyState
            title={status ? t("emptyFiltered") : t("empty")}
            description={status ? undefined : t("emptyHint")}
            action={!status && <ButtonLink href="/expenses/new">{t("new")}</ButtonLink>}
          />
        )}
      </Panel>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <p className="truncate text-xs text-muted sm:text-[13px]">{label}</p>
      <p className="num mt-1 truncate text-[15px] font-semibold tracking-tight sm:text-lg">{value}</p>
    </div>
  );
}
