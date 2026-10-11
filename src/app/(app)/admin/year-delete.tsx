"use client";

import { useTranslations } from "next-intl";
import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteYearAction } from "./actions";

export function YearDelete({ id, label }: { id: number; label: string }) {
  const t = useTranslations("admin.years");
  return <ConfirmDelete title={t("deleteTitle", { label })} action={() => deleteYearAction(id)} />;
}
