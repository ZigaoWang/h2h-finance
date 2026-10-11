"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { setUp, type SetupState } from "./actions";

export function SetupForm() {
  const t = useTranslations("setup");
  const [state, action, pending] = useActionState<SetupState, FormData>(setUp, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("description")}</p>
      </div>
      <Field label={t("name")} htmlFor="name" hint={t("nameHint")}>
        <Input id="name" name="name" required maxLength={80} autoFocus autoComplete="name" />
      </Field>
      <Field label={t("adminPassword")} htmlFor="adminPassword" hint={t("adminPasswordHint")}>
        <Input id="adminPassword" name="adminPassword" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label={t("teamPassword")} htmlFor="teamPassword" hint={t("teamPasswordHint")}>
        <Input id="teamPassword" name="teamPassword" type="password" required minLength={6} autoComplete="off" />
      </Field>
      {state.error && <Alert>{t(`errors.${state.error}`)}</Alert>}
      <Button type="submit" size="lg" pending={pending} className="h-10 text-sm">
        {t("submit")}
      </Button>
    </form>
  );
}
