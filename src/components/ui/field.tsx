import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink shadow-[0_1px_1px_rgb(0_0_0/0.03)] placeholder:text-faint transition-[border-color,box-shadow] hover:border-faint focus:border-ink focus:shadow-[0_0_0_3px_rgb(0_0_0/0.08)] focus:outline-none focus-visible:outline-none aria-invalid:border-danger disabled:bg-subtle disabled:text-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-20 py-2 leading-snug", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-9 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <svg className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="m4.5 6.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
        {label}
        {optional && <span className="text-xs font-normal text-faint">{optional}</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-[13px] text-muted">{hint}</p>
      )}
    </div>
  );
}
