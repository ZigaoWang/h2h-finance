import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExpenseForm } from "@/components/expense-form/expense-form";
import { Alert } from "@/components/ui/alert";
import { activeCategories, activeEvents } from "@/lib/admin";
import { requireUser } from "@/lib/auth/dal";
import { today } from "@/lib/dates";
import { getExpenseDetail } from "@/lib/expenses/queries";
import { listYears } from "@/lib/years";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expense");
  return { title: t("editTitle") };
}

export default async function EditExpensePage({ params }: PageProps<"/expenses/[id]/edit">) {
  const viewer = await requireUser();
  const t = await getTranslations("expense");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const { expense, files } = getExpenseDetail(id, viewer);
  // Only the owner can edit, and only before approval.
  if (expense.userId !== viewer.id || (expense.status !== "pending" && expense.status !== "rejected")) notFound();

  // An archived category or event can't be chosen again, so the member picks a current one.
  const categories = activeCategories().map(({ id, nameEn, nameZh }) => ({ id, nameEn, nameZh }));
  const events = activeEvents().map(({ id, nameEn, nameZh }) => ({ id, nameEn, nameZh }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/expenses/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {t("title", { id })}
      </Link>
      <h1 className="mb-6 text-[22px] font-semibold tracking-tight">{t("editTitle")}</h1>
      {expense.status === "rejected" && (
        <Alert title={t("rejectedTitle")} className="mb-6">
          {expense.rejectionReason}
        </Alert>
      )}
      <ExpenseForm
        categories={categories}
        events={events}
        years={listYears().map(({ startsOn, endsOn }) => ({ startsOn, endsOn }))}
        today={today()}
        edit={{
          id,
          item: { amountCents: expense.amountCents, merchant: expense.merchant, spentOn: expense.spentOn, fileIds: files.map((f) => f.id) },
          categoryId: categories.some((c) => c.id === expense.categoryId) ? expense.categoryId : null,
          eventId: events.some((e) => e.id === expense.eventId) ? expense.eventId : null,
          description: expense.description,
          note: expense.note,
        }}
      />
    </div>
  );
}
