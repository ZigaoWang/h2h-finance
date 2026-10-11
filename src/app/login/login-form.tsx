"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { step: "password" });

  if (state.step === "name") return <NameStep state={state} action={action} pending={pending} />;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="intent" value="unlock" />
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("passwordPrompt")}</p>
      </div>
      <Field label={t("teamPassword")} htmlFor="password" error={state.error && t(`errors.${state.error}`)}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus aria-invalid={!!state.error} className="h-10" />
      </Field>
      <Button type="submit" size="lg" pending={pending} className="h-10 text-sm">
        {t("continue")}
      </Button>
    </form>
  );
}

function NameStep({ state, action, pending }: { state: Extract<LoginState, { step: "name" }>; action: (data: FormData) => void; pending: boolean }) {
  const t = useTranslations("login");
  const [selected, setSelected] = useState<number | undefined>(state.selected);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(!!state.newName);
  const chosen = state.names.find((n) => n.id === selected);
  const needsAdminPassword = chosen?.role === "admin" && !state.adminUnlocked;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? state.names.filter((n) => n.name.toLowerCase().includes(q)) : state.names;
  }, [query, state.names]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="userId" value={selected ?? ""} />
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{t("whoAreYou")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("pickName")}</p>
      </div>

      {state.names.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-9" />
        </div>
      )}

      <div role="radiogroup" aria-label={t("whoAreYou")} className="max-h-72 overflow-y-auto rounded-lg border border-line">
        {shown.map((n) => (
          <button
            key={n.id}
            type="button"
            role="radio"
            aria-checked={selected === n.id}
            onClick={() => {
              setSelected(n.id);
              setAdding(false);
            }}
            className={cn(
              "flex w-full items-center justify-between gap-3 border-b border-line px-3.5 py-2.5 text-left text-sm last:border-b-0 transition-colors",
              selected === n.id ? "bg-ink text-white" : "hover:bg-subtle",
            )}
          >
            <span className="truncate font-medium">{n.name}</span>
            {n.role === "admin" && <span className={cn("text-xs", selected === n.id ? "text-white/60" : "text-faint")}>{t("admin")}</span>}
          </button>
        ))}
        {shown.length === 0 && <p className="px-3.5 py-6 text-center text-[13px] text-muted">{t("noMatch")}</p>}
      </div>

      {adding ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <Field label={t("newName")} htmlFor="new-name" hint={t("newNameHint")}>
            <Input id="new-name" name="newName" defaultValue={state.newName} maxLength={80} autoFocus autoComplete="name" />
          </Field>
          <Button type="submit" name="intent" value="register" variant="secondary" pending={pending} className="self-start">
            {t("addMe")}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setSelected(undefined);
          }}
          className="-mt-2 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <Plus className="size-3.5" aria-hidden />
          {t("notListed")}
        </button>
      )}

      {needsAdminPassword && (
        <Field label={t("adminPassword")} htmlFor="admin-password" hint={t("adminPasswordHint")}>
          <Input id="admin-password" name="adminPassword" type="password" autoComplete="current-password" required autoFocus className="h-10" />
        </Field>
      )}
      {state.error && <Alert>{t(`errors.${state.error}`)}</Alert>}

      <Button type="submit" name="intent" value="choose" size="lg" pending={pending} disabled={!selected} className="h-10 text-sm">
        {chosen ? t("continueAs", { name: chosen.name }) : t("signIn")}
      </Button>
      <button type="submit" name="intent" value="back" formNoValidate className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden />
        {t("back")}
      </button>
    </form>
  );
}
