import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/logo";

export const REPOSITORY_URL = "https://github.com/ZigaoWang/h2h-finance";
const LICENSE_URL = "https://github.com/ZigaoWang/h2h-finance/blob/main/LICENSE";

const link = "transition-colors hover:text-ink";

/**
 * The club on the left, the software on the right: its license, its source code (which the AGPL
 * asks every deployment to offer) and who made it.
 */
export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-3 px-4 py-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
        <a href="https://h2h.ykps.net" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink">
          <LogoMark size={20} />
          {t("club")}
        </a>
        {/* Stacked on phones so no separator is left dangling at the end of a line. */}
        <div className="flex flex-col items-center gap-1 text-[12px] text-faint sm:flex-row sm:gap-2">
          <p className="flex items-center gap-2">
            <a href={LICENSE_URL} className={link}>
              {t("license")}
            </a>
            <span aria-hidden>·</span>
            <a href={REPOSITORY_URL} className={link}>
              {t("source")}
            </a>
          </p>
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <p>
            {t.rich("madeBy", {
              author: (chunks) => (
                <a href="https://www.zigao.wang" className={link}>
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </footer>
  );
}
