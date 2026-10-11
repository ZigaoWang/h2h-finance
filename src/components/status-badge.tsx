import { useTranslations } from "next-intl";
import type { ExpenseStatus } from "@/lib/db/schema";
import { cn } from "@/lib/cn";

const TONES: Record<ExpenseStatus, string> = {
  pending: "bg-pending-bg text-pending",
  approved: "bg-approved-bg text-approved",
  reimbursed: "bg-paid-bg text-paid",
  rejected: "bg-danger-bg text-danger",
  voided: "bg-subtle text-muted line-through decoration-1",
};

const DOTS: Record<ExpenseStatus, string> = {
  pending: "bg-pending",
  approved: "bg-approved",
  reimbursed: "bg-paid",
  rejected: "bg-danger",
  voided: "bg-faint",
};

export function StatusBadge({ status, className }: { status: ExpenseStatus; className?: string }) {
  const t = useTranslations("status");
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium", TONES[status], className)}>
      <span className={cn("size-1.5 rounded-full", DOTS[status])} aria-hidden />
      {t(status)}
    </span>
  );
}
