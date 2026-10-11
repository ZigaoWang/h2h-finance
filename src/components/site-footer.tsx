import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/logo";

export const REPOSITORY_URL = "https://github.com/ZigaoWang/h2h-finance";
const LICENSE_URL = "https://github.com/ZigaoWang/h2h-finance/blob/main/LICENSE";

const quiet = "hover:text-ink transition-colors";

/**
 * A quiet footer: where the club lives, the source code (which the AGPL asks every deployment
 * to offer), who made it and under what license.
 */
export function SiteFooter({ signIn }: { signIn?: { href: string; label: string } }) {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-[#fafafa]">
      <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a href="https://h2h.ykps.net" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink">
            <LogoMark size={20} />
            {t("club")}
          </a>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted" aria-label={t("label")}>
            <a href="https://h2h.ykps.net" className={quiet}>
              {t("website")}
            </a>
            <a href={REPOSITORY_URL} className={quiet}>
              {t("source")}
            </a>
            {signIn && (
              <Link href={signIn.href} className={`inline-flex items-center gap-1.5 ${quiet}`}>
                <Lock className="size-3" aria-hidden />
                {signIn.label}
              </Link>
            )}
          </nav>
        </div>
        <p className="mt-6 border-t border-line pt-5 text-[12px] leading-relaxed text-faint">
          {t.rich("legal", {
            year,
            license: (chunks) => (
              <a href={LICENSE_URL} className="underline decoration-line-strong underline-offset-2 hover:text-muted">
                {chunks}
              </a>
            ),
            author: (chunks) => (
              <a href="https://www.zigao.wang" className="underline decoration-line-strong underline-offset-2 hover:text-muted">
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </footer>
  );
}
