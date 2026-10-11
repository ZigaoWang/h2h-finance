import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AccountMenu } from "@/components/shell/account-menu";
import { DesktopNav, MobileNav } from "@/components/shell/nav";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { countPendingReview } from "@/lib/expenses/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const t = await getTranslations();
  const isAdmin = user.role === "admin";
  const reviewCount = isAdmin ? countPendingReview() : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <Logo label={t("brand.name")} />
          </Link>
          <DesktopNav isAdmin={isAdmin} reviewCount={reviewCount} />
          <div className="ml-auto flex items-center gap-3">
            <ButtonLink href="/expenses/new" size="sm" className="hidden md:inline-flex">
              <Plus className="size-4" aria-hidden />
              {t("nav.submit")}
            </ButtonLink>
            <AccountMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pt-8 md:pb-16">{children}</main>
      <MobileNav isAdmin={isAdmin} reviewCount={reviewCount} />
    </div>
  );
}
