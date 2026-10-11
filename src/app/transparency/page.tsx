import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DashboardBody } from "@/components/dashboard/dashboard-body";
import { LocaleSwitch } from "@/components/locale-switch";
import { Logo } from "@/components/logo";
import { YearSwitch } from "@/components/year-switch";
import { Card, EmptyState } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { isPublicPageEnabled } from "@/lib/settings";
import { recentTransactions, yearSummary } from "@/lib/stats";
import { listYears, selectYear } from "@/lib/years";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transparency");
  return { title: t("title"), description: t("description"), robots: { index: true, follow: true } };
}

/** The public dashboard: budget, totals and breakdowns. Never receipts, names, shops or notes. */
export default async function TransparencyPage({ searchParams }: PageProps<"/transparency">) {
  if (!isPublicPageEnabled()) notFound();
  const t = await getTranslations();
  const locale = await getLocale();
  const year = selectYear((await searchParams).year);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo label={t("brand.name")} />
          <div className="flex items-center gap-3">
            <LocaleSwitch />
            <Link href="/login" className="text-sm text-muted hover:text-ink">
              {t("transparency.memberSignIn")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 md:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-brand">{t("transparency.eyebrow")}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{t("transparency.heading")}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{t("transparency.intro")}</p>
          </div>
          {year && <YearSwitch years={listYears()} value={year.id} />}
        </div>

        {year ? (
          <>
            <p className="mb-4 text-sm text-muted">
              {year.label} · {formatDate(year.startsOn, locale)} – {formatDate(year.endsOn, locale)}
            </p>
            <DashboardBody summary={yearSummary(year, { includePeople: false })} transactions={recentTransactions(year, { publicView: true, limit: 25 })} />
          </>
        ) : (
          <Card>
            <EmptyState title={t("transparency.noYear")} />
          </Card>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-[13px] leading-relaxed text-muted sm:px-6">
          <p>{t("transparency.footer")}</p>
        </div>
      </footer>
    </div>
  );
}
