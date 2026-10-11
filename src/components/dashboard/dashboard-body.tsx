import { useTranslations } from "next-intl";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { ExpenseList, type ListItem } from "@/components/expense-list";
import { formatMoney } from "@/lib/money";
import type { Transaction, YearSummary } from "@/lib/stats";
import { BudgetOverview } from "./budget-overview";
import { Breakdown } from "./breakdown";
import { MonthlyChart } from "./monthly-chart";

type Owed = { userId: number; name: string; cents: number; count: number };

/** The shared dashboard: members see everything below, the public page leaves out people. */
export function DashboardBody({
  summary,
  transactions,
  owed,
  linkFor,
}: {
  summary: YearSummary;
  transactions: Transaction[];
  owed?: Owed[];
  linkFor?: (item: ListItem) => string | undefined;
}) {
  const t = useTranslations("dashboard");
  const isPublic = !owed;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <BudgetOverview summary={summary} showOwed={!isPublic} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <Breakdown title={t("byCategory")} slices={summary.byCategory} total={summary.spent.cents} />
        <Breakdown title={t("byEvent")} slices={summary.byEvent} total={summary.spent.cents} fallback={t("noEvent")} />
        {!isPublic && <Breakdown title={t("byPerson")} slices={summary.byPerson} total={summary.spent.cents} />}
        <MonthlyChart data={summary.monthly} className={isPublic ? "md:col-span-2" : undefined} />
      </div>

      <div className={isPublic ? "" : "grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start md:gap-5"}>
        <Card>
          <CardHeader title={t("recent")} description={isPublic ? t("recentPublicHint") : undefined} />
          {transactions.length ? (
            <ExpenseList items={transactions} href={linkFor} showStatus={!isPublic} />
          ) : (
            <EmptyState title={t("nothingYet")} />
          )}
        </Card>

        {owed && (
          <Card>
            <CardHeader title={t("owedTitle")} description={t("owedHint")} />
            {owed.length ? (
              <ul className="divide-y divide-line">
                {owed.map((o) => (
                  <li key={o.userId} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <span className="min-w-0 truncate">{o.name}</span>
                    <span className="num shrink-0 font-medium">{formatMoney(o.cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted">{t("allPaid")}</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
