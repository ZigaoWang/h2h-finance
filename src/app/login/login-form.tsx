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
  const [query, setQuery] = useState(state.newName ?? "");
  const chosen = state.names.find((n) => n.id === selected);
  const needsAdminPassword = chosen?.role === "admin" && !state.adminUnlocked;

  const typed = query.trim().replace(/\s+/g, " ");
  const shown = useMemo(() => {
    const q = typed.toLowerCase();
    return q ? state.names.filter((n) => n.name.toLowerCase().includes(q)) : state.names;
  }, [typed, state.names]);
  // Offer to add the typed name once it looks like a full name (or nothing matches), and isn't taken.
  const looksComplete = /[\u3400-\u9fff]{2,}/.test(typed) || /\S+\s+\S+/.test(typed);
  const canAdd =
    typed.length >= 2 && (looksComplete || shown.length === 0) && !state.names.some((n) => n.name.toLowerCase() === typed.toLowerCase());

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="userId" value={selected ?? ""} />
      <input type="hidden" name="newName" value={typed} />
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{t("whoAreYou")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("pickName")}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-line-strong focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgb(0_0_0/0.08)]">
        <div className="relative border-b border-line">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(undefined);
            }}
            onKeyDown={(e) => {
              // Enter picks the only match; it never adds a half-typed name by accident.
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (shown.length === 1) setSelected(shown[0].id);
            }}
            placeholder={t("search")}
            aria-label={t("search")}
            autoComplete="off"
            autoFocus
            className="h-11 w-full bg-transparent pr-3.5 pl-10 text-[15px] placeholder:text-faint focus:outline-none"
          />
        </div>
        <div role="radiogroup" aria-label={t("whoAreYou")} className="max-h-64 overflow-y-auto">
          {shown.map((n) => (
            <button
              key={n.id}
              type="button"
              role="radio"
              aria-checked={selected === n.id}
              onClick={() => setSelected(n.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 border-b border-line px-3.5 py-2.5 text-left text-sm transition-colors last:border-b-0",
                selected === n.id ? "bg-ink text-white" : "hover:bg-subtle",
              )}
            >
              <span className="truncate font-medium">{n.name}</span>
              {n.role === "admin" && <span className={cn("text-xs", selected === n.id ? "text-white/60" : "text-faint")}>{t("admin")}</span>}
            </button>
          ))}
          {canAdd && (
            <button
              type="submit"
              name="intent"
              value="register"
              formNoValidate
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-ink-2 hover:bg-subtle"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{t.rich("addName", { name: typed, b: (chunks) => <span className="font-medium text-ink">{chunks}</span> })}</span>
            </button>
          )}
          {shown.length === 0 && !canAdd && <p className="px-3.5 py-5 text-center text-[13px] text-muted">{t("typeToAdd")}</p>}
        </div>
      </div>

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
