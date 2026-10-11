"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/login/actions";
import { LocaleSwitch } from "@/components/locale-switch";
import { cn } from "@/lib/cn";

/** Account menu. In the sidebar it shows name and role; in the mobile top bar, just initials. */
export function AccountMenu({ name, role, compact }: { name: string; role: string; compact?: boolean }) {
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
        className={cn(
          "flex items-center gap-2.5 rounded-md text-left transition-colors",
          compact ? "p-0.5" : "w-full px-2 py-1.5 hover:bg-black/[0.04]",
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-ink-2">{initials(name)}</span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{name}</span>
              <span className="block truncate text-xs text-muted">{role}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-faint" aria-hidden />
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 w-60 animate-fade-in rounded-lg bg-surface p-1 shadow-pop",
            compact ? "top-10 right-0" : "bottom-12 left-0",
          )}
        >
          {compact && (
            <div className="border-b border-line px-2.5 pt-1.5 pb-2">
              <p className="truncate text-[13px] font-medium">{name}</p>
              <p className="truncate text-xs text-muted">{role}</p>
            </div>
          )}
          {compact && (
            <a href="/" target="_blank" className="flex items-center gap-2 border-b border-line px-2.5 py-2 text-[13px] text-ink-2 hover:text-ink">
              {t("publicPage")} ↗
            </a>
          )}
          <div className="flex items-center justify-between px-2.5 py-2">
            <span className="text-[13px] text-muted">{t("language")}</span>
            <LocaleSwitch />
          </div>
          <form action={signOut} className="border-t border-line pt-1">
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink-2 hover:bg-subtle hover:text-ink">
              <LogOut className="size-3.5" aria-hidden />
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
