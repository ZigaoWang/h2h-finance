import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { LogoMark } from "@/components/logo";

/** Centred layout for sign-in and first-run setup. */
export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("brand");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="text-[15px] font-semibold tracking-tight">{t("name")}</span>
        </Link>
        <LocaleSwitch />
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pt-[10vh] pb-20">
        <div className="w-full max-w-[360px]">{children}</div>
      </main>
    </div>
  );
}
