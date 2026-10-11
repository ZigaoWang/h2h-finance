import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard, Lock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { DashboardBody } from "@/components/dashboard/dashboard-body";
import { LocaleSwitch } from "@/components/locale-switch";
import { LogoMark } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
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
      {/* This site is part of the club's website; the way back is always in view. */}
      <div className="border-b border-line bg-[#fafafa]">
        <div className="mx-auto flex h-11 max-w-[1080px] items-center justify-between gap-3 px-4 sm:px-6">
          <a href="https://h2h.ykps.net" className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{t("home.mainSite")}</span>
          </a>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              aria-label={signedIn ? t("home.openDashboard") : t("home.signIn")}
              className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
            >
              {signedIn ? <LayoutDashboard className="size-3.5" aria-hidden /> : <Lock className="size-3" aria-hidden />}
              {/* Icon only on the narrowest phones, so the bar never pushes the page sideways. */}
              <span className="max-[400px]:sr-only">{signedIn ? t("home.openDashboard") : t("home.signIn")}</span>
            </Link>
            <LocaleSwitch />
          </div>
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pt-10 pb-16 sm:px-6 md:pt-14">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 md:mb-12">
          <div className="flex items-center gap-4">
            <a href="https://h2h.ykps.net" aria-label={t("home.mainSite")} className="shrink-0 transition-opacity hover:opacity-80">
              <LogoMark size={56} />
            </a>
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
          <DashboardBody publicView summary={yearSummary(year, { includePeople: false })} transactions={recentTransactions(year, { publicView: true })} />
        ) : (
          <Panel>
            <EmptyState title={t("home.noYear")} />
          </Panel>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
