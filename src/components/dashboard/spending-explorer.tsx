"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ExpenseList, type ListItem } from "@/components/expense-list";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, Section } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { localName } from "@/lib/i18n-names";
import { formatMoney } from "@/lib/money";

type Day = { date: string; cents: number; count: number };
export type ExplorerItem = ListItem & { href?: string };

const LEVELS = ["bg-subtle", "bg-ink/20", "bg-ink/40", "bg-ink/65", "bg-ink/90"];
const DAY_MS = 86_400_000;
const PAGE = 20;

const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Quartiles of the days that had spending, so one big day doesn't wash out the rest. */
function levelFor(cents: number, thresholds: number[]) {
  if (cents <= 0) return 0;
  return 1 + thresholds.filter((t) => cents > t).length;
}

/**
 * The year's spending day by day, with the list of expenses under it. Clicking a day narrows the
 * list to that day; search and filters narrow it further.
 */
export function SpendingExplorer({
  items,
  days,
  startsOn,
  endsOn,
  today,
  showMember,
  viewAll,
}: {
  items: ExplorerItem[];
  days: Day[];
  startsOn: string;
  endsOn: string;
  today: string;
  showMember: boolean;
  viewAll?: string;
}) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [event, setEvent] = useState("");
  const [shown, setShown] = useState(PAGE);

  // Category and event names in the reader's language, for the filters.
  const labelled = useMemo(
    () =>
      items.map((i) => ({
        item: i,
        category: localName(locale, i.categoryEn, i.categoryZh),
        event: i.eventEn || i.eventZh ? localName(locale, i.eventEn, i.eventZh) : "",
      })),
    [items, locale],
  );
  const categories = useMemo(() => [...new Set(labelled.map((l) => l.category))].sort(), [labelled]);
  const events = useMemo(() => [...new Set(labelled.map((l) => l.event).filter(Boolean))].sort(), [labelled]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return labelled
      .filter(
        (l) =>
          (!selected || l.item.spentOn === selected) &&
          (!category || l.category === category) &&
          (!event || l.event === event) &&
          (!q || [l.item.description, l.item.merchant, l.item.userName].some((v) => v?.toLowerCase().includes(q))),
      )
      .map((l) => l.item);
  }, [labelled, selected, category, event, query]);
  const total = filtered.reduce((sum, i) => sum + i.amountCents, 0);
  const filtering = !!(selected || category || event || query.trim());

  // Heatmap layout: a column per week starting on Monday, from the week containing the first day.
  const byDate = new Map(days.map((d) => [d.date, d]));
  const amounts = days.map((d) => d.cents).filter((c) => c > 0).sort((a, b) => a - b);
  const quantile = (q: number) => amounts[Math.min(amounts.length - 1, Math.floor(q * amounts.length))] ?? 0;
  const thresholds = amounts.length ? [quantile(0.25), quantile(0.5), quantile(0.75)] : [];
  const start = Date.parse(`${startsOn}T00:00:00Z`);
  const end = Date.parse(`${endsOn}T00:00:00Z`);
  const firstMonday = start - ((new Date(start).getUTCDay() + 6) % 7) * DAY_MS;
  const weeks: string[][] = [];
  for (let week = firstMonday; week <= end; week += 7 * DAY_MS) {
    weeks.push(Array.from({ length: 7 }, (_, d) => iso(week + d * DAY_MS)));
  }
  const fmt = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const longDate = (date: string) => fmt(date, { day: "numeric", month: "short", year: "numeric" });
  const activeDays = days.filter((d) => d.cents > 0).length;

  const pick = (date: string) => {
    setSelected((current) => (current === date ? null : date));
    setShown(PAGE);
  };

  return (
    <>
      <Section title={t("byDay")} description={t("byDayHint", { count: activeDays })}>
        <Panel className="px-4 py-5 sm:px-5">
          <div className="overflow-x-auto pb-1">
            <div
              className="grid min-w-[640px] gap-[3px]"
              style={{ gridTemplateColumns: `1.75rem repeat(${weeks.length}, minmax(0, 1fr))`, gridTemplateRows: "auto repeat(7, auto)" }}
            >
              {weeks.map((week, i) => {
                const firstOfMonth = week.find((d) => d.endsWith("-01") && d >= startsOn && d <= endsOn);
                if (!firstOfMonth && i !== 0) return null;
                return (
                  <span key={`m-${week[0]}`} className="mb-1 text-[11px] whitespace-nowrap text-muted" style={{ gridColumn: i + 2, gridRow: 1 }} aria-hidden>
                    {fmt(firstOfMonth ?? startsOn, { month: "short" })}
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
                  const style = { gridColumn: i + 2, gridRow: d + 2 };
                  if (date < startsOn || date > endsOn) return <span key={date} style={style} aria-hidden />;
                  const day = byDate.get(date);
                  const label = day ? `${longDate(date)}: ${formatMoney(day.cents)} · ${t("items", { count: day.count })}` : longDate(date);
                  return (
                    <button
                      key={date}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={selected === date}
                      disabled={date > today}
                      onClick={() => pick(date)}
                      style={style}
                      className={cn(
                        "aspect-square w-full max-w-4 rounded-[3px] transition-transform hover:scale-125 focus-visible:scale-125 disabled:pointer-events-none disabled:opacity-40",
                        LEVELS[levelFor(day?.cents ?? 0, thresholds)],
                        date === today && "outline-1 outline-offset-1 outline-ink/50",
                        selected === date && "outline-2 outline-offset-1 outline-ink",
                      )}
                    />
                  );
                }),
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted">
            <span>{t("clickDay")}</span>
            <span className="flex items-center gap-1.5" aria-hidden>
              <span className="mr-2 inline-flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] bg-subtle outline-1 outline-offset-1 outline-ink/50" />
                {t("today")}
              </span>
              {t("less")}
              {LEVELS.map((level) => (
                <span key={level} className={cn("size-3 rounded-[3px]", level)} />
              ))}
              {t("more")}
            </span>
          </div>
        </Panel>
      </Section>

      <Section
        title={t("spending")}
        description={filtering ? t("filteredSummary", { count: filtered.length, total: formatMoney(total) }) : t("allSummary", { count: items.length, total: formatMoney(total) })}
        action={
          viewAll && (
            <Link href={viewAll} className="text-[13px] font-medium text-ink-2 hover:text-ink">
              {t("manage")}
            </Link>
          )
        }
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE);
              }}
              placeholder={showMember ? t("searchMembers") : t("search")}
              aria-label={t("search")}
              className="pl-9"
            />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("byCategory")} className="sm:w-48">
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          {events.length > 0 && (
            <Select value={event} onChange={(e) => setEvent(e.target.value)} aria-label={t("byEvent")} className="sm:w-48">
              <option value="">{t("allEvents")}</option>
              {events.map((ev) => (
                <option key={ev}>{ev}</option>
              ))}
            </Select>
          )}
        </div>
        {selected && (
          <div className="mb-3 flex">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink pr-2 pl-3 text-[12px] font-medium text-white"
            >
              {longDate(selected)}
              <X className="size-3.5" aria-label={t("clearDay")} />
            </button>
          </div>
        )}

        <Panel>
          {filtered.length ? (
            <ExpenseList items={filtered.slice(0, shown)} href={(item) => (item as ExplorerItem).href} showStatus={false} showMember={showMember} />
          ) : (
            <EmptyState title={selected && !filtering ? t("nothingThatDay") : t("noMatches")} />
          )}
        </Panel>
        {filtered.length > shown && (
          <div className="mt-3 flex justify-center">
            <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
              {t("showMore", { count: Math.min(PAGE, filtered.length - shown) })}
            </Button>
          </div>
        )}
      </Section>
    </>
  );
}
