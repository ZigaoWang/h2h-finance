import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { DuplicateAlert } from "@/components/expense-detail";
import { DeleteAction, ReviewActions } from "@/components/review-actions";
import { ScreenshotThumb } from "@/components/screenshot-thumb";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate, formatDateTime, timestamp } from "@/lib/dates";
import { screenshotMismatches } from "@/lib/expenses/checks";
import { duplicateFlags, filesFor, listPendingReview } from "@/lib/expenses/queries";
import { localName } from "@/lib/i18n-names";
import { formatMoney } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("review") };
}

/** Everything waiting for a decision, one card each, with the screenshot and every action in place. */
export default async function ReviewPage() {
  await requireAdmin();
  const t = await getTranslations();
  const locale = await getLocale();
  const pending = listPendingReview();
  const ids = pending.map((e) => e.id);
  const flags = duplicateFlags(ids);
  const receipts = filesFor(ids);
  const total = pending.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <>
      <PageHeader
        title={t("reviewQueue.title")}
        description={pending.length ? t("reviewQueue.summary", { count: pending.length, total: formatMoney(total) }) : t("reviewQueue.description")}
      />

      {pending.length === 0 ? (
        <Panel>
          <EmptyState title={t("reviewQueue.emptyTitle")} description={t("reviewQueue.emptyHint")} />
        </Panel>
      ) : (
        <ul className="flex flex-col gap-4">
          {pending.map((e) => {
            const files = receipts.get(e.id) ?? [];
            const differ = screenshotMismatches(e, files[0]?.ocr);
            const meta = [
              e.merchant,
              formatDate(e.spentOn, locale),
              localName(locale, e.categoryEn, e.categoryZh),
              e.eventEn || e.eventZh ? localName(locale, e.eventEn, e.eventZh) : null,
            ].filter(Boolean);
            return (
              <li key={e.id}>
                <Panel className="flex gap-4 p-4 sm:gap-5">
                  {files[0] && <ScreenshotThumb fileId={files[0].id} count={files.length} />}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[15px] font-medium">{e.description}</p>
                        <p className="mt-0.5 text-[13px] text-muted">
                          <span className="font-medium text-ink-2">{e.userName}</span> · <time title={formatDateTime(e.createdAt, locale)}>{formatDate(timestamp(e.createdAt).slice(0, 10), locale)}</time>
                        </p>
                      </div>
                      <p className="num shrink-0 text-lg font-semibold tracking-tight">{formatMoney(e.amountCents)}</p>
                    </div>
                    <p className="mt-2 text-[13px] text-ink-2">{meta.join(" · ")}</p>

                    <div className="mt-3 flex flex-col gap-2 empty:hidden">
                      {flags.get(e.id) && <DuplicateAlert flags={flags.get(e.id)!} isAdmin />}
                      {(differ.amountCents || differ.spentOn) && (
                        <Alert tone="warning" title={t("expense.mismatch.title")}>
                          {[
                            differ.amountCents && t("expense.mismatch.amount", { amount: formatMoney(differ.amountCents) }),
                            differ.spentOn && t("expense.mismatch.date", { date: formatDate(differ.spentOn, locale) }),
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </Alert>
                      )}
                    </div>

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                      <ReviewActions id={e.id} compact />
                      <ButtonLink href={`/expenses/${e.id}/edit`} variant="ghost" size="sm">
                        {t("expense.edit")}
                      </ButtonLink>
                      <DeleteAction id={e.id} />
                      <Link href={`/expenses/${e.id}`} className="ml-auto text-[13px] text-muted hover:text-ink">
                        {t("reviewQueue.details")}
                      </Link>
                    </div>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
