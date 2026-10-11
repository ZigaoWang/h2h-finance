import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { LogoMark } from "@/components/logo";
import { MadeBy } from "@/components/made-by";

/** Centred layout for sign-in and first-run setup. */
export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("home");
  const brand = await getTranslations("brand");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="text-[15px] font-semibold tracking-tight">{brand("name")}</span>
        </Link>
        <LocaleSwitch />
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pt-[10vh] pb-20">
        <div className="w-full max-w-[360px]">{children}</div>
      </main>
      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-6 text-[13px] text-muted">
        <a href="https://h2h.ykps.net" className="font-medium text-ink-2 hover:text-ink">
          {t("mainSite")}
        </a>
        <span aria-hidden>·</span>
        <MadeBy />
      </footer>
    </div>
  );
}
