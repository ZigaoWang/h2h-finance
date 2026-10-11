import { useLocale, useTranslations } from "next-intl";
import { Panel, Section } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

function compact(cents: number, locale: string) {
  return `¥${new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100)}`;
}

/** A round axis maximum (1, 2 or 5 × a power of ten) so the gridlines land on clean numbers. */
function niceMax(cents: number) {
  if (cents <= 0) return 0;
  const yuan = cents / 100;
  const magnitude = 10 ** Math.floor(Math.log10(yuan));
  const step = [1, 2, 5, 10].find((m) => m * magnitude >= yuan)! * magnitude;
  return step * 100;
}

/** Spending per month across the budget year, with exact values on each bar and on hover. */
export function MonthlyChart({ data, className }: { data: { month: string; cents: number }[]; className?: string }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const top = niceMax(Math.max(...data.map((d) => d.cents), 0));
  const current = today().slice(0, 7);
  const fmt = (month: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { ...options, timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const ticks = top ? [top, top / 2, 0] : [];

  return (
    <Section title={t("byMonth")} className={className}>
      <Panel className="overflow-visible px-4 pt-6 pb-4 sm:px-5">
        <div className="flex gap-3">
          {/* Y axis */}
          <div className="relative h-44 w-10 shrink-0 text-right" aria-hidden>
            {ticks.map((tick) => (
              <span key={tick} className="num absolute right-0 -translate-y-1/2 text-[11px] text-faint" style={{ top: `${(1 - tick / top) * 100}%` }}>
                {compact(tick, locale)}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative flex h-44 items-end gap-1 sm:gap-2">
              {ticks.map((tick) => (
                <span key={tick} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - tick / top) * 100}%` }} aria-hidden />
              ))}
              {data.map((d, i) => (
                <div
                  key={d.month}
                  tabIndex={0}
                  aria-label={`${fmt(d.month, { month: "long", year: "numeric" })}: ${formatMoney(d.cents)}`}
                  className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
                >
                  <div
                    className={cn(
                      "relative w-full max-w-8 rounded-t-[4px] transition-colors",
                      d.month === current ? "bg-ink" : "bg-ink/70 group-hover:bg-ink group-focus-visible:bg-ink",
                    )}
                    style={{ height: top ? `${(d.cents / top) * 100}%` : 0, minHeight: d.cents > 0 ? 3 : 0 }}
                  >
                    {d.cents > 0 && (
                      <span className="num absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 text-[10px] whitespace-nowrap text-muted sm:block">
                        {compact(d.cents, locale)}
                      </span>
                    )}
                    <div
                      className={cn(
                        "pointer-events-none absolute bottom-full z-10 mb-6 hidden rounded-md bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-pop group-hover:block group-focus-visible:block",
                        i < 2 ? "left-0" : i >= data.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2",
                      )}
                    >
                      <p className="text-muted">{fmt(d.month, { month: "long", year: "numeric" })}</p>
                      <p className="num font-medium">{formatMoney(d.cents)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1 sm:gap-2" aria-hidden>
              {data.map((d, i) => (
                <span
                  key={d.month}
                  className={cn("min-w-0 flex-1 overflow-hidden text-center text-[11px] whitespace-nowrap", d.month === current ? "font-medium text-ink" : "text-muted")}
                >
                  {(data.length <= 12 || i % 2 === 0) && (
                    <>
                      {/* Single letters on phones, where twelve short names don't fit. */}
                      <span className="sm:hidden">{fmt(d.month, { month: "narrow" })}</span>
                      <span className="hidden sm:inline">{fmt(d.month, { month: "short" })}</span>
                    </>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </Section>
  );
}
