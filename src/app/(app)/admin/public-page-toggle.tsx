"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { setPublicPageAction } from "./actions";

export function PublicPageToggle({ enabled }: { enabled: boolean }) {
  const t = useTranslations("admin.public");
  const toggle = useAction(setPublicPageAction, { success: t("updated") });

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-medium">{enabled ? t("on") : t("off")}</p>
          <p className="mt-0.5 text-[13px] text-muted">{t("whatsShown")}</p>
        </div>
        <Switch checked={enabled} onChange={(next) => toggle.execute(next)} disabled={toggle.pending} label={t("title")} />
      </div>
      {enabled && (
        <Link href="/" target="_blank" className="inline-flex items-center gap-1 self-start text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          {t("view")}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      )}
      {toggle.error && <Alert>{toggle.error}</Alert>}
    </div>
  );
}
