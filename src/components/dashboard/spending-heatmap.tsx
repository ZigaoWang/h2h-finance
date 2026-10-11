import { useLocale, useTranslations } from "next-intl";
import { Panel, Section } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

type Day = { date: string; cents: number; count: number };

const LEVELS = ["bg-subtle", "bg-ink/20", "bg-ink/40", "bg-ink/65", "bg-ink/90"];
const DAY_MS = 86_400_000;

const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Which shade a day gets: quartiles of the days that had spending, so one big day doesn't wash out the rest. */
function levelFor(cents: number, thresholds: number[]) {
  if (cents <= 0) return 0;
  return 1 + thresholds.filter((t) => cents > t).length;
}

/** Every day of the budget year, one square each, darker for more spending. */
export function SpendingHeatmap({ days, startsOn, endsOn }: { days: Day[]; startsOn: string; endsOn: string }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const amounts = days.map((d) => d.cents).filter((c) => c > 0).sort((a, b) => a - b);
  const quantile = (q: number) => amounts[Math.min(amounts.length - 1, Math.floor(q * amounts.length))] ?? 0;
  const thresholds = amounts.length ? [quantile(0.25), quantile(0.5), quantile(0.75)] : [];
  const now = today();

  // Columns are weeks starting on Monday, from the week containing the first day of the year.
  const start = Date.parse(`${startsOn}T00:00:00Z`);
  const end = Date.parse(`${endsOn}T00:00:00Z`);
  const firstMonday = start - ((new Date(start).getUTCDay() + 6) % 7) * DAY_MS;
  const weeks: string[][] = [];
  for (let week = firstMonday; week <= end; week += 7 * DAY_MS) {
    weeks.push(Array.from({ length: 7 }, (_, d) => iso(week + d * DAY_MS)));
  }

  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${date}T00:00:00Z`),
    );
  const monthLabel = (date: string) =>
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const activeDays = days.filter((d) => d.cents > 0).length;

  return (
    <Section title={t("byDay")} description={t("activeDays", { count: activeDays })}>
      <Panel className="px-4 py-5 sm:px-5">
        <div className="overflow-x-auto pb-1">
          {/* One grid: day labels in the first column, a column per week, month labels on top. */}
          <div
            className="grid min-w-[640px] gap-[3px]"
            style={{ gridTemplateColumns: `1.75rem repeat(${weeks.length}, minmax(0, 1fr))`, gridTemplateRows: "auto repeat(7, auto)" }}
          >
            {weeks.map((week, i) => {
              const firstOfMonth = week.find((d) => d.endsWith("-01") && d >= startsOn && d <= endsOn);
              if (!firstOfMonth && i !== 0) return null;
              return (
                <span
                  key={`m-${week[0]}`}
                  className="mb-1 text-[11px] whitespace-nowrap text-muted"
                  style={{ gridColumn: i + 2, gridRow: 1 }}
                  aria-hidden
                >
                  {monthLabel(firstOfMonth ?? startsOn)}
                </span>
              );
            })}
            {[t("mon"), "", t("wed"), "", t("fri"), "", ""].map((label, d) => (
              <span key={`d-${d}`} className="self-center text-[10px] leading-none text-faint" style={{ gridColumn: 1, gridRow: d + 2 }} aria-hidden>
                {label}
              </span>
            ))}
            {weeks.flatMap((week, i) =>
              week.map((date, d) => {
                const outside = date < startsOn || date > endsOn;
                const day = byDate.get(date);
                const label = day ? `${dateLabel(date)}: ${formatMoney(day.cents)} · ${t("items", { count: day.count })}` : dateLabel(date);
                return (
                  <span
                    key={date}
                    title={outside ? undefined : label}
                    aria-label={outside ? undefined : label}
                    style={{ gridColumn: i + 2, gridRow: d + 2 }}
                    className={cn(
                      "aspect-square w-full max-w-4 rounded-[3px]",
                      outside ? "bg-transparent" : LEVELS[levelFor(day?.cents ?? 0, thresholds)],
                      date === now && "ring-1 ring-ink ring-offset-1 ring-offset-surface",
                      date > now && !outside && "opacity-50",
                    )}
                  />
                );
              }),
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted" aria-hidden>
          {t("less")}
          {LEVELS.map((level) => (
            <span key={level} className={cn("size-3 rounded-[3px]", level)} />
          ))}
          {t("more")}
        </div>
      </Panel>
    </Section>
  );
}
