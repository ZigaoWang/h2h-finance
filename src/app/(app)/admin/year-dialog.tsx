"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { saveYearAction } from "./actions";

type YearInput = { id?: string; label: string; startsOn: string; endsOn: string; budget: string };

export function YearDialogButton({ initial }: { initial: YearInput }) {
  const t = useTranslations("admin.years");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const editing = !!initial.id;
  const save = useAction(saveYearAction, { success: tc("saved"), onSuccess: () => setOpen(false) });
  const set = (key: keyof YearInput) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <>
      <Button
        variant={editing ? "secondary" : "primary"}
        size="sm"
        onClick={() => {
          setValues(initial);
          save.clearError();
          setOpen(true);
        }}
      >
        {!editing && <Plus className="size-4" aria-hidden />}
        {editing ? tc("edit") : t("new")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? t("editTitle") : t("newTitle")} description={t("dialogHint")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.execute(values);
          }}
          className="flex flex-col gap-4"
        >
          <Field label={t("label")} htmlFor="year-label" hint={t("labelHint")}>
            <Input id="year-label" value={values.label} onChange={set("label")} required maxLength={40} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("startsOn")} htmlFor="year-start">
              <Input id="year-start" type="date" value={values.startsOn} onChange={set("startsOn")} required />
            </Field>
            <Field label={t("endsOn")} htmlFor="year-end">
              <Input id="year-end" type="date" value={values.endsOn} min={values.startsOn} onChange={set("endsOn")} required />
            </Field>
          </div>
          <Field label={t("budget")} htmlFor="year-budget" hint={t("budgetHint")}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">¥</span>
              <Input id="year-budget" inputMode="decimal" value={values.budget} onChange={set("budget")} placeholder="0.00" required className="num pl-7" />
            </div>
          </Field>
          {save.error && <Alert>{save.error}</Alert>}
          <DialogActions>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" pending={save.pending}>
              {tc("save")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
