import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { OwnerActions } from "@/components/owner-actions";
import { ReviewActions, VoidAction } from "@/components/review-actions";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import type { SessionUser } from "@/lib/auth/dal";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { DuplicateFlag, ExpenseDetail as Detail } from "@/lib/expenses/queries";
import { localName } from "@/lib/i18n-names";
import { formatMoney } from "@/lib/money";

/** One expense with its proof. Used on the detail page and in the review queue. */
export function ExpenseDetailView({ detail, viewer, inQueue }: { detail: Detail; viewer: SessionUser; inQueue?: boolean }) {
  const t = useTranslations("expense");
  const locale = useLocale();
  const { expense, files, flags, reimbursement, proofFileId, history } = detail;
  const isAdmin = viewer.role === "admin";
  const isOwner = expense.userId === viewer.id;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-5 lg:order-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="num text-3xl font-semibold tracking-tight">
              <span className={expense.status === "voided" ? "text-faint line-through" : undefined}>{formatMoney(expense.amountCents)}</span>
            </p>
            <StatusBadge status={expense.status} className="mt-1.5" />
          </div>
          <h2 className="mt-2 text-[15px] font-medium">{expense.description}</h2>

          <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 border-t border-line pt-4 text-sm">
            <Row label={t("merchant")}>{expense.merchant}</Row>
            <Row label={t("date")}>{formatDate(expense.spentOn, locale)}</Row>
            <Row label={t("category")}>{localName(locale, expense.categoryEn, expense.categoryZh)}</Row>
            <Row label={t("event")}>{expense.eventEn ? localName(locale, expense.eventEn, expense.eventZh) : <span className="text-muted">—</span>}</Row>
            <Row label={t("submittedBy")}>{expense.userName}</Row>
            <Row label={t("submittedAt")}>{formatDateTime(expense.createdAt, locale)}</Row>
            {expense.note && <Row label={t("note")}><span className="whitespace-pre-line">{expense.note}</span></Row>}
          </dl>

          <div className="mt-5 flex flex-col gap-3 empty:hidden">
            {expense.status === "rejected" && (
              <Alert title={t("rejectedTitle")}>{expense.rejectionReason}</Alert>
            )}
            {expense.status === "voided" && <Alert tone="info" title={t("voidedTitle")}>{expense.voidReason}</Alert>}
            {(isAdmin || isOwner) && flags.length > 0 && <DuplicateAlert flags={flags} isAdmin={isAdmin} />}
            {expense.status === "approved" && <p className="text-sm text-muted">{t("awaitingPayback")}</p>}
            {reimbursement && (
              <p className="text-sm text-muted">
                {t("paidBackOn", { date: formatDate(reimbursement.paidOn, locale) })}
                {proofFileId && (
                  <>
                    {" · "}
                    <a href={`/api/files/${proofFileId}`} target="_blank" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                      {t("viewTransfer")}
                    </a>
                  </>
                )}
              </p>
            )}
          </div>

          {isAdmin && expense.status === "pending" && <ReviewActions id={expense.id} className="mt-5" />}
          {isOwner && (expense.status === "pending" || expense.status === "rejected") && !inQueue && (
            <div className="mt-5 border-t border-line pt-4">
              <OwnerActions id={expense.id} status={expense.status} />
            </div>
          )}
          {isAdmin && expense.status === "approved" && (
            <div className="mt-4 flex justify-end border-t border-line pt-3">
              <VoidAction id={expense.id} />
            </div>
          )}
        </Card>

        {!inQueue && <History history={history} reimbursement={reimbursement} />}
      </div>

      <div className="flex flex-col gap-3 lg:order-1">
        {files.map((file, i) => (
          <a
            key={file.id}
            href={`/api/files/${file.id}`}
            target="_blank"
            className="block overflow-hidden rounded-lg border border-line bg-surface"
            title={t("openOriginal")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- private, access-checked files */}
            <img
              src={`/api/files/${file.id}`}
              alt={t("receiptAlt", { number: i + 1 })}
              width={file.width}
              height={file.height}
              className="h-auto w-full"
              loading={i === 0 ? "eager" : "lazy"}
            />
          </a>
        ))}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function DuplicateAlert({ flags, isAdmin }: { flags: DuplicateFlag[]; isAdmin: boolean }) {
  const t = useTranslations("expense.duplicates");
  return (
    <Alert tone="warning" title={t("title")}>
      <ul className="flex flex-col gap-0.5">
        {flags.map((flag, i) => {
          if (!flag.expenseId) return <li key={i}>{t("earlier")}</li>;
          const ref = (chunks: ReactNode) =>
            isAdmin ? (
              <Link href={`/expenses/${flag.expenseId}`} className="font-medium underline underline-offset-2">
                {chunks}
              </Link>
            ) : (
              chunks
            );
          const key = flag.kind === "details" ? "details" : flag.exact ? "exact" : "similar";
          return <li key={i}>{t.rich(key, { id: flag.expenseId, ref })}</li>;
        })}
      </ul>
    </Alert>
  );
}

const HISTORY_KEYS: Record<string, "submitted" | "updated" | "approved" | "rejected" | "voided"> = {
  "expense.submitted": "submitted",
  "expense.updated": "updated",
  "expense.approved": "approved",
  "expense.rejected": "rejected",
  "expense.voided": "voided",
};

function History({ history, reimbursement }: { history: Detail["history"]; reimbursement: Detail["reimbursement"] }) {
  const t = useTranslations("expense.history");
  const locale = useLocale();
  const entries = history.flatMap((h) => {
    const key = HISTORY_KEYS[h.action];
    if (!key) return [];
    return [
      {
        key: `${h.action}-${h.createdAt.getTime()}`,
        label: t(key, { name: h.actorName ?? "" }),
        detail: typeof h.data?.reason === "string" ? h.data.reason : undefined,
        at: h.createdAt,
      },
    ];
  });
  if (reimbursement) entries.push({ key: "paid", label: t("paid"), detail: undefined, at: reimbursement.createdAt });
  entries.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold">{t("title")}</h3>
      <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
        {entries.map((e) => (
          <li key={e.key} className="relative">
            <span className="absolute top-1.5 -left-[24.5px] size-2 rounded-full border-2 border-surface bg-line-strong ring-1 ring-line-strong" aria-hidden />
            <p className="text-sm">{e.label}</p>
            {e.detail && <p className="mt-0.5 text-sm text-muted">“{e.detail}”</p>}
            <p className="mt-0.5 text-xs text-faint">{formatDateTime(e.at, locale)}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
