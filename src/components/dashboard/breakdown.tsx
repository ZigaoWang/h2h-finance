import { useLocale, useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/card";
import { localName } from "@/lib/i18n-names";
import { formatMoney } from "@/lib/money";
import type { Slice } from "@/lib/stats";

/** Where the money went along one dimension, largest first. Values are always shown as text. */
export function Breakdown({ title, slices, total, fallback }: { title: string; slices: Slice[]; total: number; fallback?: string }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const largest = slices[0]?.cents ?? 0;
  const percent = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en", { style: "percent", maximumFractionDigits: 0 });

  return (
    <Card>
      <CardHeader title={title} />
      {slices.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">{t("nothingYet")}</p>
      ) : (
        <ul className="divide-y divide-line">
          {slices.map((slice) => {
            const name = localName(locale, slice.nameEn, slice.nameZh) || fallback || "";
            return (
              <li key={slice.key} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="min-w-0 truncate">{name}</span>
                  <span className="num shrink-0 font-medium">{formatMoney(slice.cents)}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-subtle">
                    <div
                      className="h-full rounded-full bg-ink-2"
                      style={{ width: `${largest ? Math.max(1, (slice.cents / largest) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="num w-10 shrink-0 text-right text-xs text-muted">{percent.format(total ? slice.cents / total : 0)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
