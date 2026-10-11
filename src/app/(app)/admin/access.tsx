"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { changeAdminPasswordAction, changeTeamPasswordAction } from "./actions";

/** The two shared passwords: one for every member, one for admins. */
export function AccessSettings() {
  const t = useTranslations("admin.access");
  return (
    <div className="divide-y divide-line">
      <Row title={t("team")} description={t("teamHint")} action={<TeamPasswordButton />} />
      <Row title={t("admin")} description={t("adminHint")} action={<AdminPasswordButton />} />
    </div>
  );
}

function Row({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function TeamPasswordButton() {
  const t = useTranslations("admin.access");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const save = useAction(changeTeamPasswordAction, { success: t("teamChanged"), onSuccess: () => setOpen(false) });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { setPassword(""); save.clearError(); setOpen(true); }}>
        {t("change")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("teamTitle")} description={t("teamWarning")}>
        <form onSubmit={(e) => { e.preventDefault(); save.execute(password); }} className="flex flex-col gap-4">
          <Field label={t("newPassword")} htmlFor="team-password" hint={t("teamRule")}>
            <Input id="team-password" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoFocus />
          </Field>
          {save.error && <Alert>{save.error}</Alert>}
          <DialogActions>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" pending={save.pending} disabled={password.length < 6}>{t("save")}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function AdminPasswordButton() {
  const t = useTranslations("admin.access");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const save = useAction(changeAdminPasswordAction, { success: t("adminChanged"), onSuccess: () => setOpen(false) });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { setCurrent(""); setNext(""); save.clearError(); setOpen(true); }}>
        {t("change")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("adminTitle")} description={t("adminWarning")}>
        <form onSubmit={(e) => { e.preventDefault(); save.execute(current, next); }} className="flex flex-col gap-4">
          <Field label={t("currentPassword")} htmlFor="admin-current">
            <Input id="admin-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
          </Field>
          <Field label={t("newPassword")} htmlFor="admin-next" hint={t("adminRule")}>
            <Input id="admin-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
          </Field>
          {save.error && <Alert>{save.error}</Alert>}
          <DialogActions>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" pending={save.pending} disabled={!current || next.length < 8}>{t("save")}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
