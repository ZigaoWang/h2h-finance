import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { DeleteAction, RestoreAction } from "@/components/expense-actions";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import type { SessionUser } from "@/lib/auth/dal";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { DuplicateFlag, ExpenseDetail as Detail } from "@/lib/expenses/queries";
import { localName } from "@/lib/i18n-names";
import { formatMoney } from "@/lib/money";
import { screenshotMismatches } from "@/lib/expenses/checks";

/** One expense with its proof. Used on the detail page and in the review queue. */
export function ExpenseDetailView({ detail, viewer }: { detail: Detail; viewer: SessionUser }) {
  const t = useTranslations("expense");
  const locale = useLocale();
  const { expense, files, flags, history } = detail;
  const isAdmin = viewer.role === "admin";
  const isOwner = expense.userId === viewer.id;
  // What was read from the first screenshot: shown as supporting detail, never used for totals.
  const receiptOcr = files[0]?.ocr;
  // Details that disagree with the screenshot are worth a second look before approving or paying.
  const differ = screenshotMismatches(expense, receiptOcr);
  const mismatches = [
    differ.amountCents ? t("mismatch.amount", { amount: formatMoney(differ.amountCents) }) : null,
    differ.spentOn ? t("mismatch.date", { date: formatDate(differ.spentOn, locale) }) : null,
  ].filter((m): m is string => !!m);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-5 lg:order-2">
        <Panel className="p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="num text-[28px] leading-tight font-semibold tracking-tight">
              <span className={expense.status === "voided" ? "text-faint line-through" : undefined}>{formatMoney(expense.amountCents)}</span>
            </p>
            {expense.status === "voided" && <StatusBadge status="voided" className="mt-1.5" />}
          </div>
          <h2 className="mt-2 text-[15px] font-medium">{expense.description}</h2>
          {expense.note && (
            <div className="mt-4 rounded-md bg-subtle px-3.5 py-3 text-sm">
              <p className="text-xs font-medium text-muted">{t("note")}</p>
              <p className="mt-1 whitespace-pre-line text-ink-2">{expense.note}</p>
            </div>
          )}

          <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 border-t border-line pt-4 text-sm">
            <Row label={t("merchant")}>{expense.merchant}</Row>
            <Row label={t("date")}>
              {formatDate(expense.spentOn, locale)}
              {receiptOcr?.paidAt && receiptOcr.spentOn === expense.spentOn && <span className="text-muted"> · {receiptOcr.paidAt}</span>}
            </Row>
            <Row label={t("category")}>{localName(locale, expense.categoryEn, expense.categoryZh)}</Row>
            <Row label={t("event")}>{expense.eventEn ? localName(locale, expense.eventEn, expense.eventZh) : <span className="text-muted">—</span>}</Row>
            {receiptOcr?.transactionId && (
              <Row label={t("transactionId")}>
                <span className="num break-all">{receiptOcr.transactionId}</span>
              </Row>
            )}
            <Row label={t("submittedBy")}>
              {expense.userName}
              <When date={expense.createdAt} />
            </Row>
            {expense.updatedByName && expense.updatedAt && (
              <Row label={t("editedBy")}>
                {expense.updatedByName}
                <When date={expense.updatedAt} />
              </Row>
            )}
            {expense.voidedByName && expense.voidedAt && (
              <Row label={t("deletedBy")}>
                {expense.voidedByName}
                <When date={expense.voidedAt} />
              </Row>
            )}
          </dl>

          <div className="mt-5 flex flex-col gap-3 empty:hidden">
            {expense.status === "voided" && <Alert tone="info" title={t("voidedTitle")}>{expense.voidReason}</Alert>}
            {(isAdmin || isOwner) && flags.length > 0 && <DuplicateAlert flags={flags} isAdmin={isAdmin} />}
            {(isAdmin || isOwner) && mismatches.length > 0 && expense.status !== "voided" && (
              <Alert tone="warning" title={t("mismatch.title")}>
                <ul className="flex flex-col gap-0.5">
                  {mismatches.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>

          {(isAdmin || isOwner) && expense.status !== "voided" && (
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
              <ButtonLink href={`/expenses/${expense.id}/edit`} variant="secondary" size="sm">
                {t("edit")}
              </ButtonLink>
              <DeleteAction id={expense.id} />
            </div>
          )}
          {(isAdmin || isOwner) && expense.status === "voided" && (
            <div className="mt-4 border-t border-line pt-3">
              <RestoreAction id={expense.id} />
            </div>
          )}
        </Panel>

        <History history={history} />
      </div>

      <div className="flex flex-col gap-3 lg:order-1">
        {files.map((file, i) => (
          <a
            key={file.id}
            href={`/api/files/${file.id}`}
            target="_blank"
            className="block overflow-hidden rounded-lg border border-line bg-subtle"
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

function When({ date }: { date: Date }) {
  const locale = useLocale();
  return <span className="text-muted"> · {formatDateTime(date, locale)}</span>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

export function DuplicateAlert({ flags, isAdmin }: { flags: DuplicateFlag[]; isAdmin: boolean }) {
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
          const key = flag.kind === "details" ? "details" : flag.reason;
          return <li key={i}>{t.rich(key, { id: flag.expenseId, ref })}</li>;
        })}
      </ul>
    </Alert>
  );
}

const HISTORY_KEYS: Record<string, "submitted" | "updated" | "approved" | "rejected" | "voided" | "restored" | "paid" | "unpaid"> = {
  "expense.submitted": "submitted",
  "expense.updated": "updated",
  "expense.approved": "approved",
  "expense.rejected": "rejected",
  "expense.voided": "voided",
  "expense.restored": "restored",
  "expense.paid": "paid",
  "expense.unpaid": "unpaid",
};

type Names = { en: string; zh: string } | null;
const CHANGE_FIELDS = ["amountCents", "merchant", "spentOn", "category", "event", "description", "note"] as const;

/** "Amount: ¥25.00 → ¥30.00" lines for an edit, readable without looking anything up. */
function useChangeLines(changes: unknown): string[] {
  const t = useTranslations("expense");
  const locale = useLocale();
  if (!changes || typeof changes !== "object") return [];
  const record = changes as Record<string, [unknown, unknown]>;
  const show = (field: (typeof CHANGE_FIELDS)[number], value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "amountCents") return formatMoney(value as number);
    if (field === "spentOn") return formatDate(value as string, locale);
    if (field === "category" || field === "event") return localName(locale, (value as Names)?.en ?? null, (value as Names)?.zh ?? null) || "—";
    return String(value);
  };
  const labels = {
    amountCents: t("amount"),
    merchant: t("merchant"),
    spentOn: t("date"),
    category: t("category"),
    event: t("event"),
    description: t("description"),
    note: t("note"),
  };
  return CHANGE_FIELDS.filter((f) => record[f]).map((f) => `${labels[f]}: ${show(f, record[f][0])} → ${show(f, record[f][1])}`);
}

function HistoryEntry({ label, reason, changes, at }: { label: string; reason?: string; changes?: unknown; at: Date }) {
  const locale = useLocale();
  const lines = useChangeLines(changes);
  return (
    <li className="relative">
      <span className="absolute top-1.5 -left-[24.5px] size-2 rounded-full border-2 border-surface bg-line-strong ring-1 ring-line-strong" aria-hidden />
      <p className="text-sm">{label}</p>
      {reason && <p className="mt-0.5 text-sm text-muted">“{reason}”</p>}
      {lines.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-muted">
          {lines.map((line) => (
            <li key={line} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-0.5 text-xs text-faint">{formatDateTime(at, locale)}</p>
    </li>
  );
}

function History({ history }: { history: Detail["history"] }) {
  const t = useTranslations("expense.history");
  const entries = history.flatMap((h) => {
    const key = HISTORY_KEYS[h.action];
    if (!key) return [];
    return [
      {
        key: `${h.action}-${h.createdAt.getTime()}`,
        label: t(key, { name: h.actorName ?? "" }),
        reason: typeof h.data?.reason === "string" ? h.data.reason : undefined,
        changes: h.data?.changes,
        at: h.createdAt,
      },
    ];
  });
  entries.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <Panel className="p-5">
      <h3 className="mb-4 text-sm font-semibold">{t("title")}</h3>
      <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
        {entries.map(({ key, ...entry }) => (
          <HistoryEntry key={key} {...entry} />
        ))}
      </ol>
    </Panel>
  );
}
