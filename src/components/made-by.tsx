import { useTranslations } from "next-intl";

export const REPOSITORY_URL = "https://github.com/ZigaoWang/h2h-finance";

const link = "text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink";

/** Credits and the source code link the AGPL asks every deployment to offer its users. */
export function MadeBy() {
  const t = useTranslations("home");
  return (
    <>
      <a href={REPOSITORY_URL} className={link}>
        {t("openSource")}
      </a>
      <span aria-hidden>·</span>
      <span>
        {t.rich("madeBy", {
          link: (chunks) => (
            <a href="https://www.zigao.wang" className={link}>
              {chunks}
            </a>
          ),
        })}
      </span>
    </>
  );
}
