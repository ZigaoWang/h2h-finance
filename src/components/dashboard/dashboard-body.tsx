import { useTranslations } from "next-intl";
import { ExpenseList, type ListItem } from "@/components/expense-list";
import { EmptyState, Panel, Section } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { Transaction, YearSummary } from "@/lib/stats";
import { BudgetOverview } from "./budget-overview";
import { Breakdown } from "./breakdown";
import { MonthlyChart } from "./monthly-chart";

type Owed = { userId: number; name: string; cents: number; count: number };

/** The shared dashboard. The public page passes no `owed` and gets no names. */
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
    <div className="flex flex-col gap-10">
      <BudgetOverview summary={summary} publicView={isPublic} />

      <div className={isPublic ? "grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-6" : "grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-6 xl:grid-cols-3"}>
        <Breakdown title={t("byCategory")} slices={summary.byCategory} total={summary.spent.cents} />
        <Breakdown title={t("byEvent")} slices={summary.byEvent} total={summary.spent.cents} fallback={t("noEvent")} />
        {!isPublic && <Breakdown title={t("byPerson")} slices={summary.byPerson} total={summary.spent.cents} />}
      </div>

      <div className={isPublic ? "" : "grid grid-cols-1 gap-8 md:gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"}>
        <MonthlyChart data={summary.monthly} />
        {owed && (
          <Section title={t("owedTitle")} description={t("owedHint")}>
            <Panel>
              {owed.length ? (
                <ul className="divide-y divide-line">
                  {owed.map((o) => (
                    <li key={o.userId} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <span className="min-w-0 truncate">{o.name}</span>
                      <span className="num shrink-0 font-medium">{formatMoney(o.cents)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-8 text-center text-[13px] text-muted">{t("allPaid")}</p>
              )}
            </Panel>
          </Section>
        )}
      </div>

      <Section title={t("recent")} description={isPublic ? t("recentPublicHint") : undefined}>
        <Panel>
          {transactions.length ? (
            <ExpenseList items={transactions} href={linkFor} showStatus={!isPublic} />
          ) : (
            <EmptyState title={t("nothingYet")} />
          )}
        </Panel>
      </Section>
    </div>
  );
}
