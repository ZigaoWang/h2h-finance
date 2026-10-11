import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import type { YearSummary } from "@/lib/stats";
import { cn } from "@/lib/cn";

/** Hero: how much of the budget is spent, then the figures that follow from it. */
export function BudgetOverview({ summary, showOwed }: { summary: YearSummary; showOwed: boolean }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { budgetCents, spent, remainingCents } = summary;
  const share = budgetCents > 0 ? spent.cents / budgetCents : 0;
  const over = remainingCents < 0;
  const percent = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en", { style: "percent", maximumFractionDigits: 0 });

  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="px-5 pt-5 pb-6 sm:px-6">
        <p className="text-sm text-muted">{t("spent")}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-4xl font-semibold tracking-tight sm:text-5xl">{formatMoney(spent.cents)}</span>
          <span className="text-sm text-muted">{t("ofBudget", { budget: formatMoney(budgetCents) })}</span>
        </p>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-subtle"
          role="meter"
          aria-label={t("budgetUsed")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
        >
          <div
            className={cn("h-full rounded-full", over ? "bg-danger" : "bg-ink")}
            style={{ width: `${Math.min(100, share * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {budgetCents > 0 ? t("budgetUsedShare", { share: percent.format(share) }) : t("noBudget")}
        </p>
      </div>
      <dl className={cn("grid grid-cols-2 border-t border-line", showOwed ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        <Figure label={t("remaining")} value={formatMoney(remainingCents)} tone={over ? "danger" : undefined} />
        <Figure label={t("expenseCount")} value={String(spent.count)} />
        <Figure label={t("pendingReview")} value={formatMoney(summary.pending.cents)} hint={t("items", { count: summary.pending.count })} />
        {showOwed && (
          <Figure label={t("owed")} value={formatMoney(summary.owed.cents)} hint={t("items", { count: summary.owed.count })} />
        )}
      </dl>
    </section>
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" }) {
  return (
    <div className="border-line px-5 py-4 not-last:border-r max-sm:nth-[2n]:border-r-0 max-sm:nth-[n+3]:border-t sm:px-6">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cn("mt-1 text-lg font-semibold tracking-tight", tone === "danger" && "text-danger")}>{value}</dd>
      {hint && <dd className="text-xs text-faint">{hint}</dd>}
    </div>
  );
}
