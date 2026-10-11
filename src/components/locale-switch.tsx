"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { setLocale } from "@/app/actions";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
] as const;

export function LocaleSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label="Language" className={cn("inline-flex rounded-md border border-line bg-surface p-0.5", className)}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value === "zh" ? "zh-CN" : "en"}
          aria-pressed={locale === option.value}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setLocale(option.value);
              router.refresh();
            })
          }
          className={cn(
            "h-7 rounded-[4px] px-2 text-xs font-medium transition-colors",
            locale === option.value ? "bg-ink text-white" : "text-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
