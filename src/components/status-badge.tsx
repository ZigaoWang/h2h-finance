import { useTranslations } from "next-intl";
import type { ExpenseStatus } from "@/lib/db/schema";
import { cn } from "@/lib/cn";

const DOTS: Record<ExpenseStatus, string> = {
  pending: "bg-pending",
  approved: "bg-approved",
  reimbursed: "bg-paid",
  rejected: "bg-danger",
  voided: "bg-faint",
};

/** Status as a coloured dot and plain text, so colour is never the only signal. */
export function StatusBadge({ status, className }: { status: ExpenseStatus; className?: string }) {
  const t = useTranslations("status");
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-2", className)}>
      <span className={cn("size-1.5 rounded-full", DOTS[status])} aria-hidden />
      {t(status)}
    </span>
  );
}
