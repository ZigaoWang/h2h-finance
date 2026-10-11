import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ExpenseDetailView } from "@/components/expense-detail";
import { EmptyState, Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { duplicateFlags, filesFor, getExpenseDetail, listPendingReview } from "@/lib/expenses/queries";
import { formatMoney } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("review") };
}

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const admin = await requireAdmin();
  const t = await getTranslations("reviewQueue");
  const locale = await getLocale();
  const pending = listPendingReview();
  const ids = pending.map((e) => e.id);
  const flags = duplicateFlags(ids);
  const thumbs = filesFor(ids);

  // After approving, the same URL falls through to the next expense in line.
  const requested = Number((await searchParams).id);
  const explicit = pending.some((e) => e.id === requested);
  const selected = explicit ? requested : pending[0]?.id;
  const total = pending.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <>
      <div className={cn(explicit && "max-xl:hidden")}>
        <PageHeader
          title={t("title")}
          description={pending.length ? t("summary", { count: pending.length, total: formatMoney(total) }) : t("description")}
        />
      </div>

      {pending.length === 0 ? (
        <Panel>
          <EmptyState title={t("emptyTitle")} description={t("emptyHint")} />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
          <Panel className={cn("xl:sticky xl:top-10", explicit && "max-xl:hidden")}>
            <ul className="divide-y divide-line xl:max-h-[calc(100dvh-5rem)] xl:overflow-y-auto">
              {pending.map((e) => {
                const thumb = thumbs.get(e.id)?.[0];
                return (
                  <li key={e.id}>
                    <Link
                      href={`/review?id=${e.id}`}
                      aria-current={e.id === selected ? "true" : undefined}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-subtle/60 xl:aria-[current=true]:bg-subtle"
                    >
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-line bg-subtle">
                        {thumb && (
                          // eslint-disable-next-line @next/next/no-img-element -- private, access-checked files
                          <img src={`/api/files/${thumb.id}?size=thumb`} alt="" className="size-full object-cover object-top" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium">{e.userName}</p>
                          <p className="num shrink-0 text-sm font-medium">{formatMoney(e.amountCents)}</p>
                        </div>
                        <p className="truncate text-[13px] text-muted">{e.description}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
                          {formatDate(e.spentOn, locale)}
                          {flags.has(e.id) && (
                            <span className="inline-flex items-center gap-1 text-pending">
                              <AlertTriangle className="size-3" aria-hidden />
                              {t("possibleDuplicate")}
                            </span>
                          )}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {selected && (
            <section className={cn(!explicit && "max-xl:hidden")} aria-label={t("selected")}>
              <Link href="/review" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink xl:hidden">
                <ArrowLeft className="size-4" aria-hidden />
                {t("backToQueue", { count: pending.length })}
              </Link>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold">{t("expense", { id: selected })}</h2>
                <Link href={`/expenses/${selected}`} className="text-sm text-muted hover:text-ink">
                  {t("openFull")}
                </Link>
              </div>
              <ExpenseDetailView detail={getExpenseDetail(selected, admin)} viewer={admin} inQueue />
            </section>
          )}
        </div>
      )}
    </>
  );
}
