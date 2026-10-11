"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { undoReimbursementAction, updateReimbursementAction } from "@/app/(app)/expenses/actions";
import { uploadImage } from "@/components/expense-form/upload";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";

type Row = { id: number; paidOn: string; note: string | null; hasProof: boolean };

/** Edit (date, note, add the transfer screenshot) and undo for one reimbursement. */
export function ReimbursementActions({ row, today }: { row: Row; today: string }) {
  const t = useTranslations("reimburse");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [paidOn, setPaidOn] = useState(row.paidOn);
  const [note, setNote] = useState(row.note ?? "");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState<{ id?: string; uploading: boolean; error?: string } | null>(null);
  const save = useAction(updateReimbursementAction, { success: tc("saved"), onSuccess: () => setEditing(false) });
  const undo = useAction(undoReimbursementAction, { success: t("undone"), onSuccess: () => setUndoing(false) });

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setPaidOn(row.paidOn);
          setNote(row.note ?? "");
          setProof(null);
          save.clearError();
          setEditing(true);
        }}
      >
        {tc("edit")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-danger hover:bg-danger-bg hover:text-danger"
        onClick={() => {
          setReason("");
          undo.clearError();
          setUndoing(true);
        }}
      >
        {t("undo")}
      </Button>

      <Dialog open={editing} onClose={() => setEditing(false)} title={t("editTitle")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.execute(row.id, { paidOn, note, proofFileId: proof?.id ?? "" });
          }}
          className="flex flex-col gap-4"
        >
          <Field label={t("paidOn")} htmlFor={`paid-on-${row.id}`}>
            <Input id={`paid-on-${row.id}`} type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
          </Field>
          <Field label={t("note")} htmlFor={`note-${row.id}`} optional={t("optional")}>
            <Textarea id={`note-${row.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
          </Field>
          {!row.hasProof && (
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-ink-2 hover:border-faint">
              <ImagePlus className="size-4 shrink-0" aria-hidden />
              {proof?.uploading ? t("reading") : proof?.id ? t("transferAdded") : t("addTransfer")}
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
          )}
          {save.error && <Alert>{save.error}</Alert>}
          <DialogActions>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" pending={save.pending} disabled={proof?.uploading}>
              {tc("save")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={undoing} onClose={() => setUndoing(false)} title={t("undoTitle")} description={t("undoHint")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            undo.execute(row.id, reason);
          }}
          className="flex flex-col gap-4"
        >
          <Field label={t("reason")} htmlFor={`undo-${row.id}`}>
            <Textarea id={`undo-${row.id}`} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} rows={3} autoFocus />
          </Field>
          {undo.error && <Alert>{undo.error}</Alert>}
          <DialogActions>
            <Button variant="secondary" onClick={() => setUndoing(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="danger" pending={undo.pending} disabled={!reason.trim()}>
              {t("undo")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
