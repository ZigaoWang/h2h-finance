"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, Section } from "@/components/ui/card";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import type { ActionResult } from "@/lib/errors";
import { archiveCategoryAction, archiveEventAction, saveCategoryAction, saveEventAction } from "./actions";

type Option = { id: number; nameEn: string; nameZh: string; heldOn?: string | null; archived: boolean; used: number };
type Kind = "categories" | "events";

const ACTIONS: Record<Kind, { save: (i: Record<string, string>) => Promise<ActionResult>; archive: (id: number, a: boolean) => Promise<ActionResult> }> = {
  categories: { save: saveCategoryAction, archive: archiveCategoryAction },
  events: { save: saveEventAction, archive: archiveEventAction },
};

/** Categories and events share one manager: bilingual names, archive instead of delete. */
export function OptionsManager({ kind, options }: { kind: Kind; options: Option[] }) {
  const t = useTranslations(`admin.${kind}`);
  return (
    <Section title={t("title")} description={t("description")} action={<OptionDialogButton kind={kind} />}>
      <Panel>
      {options.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="divide-y divide-line">
          {options.map((o) => (
            <OptionRow key={o.id} kind={kind} option={o} />
          ))}
        </ul>
      )}
      </Panel>
    </Section>
  );
}

function OptionRow({ kind, option }: { kind: Kind; option: Option }) {
  const t = useTranslations("admin.options");
  const locale = useLocale();
  const archive = useAction(ACTIONS[kind].archive, { success: option.archived ? t("restored") : t("archived") });

  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", option.archived && "bg-subtle/50")}>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", option.archived && "text-muted")}>
          {option.nameEn}
          {option.nameZh && option.nameZh !== option.nameEn && <span className="ml-2 font-normal text-muted">{option.nameZh}</span>}
        </p>
        <p className="text-[13px] text-muted">
          {[option.heldOn && formatDate(option.heldOn, locale), t("used", { count: option.used }), option.archived && t("archivedLabel")].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {!option.archived && <OptionDialogButton kind={kind} option={option} />}
        <Button variant="ghost" size="sm" pending={archive.pending} onClick={() => archive.execute(option.id, !option.archived)}>
          {option.archived ? t("restore") : t("archive")}
        </Button>
      </div>
      {archive.error && <Alert className="w-full">{archive.error}</Alert>}
    </li>
  );
}

function OptionDialogButton({ kind, option }: { kind: Kind; option?: Option }) {
  const t = useTranslations("admin.options");
  const tk = useTranslations(`admin.${kind}`);
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const initial = { nameEn: option?.nameEn ?? "", nameZh: option?.nameZh ?? "", heldOn: option?.heldOn ?? "" };
  const [values, setValues] = useState(initial);
  const save = useAction(ACTIONS[kind].save, { success: tc("saved"), onSuccess: () => setOpen(false) });

  return (
    <>
      <Button
        variant={option ? "ghost" : "primary"}
        size="sm"
        onClick={() => {
          setValues(initial);
          save.clearError();
          setOpen(true);
        }}
      >
        {!option && <Plus className="size-4" aria-hidden />}
        {option ? tc("edit") : tk("add")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={option ? tk("editTitle") : tk("add")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.execute({ ...values, id: option ? String(option.id) : "" });
          }}
          className="flex flex-col gap-4"
        >
          <Field label={t("nameEn")} htmlFor="option-en">
            <Input id="option-en" value={values.nameEn} onChange={(e) => setValues((v) => ({ ...v, nameEn: e.target.value }))} required maxLength={80} autoFocus />
          </Field>
          <Field label={t("nameZh")} htmlFor="option-zh" hint={t("nameZhHint")}>
            <Input id="option-zh" lang="zh-CN" value={values.nameZh} onChange={(e) => setValues((v) => ({ ...v, nameZh: e.target.value }))} maxLength={80} />
          </Field>
          {kind === "events" && (
            <Field label={t("heldOn")} htmlFor="option-date" optional={tc("optional")}>
              <Input id="option-date" type="date" value={values.heldOn} onChange={(e) => setValues((v) => ({ ...v, heldOn: e.target.value }))} />
            </Field>
          )}
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
