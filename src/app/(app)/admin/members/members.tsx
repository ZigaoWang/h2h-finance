"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/cn";
import { removeMemberAction, saveMemberAction } from "../actions";

type Member = { id: number; name: string; role: "member" | "admin"; removed: boolean; expenseCount: number };

export function MemberDialogButton({ member }: { member?: Member }) {
  const t = useTranslations("admin.members");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const initial = { name: member?.name ?? "", role: member?.role ?? "member" };
  const [values, setValues] = useState(initial);
  const save = useAction(saveMemberAction, { success: member ? tc("saved") : t("added"), onSuccess: () => setOpen(false) });

  return (
    <>
      <Button
        variant={member ? "ghost" : "primary"}
        size="sm"
        onClick={() => {
          setValues(initial);
          save.clearError();
          setOpen(true);
        }}
      >
        {!member && <Plus className="size-4" aria-hidden />}
        {member ? tc("edit") : t("add")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={member ? t("editTitle") : t("addTitle")} description={member ? undefined : t("addHint")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.execute({ ...values, id: member ? String(member.id) : "" });
          }}
          className="flex flex-col gap-4"
        >
          <Field label={t("name")} htmlFor="member-name" hint={t("nameHint")}>
            <Input id="member-name" autoFocus value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required maxLength={80} />
          </Field>
          <Field label={t("role")} htmlFor="member-role" hint={values.role === "admin" ? t("adminHint") : t("memberHint")}>
            <Select id="member-role" value={values.role} onChange={(e) => setValues((v) => ({ ...v, role: e.target.value as Member["role"] }))}>
              <option value="member">{t("roles.member")}</option>
              <option value="admin">{t("roles.admin")}</option>
            </Select>
          </Field>
          {save.error && <Alert>{save.error}</Alert>}
          <DialogActions>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" pending={save.pending}>
              {member ? tc("save") : t("add")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

export function MemberRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const t = useTranslations("admin.members");
  const tc = useTranslations("common");
  const [confirming, setConfirming] = useState(false);
  const toggle = useAction(removeMemberAction, {
    success: member.removed ? t("restored") : t("removed"),
    onSuccess: () => setConfirming(false),
  });

  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", member.removed && "bg-subtle/50")}>
      <div className="min-w-0 flex-1">
        <p className={cn("flex items-center gap-2 font-medium", member.removed && "text-muted")}>
          <span className="truncate">{member.name}</span>
          {isSelf && <span className="text-xs font-normal text-muted">{t("you")}</span>}
        </p>
        <p className="text-[13px] text-muted">{t("expenses", { count: member.expenseCount })}</p>
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-medium",
          member.removed ? "text-faint" : member.role === "admin" ? "bg-subtle text-ink" : "text-muted",
        )}
      >
        {member.removed ? t("removedLabel") : t(`roles.${member.role}`)}
      </span>
      <div className="flex items-center gap-1">
        {!member.removed && <MemberDialogButton member={member} />}
        {!isSelf && (
          <Button variant="ghost" size="sm" onClick={() => (member.removed ? toggle.execute(member.id, false) : setConfirming(true))} pending={toggle.pending && !confirming}>
            {member.removed ? t("restore") : t("remove")}
          </Button>
        )}
      </div>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t("removeTitle", { name: member.name })} description={t("removeHint")}>
        {toggle.error && <Alert className="mb-2">{toggle.error}</Alert>}
        <DialogActions>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            {tc("cancel")}
          </Button>
          <Button variant="danger" pending={toggle.pending} onClick={() => toggle.execute(member.id, true)}>
            {t("remove")}
          </Button>
        </DialogActions>
      </Dialog>
    </li>
  );
}
