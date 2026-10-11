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
      <div className="mx-auto flex max-w-[1080px] flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <a href="https://h2h.ykps.net" className="inline-flex items-center gap-2 self-start text-[13px] font-medium text-ink-2 transition-colors hover:text-ink">
          <LogoMark size={20} />
          {t("club")}
        </a>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-faint">
          <a href={LICENSE_URL} className={link}>
            {t("license")}
          </a>
          <span aria-hidden>·</span>
          <a href={REPOSITORY_URL} className={link}>
            {t("source")}
          </a>
          <span aria-hidden>·</span>
          <span>
            {t.rich("madeBy", {
              author: (chunks) => (
                <a href="https://www.zigao.wang" className={link}>
                  {chunks}
                </a>
              ),
            })}
          </span>
        </p>
      </div>
    </footer>
  );
}
