import { useLocale, useTranslations } from "next-intl";
import { Panel, Section } from "@/components/ui/card";
import { localName } from "@/lib/i18n-names";
import { formatMoney } from "@/lib/money";
import type { Slice } from "@/lib/stats";

/** Where the money went along one dimension, largest first. Every value is also written out. */
export function Breakdown({ title, slices, total, fallback }: { title: string; slices: Slice[]; total: number; fallback?: string }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const percent = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en", { style: "percent", maximumFractionDigits: 0 });

  return (
    <Section title={title}>
      <Panel>
        {slices.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted">{t("nothingYet")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {slices.map((slice) => {
              const share = total ? slice.cents / total : 0;
              return (
                <li key={slice.key} className="px-4 py-3">
                  <div className="flex items-baseline gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{localName(locale, slice.nameEn, slice.nameZh) || fallback}</span>
                    <span className="num text-xs text-faint">{percent.format(share)}</span>
                    <span className="num font-medium">{formatMoney(slice.cents)}</span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-ink/80" style={{ width: `${Math.max(1, share * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </Section>
  );
}
