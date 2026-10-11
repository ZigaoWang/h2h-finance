import { useTranslations } from "next-intl";

export function MadeBy() {
  const t = useTranslations("home");
  return (
    <span>
      {t.rich("madeBy", {
        link: (chunks) => (
          <a href="https://www.zigao.wang" className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink">
            {chunks}
          </a>
        ),
      })}
    </span>
  );
}
