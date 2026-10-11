import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/cn";

const TONES = {
  error: { box: "border-danger/20 bg-danger-bg text-danger", Icon: AlertCircle },
  warning: { box: "border-pending/20 bg-warning-bg text-pending", Icon: AlertTriangle },
  info: { box: "border-line bg-subtle text-ink-2", Icon: Info },
};

export function Alert({ tone = "error", title, children, className }: { tone?: keyof typeof TONES; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, Icon } = TONES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-md border px-3 py-2.5 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "leading-snug")}>{children}</div>}
      </div>
    </div>
  );
}
