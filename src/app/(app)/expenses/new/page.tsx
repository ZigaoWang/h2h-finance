import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExpenseForm } from "@/components/expense-form/expense-form";
import { Card, EmptyState } from "@/components/ui/card";
import { activeCategories, activeEvents } from "@/lib/admin";
import { requireUser } from "@/lib/auth/dal";
import { today } from "@/lib/dates";
import { listYears } from "@/lib/years";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("submit");
  return { title: t("title") };
}

export default async function NewExpensePage() {
  await requireUser();
  const t = await getTranslations("submit");
  const years = listYears().map(({ startsOn, endsOn }) => ({ startsOn, endsOn }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/expenses" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("title")}</h1>
      {years.length === 0 ? (
        <Card>
          <EmptyState title={t("noYearTitle")} description={t("noYearHint")} />
        </Card>
      ) : (
        <ExpenseForm
          categories={activeCategories().map(({ id, nameEn, nameZh }) => ({ id, nameEn, nameZh }))}
          events={activeEvents().map(({ id, nameEn, nameZh }) => ({ id, nameEn, nameZh }))}
          years={years}
          today={today()}
        />
      )}
    </div>
  );
}
