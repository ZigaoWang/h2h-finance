"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import type { ActionResult } from "@/lib/errors";

/** A delete button that asks first. For things nothing depends on yet. */
export function ConfirmDelete({ title, action }: { title: string; action: () => Promise<ActionResult> }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const remove = useAction(action, { success: t("deleted"), onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-bg hover:text-danger" onClick={() => setOpen(true)}>
        {t("delete")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={t("deleteHint")}>
        {remove.error && <Alert className="mb-2">{remove.error}</Alert>}
        <DialogActions>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button variant="danger" pending={remove.pending} onClick={() => remove.execute()}>
            {t("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
