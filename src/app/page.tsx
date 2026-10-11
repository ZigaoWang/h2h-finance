import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { DashboardBody } from "@/components/dashboard/dashboard-body";
import { LocaleSwitch } from "@/components/locale-switch";
import { LogoMark } from "@/components/logo";
import { MadeBy } from "@/components/made-by";
import { YearSwitch } from "@/components/year-switch";
import { EmptyState, Panel } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/dal";
import { formatDate } from "@/lib/dates";
import { isPublicPageEnabled } from "@/lib/settings";
import { recentTransactions, yearSummary } from "@/lib/stats";
import { listYears, selectYear } from "@/lib/years";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: { absolute: t("title") }, description: t("description"), robots: { index: true, follow: true } };
}

/** The public face: budget, totals and breakdowns. Never receipts, names, shops or notes. */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const t = await getTranslations();
  const locale = await getLocale();
  const signedIn = !!(await getSessionUser());
  const enabled = isPublicPageEnabled();
  const year = enabled ? selectYear((await searchParams).year) : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pt-10 pb-16 sm:px-6 md:pt-16">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 md:mb-12">
          <div className="flex items-center gap-4">
            <LogoMark size={56} />
            <div>
              <h1 className="text-[24px] leading-tight font-semibold tracking-tight sm:text-[28px]">{t("brand.name")}</h1>
              {year && (
                <p className="mt-1 text-[13px] text-muted">
                  {year.label} · {formatDate(year.startsOn, locale)} – {formatDate(year.endsOn, locale)}
                </p>
              )}
            </div>
          </div>
          {year && <YearSwitch years={listYears()} value={year.id} />}
        </header>

        {!enabled ? (
          <Panel>
            <EmptyState title={t("home.private")} />
          </Panel>
        ) : year ? (
          <DashboardBody publicView summary={yearSummary(year, { includePeople: false })} transactions={recentTransactions(year, { publicView: true, limit: 25 })} />
        ) : (
          <Panel>
            <EmptyState title={t("home.noYear")} />
          </Panel>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <a href="https://h2h.ykps.net" className="font-medium text-ink-2 hover:text-ink">
              {t("home.mainSite")}
            </a>
            <span aria-hidden>·</span>
            <MadeBy />
          </p>
          <div className="flex items-center gap-4">
            <LocaleSwitch />
            <Link href={signedIn ? "/dashboard" : "/login"} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline hover:underline-offset-4">
              {signedIn ? t("home.openDashboard") : t("home.signIn")}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
