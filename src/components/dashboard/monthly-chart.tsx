import { useLocale, useTranslations } from "next-intl";
import { Panel, Section } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

function compact(cents: number, locale: string) {
  return `¥${new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100)}`;
}

/** Spending per month across the budget year. Each column shows its exact value on hover or focus. */
export function MonthlyChart({ data, className }: { data: { month: string; cents: number }[]; className?: string }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const max = Math.max(...data.map((d) => d.cents), 0);
  const monthLabel = (month: string) =>
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const fullLabel = (month: string) =>
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${month}-01T00:00:00Z`),
    );

  return (
    <Section title={t("byMonth")} className={className}>
      <Panel className="overflow-visible px-5 pt-7 pb-4">
        <div className="relative flex h-40 items-end gap-0.5 border-b border-line">
          {max > 0 && (
            <>
              <span className="num absolute -top-4 left-0 text-[11px] text-faint">{compact(max, locale)}</span>
              <span className="absolute inset-x-0 top-0 border-t border-line" aria-hidden />
            </>
          )}
          {data.map((d, i) => (
            <div
              key={d.month}
              tabIndex={0}
              aria-label={`${fullLabel(d.month)}: ${formatMoney(d.cents)}`}
              className="group flex h-full flex-1 items-end justify-center focus:outline-none"
            >
              <div
                className="relative w-full max-w-6 rounded-t-[4px] bg-ink/80 transition-colors group-hover:bg-ink group-focus-visible:bg-ink"
                style={{ height: max ? `${(d.cents / max) * 100}%` : 0, minHeight: d.cents > 0 ? 2 : 0 }}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute bottom-full z-10 mb-2 hidden rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-pop group-hover:block group-focus-visible:block",
                    i < 2 ? "left-0" : i >= data.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2",
                  )}
                >
                  <p className="text-muted">{fullLabel(d.month)}</p>
                  <p className="num font-medium">{formatMoney(d.cents)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-0.5" aria-hidden>
          {data.map((d, i) => (
            <span key={d.month} className="flex-1 text-center text-[11px] text-muted">
              {data.length <= 12 || i % 2 === 0 ? monthLabel(d.month) : ""}
            </span>
          ))}
        </div>
      </Panel>
    </Section>
  );
}
