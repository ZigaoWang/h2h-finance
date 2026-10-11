"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { deleteExpenseAction, restoreExpenseAction } from "@/app/(app)/expenses/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";

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
