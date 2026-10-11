import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/dal";
import { today } from "@/lib/dates";
import { listApprovedUnpaid } from "@/lib/expenses/queries";
import { getMember } from "@/lib/reimbursements";
import { PayBackForm } from "./pay-back-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("reimburse") };
}

export default async function PayBackPage({ params }: PageProps<"/reimburse/[userId]">) {
  await requireAdmin();
  const t = await getTranslations("reimburse");
  const member = getMember(Number((await params).userId));
  if (!member) notFound();
  const expenses = listApprovedUnpaid(member.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/reimburse" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>
      <h1 className="text-[22px] font-semibold tracking-tight">{t("payTitle", { name: member.name })}</h1>
      <p className="mt-1 mb-6 text-sm text-muted">{t("payHint")}</p>
      <PayBackForm userId={member.id} expenses={expenses} today={today()} />
    </div>
  );
}
