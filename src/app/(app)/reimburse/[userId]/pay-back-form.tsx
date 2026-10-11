"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createReimbursementAction } from "@/app/(app)/expenses/actions";
import { uploadImage, type UploadFailure } from "@/components/expense-form/upload";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/dates";
import type { ExpenseRow } from "@/lib/expenses/queries";
import { localName } from "@/lib/i18n-names";
import { formatMoney } from "@/lib/money";

type Proof = { preview: string; status: "uploading" | "done" | "error"; fileId?: string; amountCents?: number; error?: UploadFailure };

export function PayBackForm({ userId, expenses, today }: { userId: number; expenses: ExpenseRow[]; today: string }) {
  const t = useTranslations("reimburse");
  const tu = useTranslations("submit.uploadErrors");
  const locale = useLocale();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(() => new Set(expenses.map((e) => e.id)));
  const [proof, setProof] = useState<Proof | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const pay = useAction(createReimbursementAction, { success: t("done"), onSuccess: () => router.push("/reimburse") });

  if (expenses.length === 0) {
    return (
      <Card>
        <EmptyState title={t("nothingOwed")} />
      </Card>
    );
  }

  const total = expenses.filter((e) => selected.has(e.id)).reduce((sum, e) => sum + e.amountCents, 0);
  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function attach(file: File) {
    setProof({ preview: URL.createObjectURL(file), status: "uploading" });
    const result = await uploadImage(file, "transfer");
    setProof((p) =>
      p && (typeof result === "string" ? { ...p, status: "error", error: result } : { ...p, status: "done", fileId: result.id, amountCents: result.ocr.amountCents }),
    );
  }

  const mismatch = proof?.status === "done" && proof.amountCents !== undefined && proof.amountCents !== total;
  const ready = selected.size > 0 && proof?.status === "done" && !!paidOn;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) pay.execute({ userId, expenseIds: [...selected], proofFileId: proof!.fileId!, paidOn, note });
      }}
      className="flex flex-col gap-6"
    >
      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="text-sm font-medium">{t("selectExpenses")}</p>
          <button
            type="button"
            className="text-[13px] text-muted hover:text-ink"
            onClick={() => setSelected(selected.size === expenses.length ? new Set() : new Set(expenses.map((e) => e.id)))}
          >
            {selected.size === expenses.length ? t("selectNone") : t("selectAll")}
          </button>
        </div>
        <ul className="divide-y divide-line">
          {expenses.map((e) => (
            <li key={e.id}>
              <label className="flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-subtle/60">
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="size-4 accent-ink" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{e.description}</p>
                  <p className="truncate text-[13px] text-muted">
                    #{e.id} · {formatDate(e.spentOn, locale)} · {e.merchant} · {localName(locale, e.categoryEn, e.categoryZh)}
                  </p>
                </div>
                <span className="num shrink-0 font-medium">{formatMoney(e.amountCents)}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-line bg-subtle/50 px-5 py-3">
          <p className="text-sm text-muted">{t("selectedCount", { count: selected.size })}</p>
          <p className="num text-lg font-semibold">{formatMoney(total)}</p>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("transfer")}</p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void attach(file);
            e.target.value = "";
          }}
        />
        {proof ? (
          <div className="flex items-start gap-4 rounded-lg border border-line bg-surface p-3">
            <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
              <img src={proof.preview} alt="" className="size-full object-cover object-top" />
              {proof.status === "uploading" && (
                <span className="absolute inset-0 flex items-center justify-center bg-surface/50">
                  <Spinner className="size-5" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              {proof.status === "uploading" && <p className="text-muted">{t("reading")}</p>}
              {proof.status === "error" && <p className="text-danger">{tu(proof.error ?? "network")}</p>}
              {proof.status === "done" &&
                (proof.amountCents === undefined ? (
                  <p className="text-muted">{t("noAmountFound")}</p>
                ) : mismatch ? (
                  <Alert tone="warning">{t("amountMismatch", { found: formatMoney(proof.amountCents), total: formatMoney(total) })}</Alert>
                ) : (
                  <p className="text-paid">{t("amountMatches", { amount: formatMoney(proof.amountCents) })}</p>
                ))}
            </div>
            <button type="button" onClick={() => setProof(null)} aria-label={t("removeTransfer")} className="-m-1 rounded-md p-1 text-faint hover:bg-subtle hover:text-ink">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-8 text-sm font-medium text-ink-2 hover:border-faint hover:bg-subtle/60"
          >
            <ImagePlus className="size-4" aria-hidden />
            {t("addTransfer")}
          </button>
        )}
        <p className="text-[13px] text-muted">{t("transferHint")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("paidOn")} htmlFor="paid-on">
          <Input id="paid-on" type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
        </Field>
      </div>
      <Field label={t("note")} htmlFor="pay-note" optional={t("optional")}>
        <Textarea id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      </Field>

      {pay.error && <Alert>{pay.error}</Alert>}
      <Button type="submit" size="lg" disabled={!ready} pending={pay.pending}>
        {t("confirm", { amount: formatMoney(total) })}
      </Button>
      <p className="-mt-3 text-center text-[13px] text-muted">{t("permanent")}</p>
    </form>
  );
}
