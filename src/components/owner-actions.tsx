"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { withdrawExpenseAction } from "@/app/(app)/expenses/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";

export function OwnerActions({ id, status }: { id: number; status: "pending" | "rejected" }) {
  const t = useTranslations("expense");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const withdraw = useAction(withdrawExpenseAction, { success: t("withdrawn"), onSuccess: () => router.push("/expenses") });

  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink href={`/expenses/${id}/edit`} variant={status === "rejected" ? "primary" : "secondary"} size="sm">
        {status === "rejected" ? t("fixAndResubmit") : t("edit")}
      </ButtonLink>
      {status === "pending" && (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          {t("withdraw")}
        </Button>
      )}
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t("withdrawTitle")} description={t("withdrawHint")}>
        {withdraw.error && <Alert className="mb-2">{withdraw.error}</Alert>}
        <DialogActions>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            {t("keep")}
          </Button>
          <Button variant="danger" pending={withdraw.pending} onClick={() => withdraw.execute(id)}>
            {t("withdraw")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
