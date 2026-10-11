import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A bordered box for tables, lists and forms. Headings sit outside it, in a Section. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("overflow-hidden rounded-lg border border-line bg-surface", className)} {...props} />;
}

/** A titled block of a page: heading and actions above, content below. */
export function Section({
  title,
  description,
  action,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-3 flex min-h-8 items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
