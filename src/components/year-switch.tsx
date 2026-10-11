"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/field";

export function YearSwitch({ years, value }: { years: { id: number; label: string }[]; value: number }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (years.length < 2) return null;

  return (
    <Select
      aria-label={t("year")}
      value={value}
      className="h-9 w-auto min-w-36 text-sm"
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("year", e.target.value);
        router.push(`${pathname}?${next}`);
      }}
    >
      {years.map((y) => (
        <option key={y.id} value={y.id}>
          {y.label}
        </option>
      ))}
    </Select>
  );
}
