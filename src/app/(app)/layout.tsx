import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AccountMenu } from "@/components/shell/account-menu";
import { MobileNav, SidebarNav } from "@/components/shell/nav";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { countAwaitingPayback, countPendingReview } from "@/lib/expenses/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const t = await getTranslations();
  const isAdmin = user.role === "admin";
  const counts = isAdmin ? { review: countPendingReview(), reimburse: countAwaitingPayback() } : { review: 0, reimburse: 0 };
  const logo = <Logo name={t("brand.org")} product={t("brand.product")} />;

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-[#fafafa] lg:flex">
        <div className="px-4 pt-5 pb-6">
          <Link href="/dashboard">{logo}</Link>
        </div>
        <div className="px-3 pb-6">
          <ButtonLink href="/expenses/new" className="w-full">
            <Plus className="size-4" aria-hidden />
            {t("nav.submit")}
          </ButtonLink>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <SidebarNav isAdmin={isAdmin} counts={counts} />
        </div>
        <div className="border-t border-line p-2">
          <AccountMenu name={user.name} role={t(`roles.${user.role}`)} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6 lg:hidden">
        <Link href="/dashboard">{logo}</Link>
        <AccountMenu name={user.name} role={t(`roles.${user.role}`)} compact />
      </header>

      <main className="mx-auto w-full max-w-[1080px] px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">{children}</main>
      <MobileNav isAdmin={isAdmin} counts={counts} />
    </div>
  );
}
