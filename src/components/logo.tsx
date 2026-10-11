import Image from "next/image";
import { cn } from "@/lib/cn";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return <Image src="/logo-mark.png" alt="" width={size} height={size} className={cn("shrink-0", className)} priority />;
}

/** The Heart to Heart bear with the product name beside it. */
export function Logo({ name, product, className }: { name: string; product: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[14px] font-semibold tracking-tight">{name}</span>
        <span className="mt-1 text-[12px] text-muted">{product}</span>
      </span>
    </span>
  );
}
