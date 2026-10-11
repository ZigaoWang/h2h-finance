import { useLocale, useTranslations } from "next-intl";
import { Panel } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { YearSummary } from "@/lib/stats";

type Figure = { label: string; value: string; hint?: string; tone?: "danger" };

/**
 * The year at a glance: spending against the budget and against how much of the year has gone,
 * then the figures that follow from it.
 */
export function BudgetOverview({ summary }: { summary: YearSummary }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { budgetCents, spent, remainingCents, yearProgress } = summary;
  const share = budgetCents > 0 ? spent.cents / budgetCents : 0;
  const over = remainingCents < 0;
  // Spending well ahead of the calendar is worth noticing before the money runs out.
  const ahead = !over && share > yearProgress + 0.15;
  const percent = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en", { style: "percent", maximumFractionDigits: 0 });
  const pct = (value: number) => (value > 0 && value < 0.01 ? `<${percent.format(0.01)}` : percent.format(value));

  const monthDelta = summary.thisMonthCents - summary.lastMonthCents;
  const thisMonth: Figure = {
    label: t("thisMonth"),
    value: formatMoney(summary.thisMonthCents),
    hint: summary.lastMonthCents || summary.thisMonthCents ? t("vsLastMonth", { amount: formatMoney(summary.lastMonthCents), sign: monthDelta > 0 ? "up" : monthDelta < 0 ? "down" : "same" }) : undefined,
  };
  const average: Figure = { label: t("average"), value: formatMoney(summary.averageCents), hint: t("perExpense") };
  const count: Figure = { label: t("expenseCount"), value: String(spent.count) };
  const remaining: Figure = { label: t("remaining"), value: formatMoney(remainingCents), tone: over ? "danger" : undefined };

  const figures: Figure[] = [
    { label: t("budget"), value: formatMoney(budgetCents) },
    remaining,
    count,
    average,
    { label: t("largest"), value: formatMoney(summary.largestCents) },
    thisMonth,
  ];

  return (
    <Panel className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="flex flex-col border-b border-line p-5 sm:p-6 lg:border-r lg:border-b-0">
        <p className="text-[13px] text-muted">{t("spent")}</p>
        <p className="num mt-1 text-[32px] leading-tight font-semibold tracking-tight">{formatMoney(spent.cents)}</p>
        <p className="mt-1 text-[13px] text-muted">{budgetCents > 0 ? t("ofBudget", { budget: formatMoney(budgetCents) }) : t("noBudget")}</p>

        {budgetCents > 0 && (
          <div className="mt-auto pt-6">
            <div className="relative h-2 rounded-full bg-subtle" role="meter" aria-label={t("budgetUsed")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
              <div
                className={cn("h-full rounded-full", over ? "bg-danger" : ahead ? "bg-pending" : "bg-ink")}
                style={{ width: `${Math.min(100, Math.max(share * 100, share > 0 ? 1 : 0))}%` }}
              />
              {/* Where spending would be if it went evenly through the year. */}
              <span className="absolute -top-1 h-4 w-px bg-ink-2" style={{ left: `${yearProgress * 100}%` }} aria-hidden />
            </div>
            <div className="mt-2.5 flex justify-between gap-4 text-[12px] text-muted">
              <span>{t("budgetUsedShare", { share: pct(share) })}</span>
              <span>{t("yearGone", { share: pct(yearProgress) })}</span>
            </div>
            {(ahead || over) && <p className="mt-2 text-[12px] font-medium text-pending">{over ? t("overBudget") : t("aheadOfPace")}</p>}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3">
        {figures.map((f, i) => (
          <div
            key={f.label}
            className={cn(
              "border-line p-5",
              // Hairlines between cells: right edges except each row's last, top edges after the first row.
              i % 2 === 0 && "max-sm:border-r",
              i >= 2 && "max-sm:border-t",
              i % 3 !== 2 && "sm:border-r",
              i >= 3 && "sm:border-t",
            )}
          >
            <dt className="text-[13px] text-muted">{f.label}</dt>
            <dd className={cn("num mt-1 text-lg font-semibold tracking-tight", f.tone === "danger" && "text-danger")}>{f.value}</dd>
            {f.hint && <dd className="mt-0.5 text-xs text-faint">{f.hint}</dd>}
          </div>
        ))}
      </dl>
    </Panel>
  );
}
