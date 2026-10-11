import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useLocale } from "next-intl";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/dates";
import type { ExpenseStatus } from "@/lib/db/schema";
import { localName } from "@/lib/i18n-names";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

export type ListItem = {
  id: number;
  spentOn: string;
  description: string;
  amountCents: number;
  status?: ExpenseStatus;
  merchant?: string | null;
  userName?: string | null;
  userId?: number | null;
  categoryEn: string;
  categoryZh: string;
  eventEn: string | null;
  eventZh: string | null;
};

/**
 * One row per expense: what it was and the amount up front, the context underneath.
 * Rows link to the detail page when `href` is given.
 */
export function ExpenseList({ items, href, showStatus = true }: { items: ListItem[]; href?: (item: ListItem) => string | undefined; showStatus?: boolean }) {
  const locale = useLocale();
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const meta = [
          formatDate(item.spentOn, locale),
          localName(locale, item.categoryEn, item.categoryZh),
          item.eventEn || item.eventZh ? localName(locale, item.eventEn, item.eventZh) : null,
          item.userName,
          item.merchant,
        ].filter(Boolean);
        const link = href?.(item);
        const body = (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{item.description}</p>
              <p className="mt-0.5 truncate text-[13px] text-muted">{meta.join(" · ")}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={cn("num text-[15px] font-medium", item.status === "voided" && "text-faint line-through")}>
                {formatMoney(item.amountCents)}
              </span>
              {showStatus && item.status && <StatusBadge status={item.status} />}
            </div>
            {link && <ChevronRight className="hidden size-4 shrink-0 text-faint sm:block" aria-hidden />}
          </>
        );
        return (
          <li key={item.id}>
            {link ? (
              <Link href={link} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-subtle/60">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-4 px-5 py-3.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
