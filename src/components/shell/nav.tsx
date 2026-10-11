"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, HandCoins, LayoutDashboard, Plus, ReceiptText, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type Key = "dashboard" | "expenses" | "review" | "reimburse" | "admin";
type Item = { href: string; key: Key; icon: typeof LayoutDashboard };

const MEMBER: Item[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/expenses", key: "expenses", icon: ReceiptText },
];

const ADMIN: Item[] = [
  { href: "/review", key: "review", icon: ClipboardCheck },
  { href: "/reimburse", key: "reimburse", icon: HandCoins },
  { href: "/admin", key: "admin", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/expenses") return pathname === "/expenses" || /^\/expenses\/\d+/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="num ml-auto min-w-5 rounded-full bg-ink px-1.5 text-center text-[11px] leading-5 font-semibold text-white">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function SidebarLink({ item, pathname, count }: { item: Item; pathname: string; count?: number }) {
  const t = useTranslations("nav");
  return (
    <Link
      href={item.href}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-ink-2 transition-colors hover:bg-black/[0.04] hover:text-ink aria-[current=page]:bg-black/[0.05] aria-[current=page]:font-medium aria-[current=page]:text-ink"
    >
      <item.icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
      {t(item.key)}
      {count !== undefined && <Count value={count} />}
    </Link>
  );
}

type Counts = { review: number; reimburse: number };

export function SidebarNav({ isAdmin, counts }: { isAdmin: boolean; counts: Counts }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        {MEMBER.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
      {isAdmin && (
        <div className="flex flex-col gap-0.5">
          <p className="mb-1 px-2.5 text-xs font-medium text-faint">{t("adminSection")}</p>
          {ADMIN.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              pathname={pathname}
              count={item.key === "review" ? counts.review : item.key === "reimburse" ? counts.reimburse : undefined}
            />
          ))}
        </div>
      )}
    </nav>
  );
}

export function MobileNav({ isAdmin, counts }: { isAdmin: boolean; counts: Counts }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  if (pathname === "/expenses/new" || /^\/expenses\/\d+\/edit$/.test(pathname)) return null;

  const left = isAdmin ? [MEMBER[0], ADMIN[0]] : [MEMBER[0]];
  const right = isAdmin ? [MEMBER[1], ADMIN[1]] : [MEMBER[1]];
  const tab = (item: Item) => {
    const count = item.key === "review" ? counts.review : item.key === "reimburse" ? counts.reimburse : 0;
    return (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className="relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] text-muted aria-[current=page]:font-medium aria-[current=page]:text-ink"
    >
      <item.icon className="size-[22px]" strokeWidth={1.6} aria-hidden />
      {t(item.key)}
      {count > 0 && (
        <span className="num absolute top-1 left-1/2 ml-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
    );
  };

  return (
    <nav aria-label={t("label")} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="flex items-stretch">
        {left.map(tab)}
        <div className="flex flex-1 items-center justify-center">
          <Link href="/expenses/new" aria-label={t("submit")} className={cn("flex h-10 w-14 items-center justify-center rounded-xl bg-ink text-white active:scale-95")}>
            <Plus className="size-5" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>
        {right.map(tab)}
      </div>
    </nav>
  );
}
