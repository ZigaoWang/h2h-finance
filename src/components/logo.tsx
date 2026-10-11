import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={cn("size-7", className)} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#1c1b19" />
      <path
        d="M16 24.5s-7.5-4.6-7.5-10.1A4.15 4.15 0 0 1 16 12a4.15 4.15 0 0 1 7.5 2.4c0 5.5-7.5 10.1-7.5 10.1Z"
        fill="#d42a22"
      />
    </svg>
  );
}

export function Logo({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">{label}</span>
    </span>
  );
}
