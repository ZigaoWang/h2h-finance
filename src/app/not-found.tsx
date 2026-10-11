import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="num text-sm font-medium text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">{t("description")}</p>
      <ButtonLink href="/" className="mt-6">
        {t("home")}
      </ButtonLink>
    </main>
  );
}
