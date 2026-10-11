import { useTranslations } from "next-intl";

export const REPOSITORY_URL = "https://github.com/ZigaoWang/h2h-finance";
const LICENSE_URL = "https://github.com/ZigaoWang/h2h-finance/blob/main/LICENSE";

const link = "transition-colors hover:text-ink";

/** One quiet line: who made it, its license (the AGPL asks every deployment to offer the source) and two links. */
export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-2 px-4 py-6 text-[12px] text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()}{" "}
          <a href="https://www.zigao.wang" className={link}>
            Zigao Wang
          </a>
          {" · "}
          {t.rich("license", {
            license: (chunks) => (
              <a href={LICENSE_URL} className={link}>
                {chunks}
              </a>
            ),
          })}
        </p>
        <nav className="flex gap-4" aria-label={t("label")}>
          <a href="https://h2h.ykps.net" className={link}>
            {t("website")}
          </a>
          <a href={REPOSITORY_URL} className={link}>
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
