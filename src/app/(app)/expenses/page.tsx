import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExpenseList } from "@/components/expense-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { today } from "@/lib/dates";
import { listOwnExpenses } from "@/lib/expenses/queries";
import { formatMoney } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("expenses") };
}

export default async function MyExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const user = await requireUser();
  const t = await getTranslations();
  const showDeleted = (await searchParams).status === "voided";

  const all = listOwnExpenses(user.id);
  const recorded = all.filter((e) => e.status !== "voided");
  const deleted = all.length - recorded.length;
  const shown = showDeleted ? all.filter((e) => e.status === "voided") : recorded;
  const month = today().slice(0, 7);
  const sum = (list: typeof all) => list.reduce((n, e) => n + e.amountCents, 0);

  return (
    <>
      <PageHeader title={t("expenses.title")} description={t("expenses.description")} />

      <Panel className="mb-10 grid grid-cols-3 divide-x divide-line">
        <Figure label={t("expenses.total")} value={formatMoney(sum(recorded))} />
        <Figure label={t("dashboard.thisMonth")} value={formatMoney(sum(recorded.filter((e) => e.spentOn.startsWith(month))))} />
        <Figure label={t("dashboard.expenseCount")} value={String(recorded.length)} />
      </Panel>

      {deleted > 0 && (
        <nav className="mb-3 flex gap-1" aria-label={t("expenses.filter")}>
          {[
            { href: "/expenses", label: t("expenses.all"), active: !showDeleted, count: recorded.length },
            { href: "/expenses?status=voided", label: t("status.voided"), active: showDeleted, count: deleted },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors",
                tab.active ? "bg-ink font-medium text-white" : "text-ink-2 hover:bg-subtle",
              )}
            >
              {tab.label}
              <span className={cn("num text-xs", tab.active ? "text-white/60" : "text-faint")}>{tab.count}</span>
            </Link>
          ))}
        </nav>
      )}

      <Panel>
        {shown.length ? (
          <ExpenseList items={shown} href={(item) => `/expenses/${item.id}`} showMember={false} />
        ) : (
          <EmptyState
            title={t("expenses.empty")}
            description={t("expenses.emptyHint")}
            action={<ButtonLink href="/expenses/new">{t("expenses.new")}</ButtonLink>}
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
