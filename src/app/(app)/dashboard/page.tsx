import { getLocale, getTranslations } from "next-intl/server";
import { DashboardBody } from "@/components/dashboard/dashboard-body";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { YearSwitch } from "@/components/year-switch";
import { requireUser } from "@/lib/auth/dal";
import { formatDate } from "@/lib/dates";
import { recentTransactions, yearSummary } from "@/lib/stats";
import { listYears, selectYear } from "@/lib/years";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const year = selectYear((await searchParams).year);

  if (!year) {
    return (
      <>
        <PageHeader title={t("title")} />
        <Panel>
          <EmptyState
            title={t("noYearTitle")}
            description={user.role === "admin" ? t("noYearAdmin") : t("noYearMember")}
            action={user.role === "admin" && <ButtonLink href="/admin">{t("setUpYear")}</ButtonLink>}
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        description={`${year.label} · ${formatDate(year.startsOn, locale)} – ${formatDate(year.endsOn, locale)}`}
        action={<YearSwitch years={listYears()} value={year.id} />}
      />
      <DashboardBody
        summary={yearSummary(year, { includePeople: true })}
        transactions={recentTransactions(year, { publicView: false })}
        linkFor={(item) => (user.role === "admin" || item.userId === user.id ? `/expenses/${item.id}` : undefined)}
        viewAll={user.role === "admin" ? "/all-expenses" : undefined}
      />
    </>
  );
}
