"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input, Select } from "@/components/ui/field";

/** Member and text filters, kept in the URL so a filtered view can be shared or bookmarked. */
export function ExpenseFilters({ members, member, query }: { members: { id: number; name: string }[]; member?: number; query: string }) {
  const t = useTranslations("allExpenses");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(query);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(next.size ? `${pathname}?${next}` : pathname);
  };

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
      <form
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", text.trim());
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <Input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => update("q", text.trim())} placeholder={t("search")} aria-label={t("search")} className="pl-9" />
      </form>
      <Select value={member ?? ""} onChange={(e) => update("member", e.target.value)} aria-label={t("member")} className="sm:w-52">
        <option value="">{t("everyone")}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
