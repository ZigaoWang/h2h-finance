"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  { href: "/admin", key: "budget" },
  { href: "/admin/members", key: "members" },
  { href: "/admin/categories", key: "categories" },
  { href: "/admin/events", key: "events" },
] as const;

export function AdminTabs() {
  const t = useTranslations("admin.tabs");
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label={t("label")}>
      <div className="flex gap-6">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={pathname === tab.href ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent py-2.5 text-sm whitespace-nowrap text-muted hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
          >
            {t(tab.key)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
