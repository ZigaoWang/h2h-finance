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
  // Members correct their own expenses; admins anyone's. Deleted ones are restored first.
  if ((expense.userId !== viewer.id && viewer.role !== "admin") || expense.status === "voided") notFound();
  const someoneElses = expense.userId !== viewer.id;

  // New choices come from current options, but an expense may keep the archived ones it already has.
  const categories = activeCategories().map(({ id, nameEn, nameZh }) => ({ id, nameEn, nameZh }));
  const events = activeEvents().map(({ id, nameEn, nameZh }) => ({ id, nameEn, nameZh }));
  if (!categories.some((c) => c.id === expense.categoryId)) {
    categories.push({ id: expense.categoryId, nameEn: expense.categoryEn, nameZh: expense.categoryZh });
  }
  if (expense.eventId && !events.some((e) => e.id === expense.eventId)) {
    events.push({ id: expense.eventId, nameEn: expense.eventEn ?? "", nameZh: expense.eventZh ?? "" });
  }

  return (
    <div className="max-w-2xl">
      <Link href={`/expenses/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {t("title", { id })}
      </Link>
      <h1 className="mb-6 text-[22px] font-semibold tracking-tight">{t("editTitle")}</h1>
      {someoneElses && (
        <Alert tone="info" className="mb-6">
          {t("adminEditNotice", { name: expense.userName })}
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
          categoryId: expense.categoryId,
          eventId: expense.eventId,
          description: expense.description,
          note: expense.note,
        }}
      />
    </div>
  );
}
