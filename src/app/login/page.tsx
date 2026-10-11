import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { Logo } from "@/components/logo";
import { getSessionUser } from "@/lib/auth/dal";
import { isPublicPageEnabled } from "@/lib/settings";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo label={t("brand.name")} />
        <LocaleSwitch />
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pt-[12vh] pb-16">
        <div className="w-full max-w-[380px]">
          <LoginForm />
          <p className="mt-8 text-center text-[13px] leading-relaxed text-muted">{t("login.inviteOnly")}</p>
          {isPublicPageEnabled() && (
            <p className="mt-3 text-center text-[13px]">
              <Link href="/transparency" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                {t("login.viewPublic")}
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
