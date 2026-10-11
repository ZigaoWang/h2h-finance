"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { login, type LoginState } from "./actions";

const RESEND_AFTER = 60;

export function LoginForm() {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { step: "email" });

  if (state.step === "code") return <CodeStep key={state.email} state={state} action={action} pending={pending} />;

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("emailPrompt")}</p>
      </div>
      <Field label={t("email")} htmlFor="email" error={state.error && t(`errors.${state.error}`)}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email}
          placeholder="name@example.com"
          aria-invalid={!!state.error}
          required
          autoFocus
          className="h-11"
        />
      </Field>
      <Button type="submit" size="lg" pending={pending} name="intent" value="send">
        {t("sendCode")}
      </Button>
    </form>
  );
}

function CodeStep({
  state,
  action,
  pending,
}: {
  state: Extract<LoginState, { step: "code" }>;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const t = useTranslations("login");
  const formRef = useRef<HTMLFormElement>(null);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(RESEND_AFTER);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  // A failed attempt clears the box so the next code can be typed straight away.
  const [checked, setChecked] = useState(state);
  if (checked !== state) {
    setChecked(state);
    if (state.error) setCode("");
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="email" value={state.email} />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("checkEmail")}</h1>
        <p className="mt-1.5 text-sm text-muted">
          {t.rich("codeSent", { email: state.email, b: (chunks) => <span className="font-medium text-ink">{chunks}</span> })}
        </p>
      </div>
      <Field label={t("code")} htmlFor="code" error={state.error && t(`errors.${state.error}`)}>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(next);
            // Submit as soon as the sixth digit lands, including when iOS autofills the code.
            if (next.length === 6 && !pending) {
              const data = new FormData(formRef.current!);
              data.set("code", next);
              data.set("intent", "verify");
              startTransition(() => action(data));
            }
          }}
          aria-invalid={!!state.error}
          autoFocus
          className="num h-12 text-center text-2xl font-semibold tracking-[0.4em]"
        />
      </Field>
      <Button type="submit" size="lg" name="intent" value="verify" pending={pending} disabled={code.length !== 6}>
        {t("signIn")}
      </Button>
      <div className="flex items-center justify-between text-[13px]">
        <button type="submit" name="intent" value="change-email" formNoValidate className="text-muted hover:text-ink">
          {t("changeEmail")}
        </button>
        <button
          type="submit"
          name="intent"
          value="send"
          disabled={wait > 0 || pending}
          onClick={() => setWait(RESEND_AFTER)}
          className="font-medium text-ink disabled:font-normal disabled:text-faint"
        >
          {wait > 0 ? t("resendIn", { seconds: wait }) : t("resend")}
        </button>
      </div>
      {state.resent && !state.error && <p className="text-[13px] text-muted">{t("resent")}</p>}
    </form>
  );
}
