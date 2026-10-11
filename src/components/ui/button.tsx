import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

const variants = {
  primary: "bg-ink text-white hover:bg-ink-2 disabled:bg-ink/40",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-subtle disabled:text-faint",
  ghost: "text-ink-2 hover:bg-subtle hover:text-ink disabled:text-faint",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/40",
};

const sizes = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-[15px]",
};

type Style = { variant?: keyof typeof variants; size?: keyof typeof sizes };

function buttonClass({ variant = "primary", size = "md" }: Style, className?: string) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  pending,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & Style & { pending?: boolean }) {
  return (
    <button
      type="button"
      className={buttonClass({ variant, size }, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & Style) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}
