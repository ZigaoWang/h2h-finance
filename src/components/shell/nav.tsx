"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, HandCoins, LayoutGrid, Plus, ReceiptText, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type Item = { href: string; key: "dashboard" | "expenses" | "review" | "reimburse" | "admin"; icon: typeof LayoutGrid };

const MEMBER: Item[] = [
  { href: "/", key: "dashboard", icon: LayoutGrid },
  { href: "/expenses", key: "expenses", icon: ReceiptText },
];

const ADMIN: Item[] = [
  { href: "/review", key: "review", icon: ClipboardCheck },
  { href: "/reimburse", key: "reimburse", icon: HandCoins },
  { href: "/admin", key: "admin", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/expenses") return pathname === "/expenses" || /^\/expenses\/\d+/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Count({ value, className }: { value: number; className?: string }) {
  if (value <= 0) return null;
  return (
    <span className={cn("num inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] leading-5 font-semibold text-white", className)}>
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function DesktopNav({ isAdmin, reviewCount }: { isAdmin: boolean; reviewCount: number }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = isAdmin ? [...MEMBER, ...ADMIN] : MEMBER;

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label={t("label")}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm text-muted transition-colors hover:text-ink aria-[current=page]:bg-subtle aria-[current=page]:font-medium aria-[current=page]:text-ink"
        >
          {t(item.key)}
          {item.key === "review" && <Count value={reviewCount} />}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav({ isAdmin, reviewCount }: { isAdmin: boolean; reviewCount: number }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const left = isAdmin ? [MEMBER[0], ADMIN[0]] : [MEMBER[0]];
  const right = isAdmin ? [MEMBER[1], ADMIN[1]] : [MEMBER[1]];

  const tab = (item: Item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className="relative flex flex-1 flex-col items-center gap-1 pt-2 pb-1 text-[11px] text-muted aria-[current=page]:text-ink"
    >
      <item.icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
      {t(item.key)}
      {item.key === "review" && <Count value={reviewCount} className="absolute top-1 left-1/2 ml-2" />}
    </Link>
  );

  if (pathname === "/expenses/new") return null;

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="flex items-stretch">
        {left.map(tab)}
        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/expenses/new"
            aria-label={t("submit")}
            className="flex size-12 items-center justify-center rounded-full bg-ink text-white shadow-pop active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2} aria-hidden />
          </Link>
        </div>
        {right.map(tab)}
      </div>
    </nav>
  );
}
