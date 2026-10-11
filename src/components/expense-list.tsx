import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import type { ExpenseStatus } from "@/lib/db/schema";
import { localName } from "@/lib/i18n-names";
import { formatMoney } from "@/lib/money";

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
 * Expenses as a table on wider screens and as compact rows on phones. Deleted ones are marked and struck through.
 * Rows link to the detail page when `href` returns a path.
 */
export function ExpenseList({
  items,
  href,
  showStatus = true,
  showMember = true,
}: {
  items: ListItem[];
  href?: (item: ListItem) => string | undefined;
  showStatus?: boolean;
  showMember?: boolean;
}) {
  const t = useTranslations("table");
  const locale = useLocale();
  const category = (i: ListItem) => localName(locale, i.categoryEn, i.categoryZh);
  const event = (i: ListItem) => (i.eventEn || i.eventZh ? localName(locale, i.eventEn, i.eventZh) : null);
  const member = showMember && items.some((i) => i.userName);
  const amount = (i: ListItem) => (
    <span className={cn("num font-medium whitespace-nowrap", i.status === "voided" && "text-faint line-through")}>{formatMoney(i.amountCents)}</span>
  );

  return (
    <>
      <table className="hidden w-full table-fixed text-sm md:table">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="w-[100px] py-2.5 pl-4 font-medium">{t("date")}</th>
            <th className="py-2.5 pl-3 font-medium">{t("description")}</th>
            <th className="w-[13%] py-2.5 pl-3 font-medium">{t("category")}</th>
            <th className="w-[15%] py-2.5 pl-3 font-medium">{t("event")}</th>
            {member && <th className="w-[12%] py-2.5 pl-3 font-medium">{t("member")}</th>}
            <th className="w-[112px] py-2.5 pr-4 pl-3 text-right font-medium">{t("amount")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => {
            const link = href?.(item);
            return (
              <tr key={item.id} className={cn("relative", link && "transition-colors hover:bg-subtle/70")}>
                <td className="num py-3 pl-4 whitespace-nowrap text-muted">{formatDate(item.spentOn, locale)}</td>
                <td className="py-3 pl-3">
                  {link ? (
                    <Link href={link} className="block truncate font-medium after:absolute after:inset-0">
                      {item.description}
                    </Link>
                  ) : (
                    <span className="block truncate font-medium">{item.description}</span>
                  )}
                  {(item.merchant || item.status === "voided") && (
                    <span className="block truncate text-xs text-muted">
                      {item.status === "voided" && showStatus && <StatusBadge status="voided" className="mr-2 text-xs" />}
                      {item.merchant}
                    </span>
                  )}
                </td>
                <td className="truncate py-3 pl-3 text-ink-2">{category(item)}</td>
                <td className="truncate py-3 pl-3 text-ink-2">{event(item) ?? <span className="text-faint">—</span>}</td>
                {member && <td className="truncate py-3 pl-3 text-ink-2">{item.userName}</td>}
                <td className="py-3 pr-4 pl-3 text-right">{amount(item)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="divide-y divide-line md:hidden">
        {items.map((item) => {
          const link = href?.(item);
          const meta = [formatDate(item.spentOn, locale), category(item), event(item), member ? item.userName : null].filter(Boolean).join(" · ");
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.description}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{meta}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {amount(item)}
                {showStatus && item.status === "voided" && <StatusBadge status="voided" className="text-xs" />}
              </div>
            </>
          );
          return (
            <li key={item.id}>
              {link ? (
                <Link href={link} className="flex items-center gap-4 px-4 py-3 active:bg-subtle">
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-4 px-4 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
