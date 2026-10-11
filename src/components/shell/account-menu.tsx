"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/login/actions";
import { LocaleSwitch } from "@/components/locale-switch";

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("account")}
        onClick={() => setOpen((o) => !o)}
        className="flex size-8 items-center justify-center rounded-full bg-subtle text-[13px] font-semibold text-ink-2 ring-line-strong transition hover:ring-1"
      >
        {initials(name)}
      </button>
      {open && (
        <div role="menu" className="absolute top-10 right-0 z-40 w-64 animate-fade-in rounded-lg border border-line bg-surface p-1.5 shadow-pop">
          <div className="px-2.5 pt-1.5 pb-2.5">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-[13px] text-muted">{email}</p>
          </div>
          <div className="flex items-center justify-between border-t border-line px-2.5 py-2.5">
            <span className="text-[13px] text-muted">{t("language")}</span>
            <LocaleSwitch />
          </div>
          <form action={signOut} className="border-t border-line pt-1.5">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-2 hover:bg-subtle hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden />
              {t("signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function initials(name: string) {
  const trimmed = name.trim();
  // Chinese names read best as their last character.
  if (/[㐀-鿿]/.test(trimmed)) return trimmed.slice(-1);
  const parts = trimmed.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
