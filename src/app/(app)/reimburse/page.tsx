import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState, Panel, Section } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { listReimbursements } from "@/lib/reimbursements";
import { owedByMember } from "@/lib/stats";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("reimburse") };
}

export default async function ReimbursePage() {
  await requireAdmin();
  const t = await getTranslations("reimburse");
  const locale = await getLocale();
  const owed = owedByMember();
  const history = listReimbursements();
  const total = owed.reduce((sum, o) => sum + o.cents, 0);

  return (
    <>
      <PageHeader title={t("title")} description={owed.length ? t("summary", { total: formatMoney(total), count: owed.length }) : t("description")} />
      <div className="flex flex-col gap-10">
        <Section title={t("owedTitle")} description={t("owedHint")}>
          <Panel>
          {owed.length ? (
            <ul className="divide-y divide-line">
              {owed.map((o) => (
                <li key={o.userId}>
                  <Link href={`/reimburse/${o.userId}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-subtle/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{o.name}</p>
                      <p className="text-[13px] text-muted">{t("expenses", { count: o.count })}</p>
                    </div>
                    <span className="num font-medium">{formatMoney(o.cents)}</span>
                    <ChevronRight className="size-4 text-faint" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("nobodyOwed")} description={t("nobodyOwedHint")} />
          )}
          </Panel>
        </Section>

        <Section title={t("historyTitle")}>
          <Panel>
          {history.length ? (
            <ul className="divide-y divide-line">
              {history.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.payee}</p>
                    <p className="text-[13px] text-muted">
                      {[formatDate(r.paidOn, locale), t("expenses", { count: r.expenseCount }), t("paidBy", { name: r.payer })].join(" · ")}
                    </p>
                    {r.note && <p className="mt-0.5 text-[13px] text-muted">{r.note}</p>}
                  </div>
                  {r.proofFileId && (
                    <a href={`/api/files/${r.proofFileId}`} target="_blank" className="text-[13px] font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                      {t("viewTransfer")}
                    </a>
                  )}
                  <span className="num font-medium">{formatMoney(r.amountCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("noHistory")} />
          )}
          </Panel>
        </Section>
      </div>
    </>
  );
}
