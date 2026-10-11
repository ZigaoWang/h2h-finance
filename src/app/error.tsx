"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  useEffect(() => console.error(error), [error]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-[22px] font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">{t("description")}</p>
      {error.digest && <p className="num mt-3 text-xs text-faint">{t("reference", { digest: error.digest })}</p>}
      <Button onClick={reset} className="mt-6">
        {t("retry")}
      </Button>
    </main>
  );
}
