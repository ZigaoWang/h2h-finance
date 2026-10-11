import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExpenseDetailView } from "@/components/expense-detail";
import { requireUser } from "@/lib/auth/dal";
import { getExpenseDetail } from "@/lib/expenses/queries";

export async function generateMetadata({ params }: PageProps<"/expenses/[id]">): Promise<Metadata> {
  const t = await getTranslations("expense");
  return { title: t("title", { id: (await params).id }) };
}

export default async function ExpensePage({ params }: PageProps<"/expenses/[id]">) {
  const viewer = await requireUser();
  const t = await getTranslations("expense");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const detail = getExpenseDetail(id, viewer);
  const ownView = detail.expense.userId === viewer.id;

  return (
    <>
      <Link href={ownView ? "/expenses" : "/dashboard"} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {ownView ? t("backToMine") : t("backToDashboard")}
      </Link>
      <h1 className="mb-6 text-[22px] font-semibold tracking-tight">{t("title", { id })}</h1>
      <ExpenseDetailView detail={detail} viewer={viewer} />
    </>
  );
}
