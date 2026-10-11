import { listCategories } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/dal";
import { OptionsManager } from "../options";

export default async function CategoriesPage() {
  await requireAdmin();
  return <OptionsManager kind="categories" options={listCategories().map((c) => ({ ...c, archived: !!c.archivedAt, archivedAt: undefined }))} />;
}
