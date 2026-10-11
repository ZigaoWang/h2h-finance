import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExpenseList, type ListItem } from "@/components/expense-list";
import { EmptyState, Panel, Section } from "@/components/ui/card";
import type { Transaction, YearSummary } from "@/lib/stats";
import { BudgetOverview } from "./budget-overview";
import { Breakdown } from "./breakdown";
import { MonthlyChart } from "./monthly-chart";

/** The shared dashboard. The public view leaves out people. */
export function DashboardBody({
  summary,
  transactions,
  publicView,
  linkFor,
  viewAll,
}: {
  summary: YearSummary;
  transactions: Transaction[];
  publicView?: boolean;
  linkFor?: (item: ListItem) => string | undefined;
  viewAll?: string;
}) {
  const t = useTranslations("dashboard");
  const isPublic = !!publicView;

  return (
    <div className="flex flex-col gap-10">
      <BudgetOverview summary={summary} />

      <div className={isPublic ? "grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-6" : "grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-6 xl:grid-cols-3"}>
        <Breakdown title={t("byCategory")} slices={summary.byCategory} total={summary.spent.cents} />
        <Breakdown title={t("byEvent")} slices={summary.byEvent} total={summary.spent.cents} fallback={t("noEvent")} />
        {!isPublic && <Breakdown title={t("byPerson")} slices={summary.byPerson} total={summary.spent.cents} />}
      </div>

      <MonthlyChart data={summary.monthly} />

      <Section
        title={t("recent")}
        description={isPublic ? t("recentPublicHint") : undefined}
        action={
          viewAll && (
            <Link href={viewAll} className="text-[13px] font-medium text-ink-2 hover:text-ink">
              {t("viewAll")}
            </Link>
          )
        }
      >
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
