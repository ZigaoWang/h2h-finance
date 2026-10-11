"use client";

import { useState } from "react";
import { Check, HandCoins, ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { approveAndPayAction, approveExpenseAction, deleteExpenseAction, rejectExpenseAction, restoreExpenseAction } from "@/app/(app)/expenses/actions";
import { uploadImage } from "@/components/expense-form/upload";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/cn";

const QUICK_REASONS = ["unclear", "notClub", "duplicate", "wrongAmount"] as const;

/** Approve or reject a pending expense. `onDone` lets the review queue move to the next one. */
export function ReviewActions({ id, onDone, compact, className }: { id: number; onDone?: () => void; compact?: boolean; className?: string }) {
  const t = useTranslations("review");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const approve = useAction(approveExpenseAction, { success: t("approved"), onSuccess: onDone });
  const reject = useAction(rejectExpenseAction, {
    success: t("rejected"),
    onSuccess: () => {
      setRejecting(false);
      onDone?.();
    },
  });

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className={compact ? "flex gap-2" : "grid grid-cols-2 gap-2"}>
        {compact && (
          <Button size="sm" onClick={() => approve.execute(id)} pending={approve.pending}>
            <Check className="size-3.5" aria-hidden />
            {t("approve")}
          </Button>
        )}
        <Button
          variant="secondary"
          size={compact ? "sm" : "lg"}
          onClick={() => {
            setReason("");
            reject.clearError();
            setRejecting(true);
          }}
          disabled={approve.pending}
        >
          <X className={compact ? "size-3.5" : "size-4"} aria-hidden />
          {t("reject")}
        </Button>
        {!compact && (
          <Button size="lg" onClick={() => approve.execute(id)} pending={approve.pending}>
            <Check className="size-4" aria-hidden />
            {t("approve")}
          </Button>
        )}
      </div>
      {approve.error && <Alert>{approve.error}</Alert>}

      <Dialog open={rejecting} onClose={() => setRejecting(false)} title={t("rejectTitle")} description={t("rejectHint")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            reject.execute(id, reason);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setReason(t(`reasons.${key}`))}
                className="h-8 rounded-full border border-line-strong px-3 text-[13px] text-ink-2 hover:border-faint hover:text-ink"
              >
                {t(`reasons.${key}`)}
              </button>
            ))}
          </div>
          <Field label={t("reason")} htmlFor={`reject-${id}`}>
            <Textarea id={`reject-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} rows={3} autoFocus />
          </Field>
          {reject.error && <Alert>{reject.error}</Alert>}
          <DialogActions>
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="danger" pending={reject.pending} disabled={!reason.trim()}>
              {t("reject")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

/** Deletes an expense in the open: it stays visible as deleted, with who and why. */
export function DeleteAction({ id }: { id: number }) {
  const t = useTranslations("review");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const remove = useAction(deleteExpenseAction, { success: t("deleted"), onSuccess: () => setOpen(false) });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => { setReason(""); remove.clearError(); setOpen(true); }} className="text-danger hover:bg-danger-bg hover:text-danger">
        {t("delete")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("deleteTitle")} description={t("deleteHint")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            remove.execute(id, reason);
          }}
          className="flex flex-col gap-4"
        >
          <Field label={t("reason")} htmlFor={`delete-${id}`}>
            <Textarea id={`delete-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} rows={3} autoFocus />
          </Field>
          {remove.error && <Alert>{remove.error}</Alert>}
          <DialogActions>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="danger" pending={remove.pending} disabled={!reason.trim()}>
              {t("delete")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

export function RestoreAction({ id }: { id: number }) {
  const t = useTranslations("review");
  const restore = useAction(restoreExpenseAction, { success: t("restored") });
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" size="sm" pending={restore.pending} onClick={() => restore.execute(id)}>
        {t("restore")}
      </Button>
      {restore.error && <Alert>{restore.error}</Alert>}
    </div>
  );
}

/** Approve and record the payback in one step, for when the money goes out straight away. */
export function ApproveAndPayAction({ id, member, amount, today }: { id: number; member: string; amount: string; today: string }) {
  const t = useTranslations("review");
  const tr = useTranslations("reimburse");
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<{ id?: string; uploading: boolean; error?: string } | null>(null);
  const pay = useAction(approveAndPayAction, { success: t("approvedAndPaid"), onSuccess: () => setOpen(false) });

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setPaidOn(today);
          setNote("");
          setProof(null);
          pay.clearError();
          setOpen(true);
        }}
      >
        <HandCoins className="size-3.5" aria-hidden />
        {t("approveAndPay")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("approveAndPayTitle", { amount, member })} description={t("approveAndPayHint")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            pay.execute(id, { paidOn, note, proofFileId: proof?.id ?? "" });
          }}
          className="flex flex-col gap-4"
        >
          <Field label={tr("paidOn")} htmlFor={`pay-on-${id}`}>
            <Input id={`pay-on-${id}`} type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-ink-2 hover:border-faint">
            <ImagePlus className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{proof?.uploading ? tr("reading") : proof?.id ? tr("transferAdded") : tr("addTransfer")}</span>
            <span className="text-xs text-faint">{tr("optional")}</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setProof({ uploading: true });
                const result = await uploadImage(file, "transfer");
                setProof(typeof result === "string" ? { uploading: false, error: result } : { uploading: false, id: result.id });
              }}
            />
          </label>
          <Field label={tr("note")} htmlFor={`pay-note-${id}`} optional={tr("optional")}>
            <Textarea id={`pay-note-${id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
          </Field>
          {pay.error && <Alert>{pay.error}</Alert>}
          <DialogActions>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" pending={pay.pending} disabled={proof?.uploading}>
              {t("approveAndPayConfirm", { amount })}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
