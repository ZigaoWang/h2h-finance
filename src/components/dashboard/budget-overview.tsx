import { useLocale, useTranslations } from "next-intl";
import { Panel } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { YearSummary } from "@/lib/stats";

/** The year at a glance: spent against budget, then the figures that follow from it. */
export function BudgetOverview({ summary, publicView }: { summary: YearSummary; publicView: boolean }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { budgetCents, spent, remainingCents } = summary;
  const share = budgetCents > 0 ? spent.cents / budgetCents : 0;
  const over = remainingCents < 0;
  const percent = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en", { style: "percent", maximumFractionDigits: 0 });
  const shareLabel = share > 0 && share < 0.01 ? `<${percent.format(0.01)}` : percent.format(share);

  return (
    <Panel className="grid grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
      <div className="col-span-2 border-b border-line p-5 lg:col-span-1 lg:border-r lg:border-b-0">
        <p className="text-[13px] text-muted">{t("spent")}</p>
        <p className="num mt-1 text-[28px] leading-tight font-semibold tracking-tight">{formatMoney(spent.cents)}</p>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-subtle"
          role="meter"
          aria-label={t("budgetUsed")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
        >
          <div className={cn("h-full rounded-full", over ? "bg-danger" : "bg-ink")} style={{ width: `${Math.min(100, share * 100)}%` }} />
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {budgetCents <= 0
            ? t("noBudget")
            : publicView
              ? t("budgetUsedShare", { share: shareLabel })
              : t("ofBudgetShare", { budget: formatMoney(budgetCents), share: shareLabel })}
        </p>
      </div>
      {publicView ? (
        <>
          <Figure label={t("budget")} value={formatMoney(budgetCents)} className="border-r border-line" />
          <Figure label={t("remaining")} value={formatMoney(remainingCents)} tone={over ? "danger" : undefined} className="max-lg:border-b max-lg:border-line lg:border-r lg:border-line" />
          <Figure label={t("expenseCount")} value={String(spent.count)} className="max-lg:col-span-2" />
        </>
      ) : (
        <>
          <Figure label={t("remaining")} value={formatMoney(remainingCents)} tone={over ? "danger" : undefined} className="border-r border-line" />
          <Figure
            label={t("pendingReview")}
            value={formatMoney(summary.pending.cents)}
            hint={t("items", { count: summary.pending.count })}
            className="max-lg:border-b max-lg:border-line lg:border-r lg:border-line"
          />
          <Figure label={t("owed")} value={formatMoney(summary.owed.cents)} hint={t("items", { count: summary.owed.count })} className="max-lg:col-span-2" />
        </>
      )}
    </Panel>
  );
}

function Figure({ label, value, hint, tone, className }: { label: string; value: string; hint?: string; tone?: "danger"; className?: string }) {
  return (
    <div className={cn("p-5", className)}>
      <p className="text-[13px] text-muted">{label}</p>
      <p className={cn("num mt-1 text-lg font-semibold tracking-tight", tone === "danger" && "text-danger")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
    </div>
  );
}
