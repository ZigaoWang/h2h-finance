import { Download } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState, Panel, Section } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate, today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isPublicPageEnabled } from "@/lib/settings";
import { yearSummary } from "@/lib/stats";
import { listYears } from "@/lib/years";
import { yearExpenseCount } from "@/lib/admin";
import { YearDelete } from "./year-delete";
import { AccessSettings } from "./access";
import { PublicPageToggle } from "./public-page-toggle";
import { YearDialogButton } from "./year-dialog";

function suggestNextYear(latestEnd?: string) {
  // School years run September to August.
  const start = latestEnd
    ? new Date(new Date(`${latestEnd}T00:00:00Z`).getTime() + 86_400_000)
    : (() => {
        const [y, m] = today().split("-").map(Number);
        return new Date(Date.UTC(m >= 8 ? y : y - 1, 8, 1));
      })();
  const startYear = start.getUTCFullYear();
  const end = new Date(Date.UTC(startYear + 1, start.getUTCMonth(), start.getUTCDate() - 1));
  return {
    label: `${startYear}–${String(startYear + 1).slice(2)}`,
    startsOn: start.toISOString().slice(0, 10),
    endsOn: end.toISOString().slice(0, 10),
    budget: "",
  };
}

export default async function AdminBudgetPage() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const years = listYears();

  return (
    <div className="flex flex-col gap-10">
      <Section title={t("years.title")} description={t("years.description")} action={<YearDialogButton initial={suggestNextYear(years[0]?.endsOn)} />}>
        <Panel>
        {years.length === 0 ? (
          <EmptyState title={t("years.empty")} description={t("years.emptyHint")} />
        ) : (
          <ul className="divide-y divide-line">
            {years.map((year) => {
              const summary = yearSummary(year, { includePeople: false });
              return (
                <li key={year.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{year.label}</p>
                    <p className="text-[13px] text-muted">
                      {formatDate(year.startsOn, locale)} – {formatDate(year.endsOn, locale)}
                    </p>
                  </div>
                  <dl className="flex gap-6 text-sm">
                    <div>
                      <dt className="text-[13px] text-muted">{t("years.budget")}</dt>
                      <dd className="num font-medium">{formatMoney(year.budgetCents)}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted">{t("years.spent")}</dt>
                      <dd className="num font-medium">{formatMoney(summary.spent.cents)}</dd>
                    </div>
                  </dl>
                  <div className="flex gap-2">
                    <YearDialogButton
                      initial={{ id: String(year.id), label: year.label, startsOn: year.startsOn, endsOn: year.endsOn, budget: (year.budgetCents / 100).toFixed(2) }}
                    />
                    {yearExpenseCount(year.id) === 0 && <YearDelete id={year.id} label={year.label} />}
                    <a
                      href={`/api/export?year=${year.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-subtle"
                    >
                      <Download className="size-3.5" aria-hidden />
                      {t("years.export")}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </Panel>
      </Section>

      <Section title={t("access.title")} description={t("access.description")}>
        <Panel>
          <AccessSettings />
        </Panel>
      </Section>

      <Section title={t("public.title")} description={t("public.description")}>
        <Panel>
          <PublicPageToggle enabled={isPublicPageEnabled()} />
        </Panel>
      </Section>
    </div>
  );
}
