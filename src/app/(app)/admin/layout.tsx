import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { AdminTabs } from "./tabs";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const t = await getTranslations("admin");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <AdminTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
