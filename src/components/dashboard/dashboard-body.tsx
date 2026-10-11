import { useTranslations } from "next-intl";
import type { ListItem } from "@/components/expense-list";
import { today } from "@/lib/dates";
import type { Transaction, YearSummary } from "@/lib/stats";
import { BudgetOverview } from "./budget-overview";
import { Breakdown } from "./breakdown";
import { MonthlyChart } from "./monthly-chart";
import { SpendingExplorer } from "./spending-explorer";

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

      <SpendingExplorer
        items={transactions.map((item) => ({ ...item, href: linkFor?.(item) }))}
        days={summary.daily}
        startsOn={summary.startsOn}
        endsOn={summary.endsOn}
        today={today()}
        showMember={!isPublic}
        viewAll={viewAll}
      />
    </div>
  );
}
