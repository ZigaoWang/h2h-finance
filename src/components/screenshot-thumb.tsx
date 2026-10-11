"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";

/** A receipt thumbnail that opens the full screenshot in place, without leaving the page. */
export function ScreenshotThumb({ fileId, count }: { fileId: string; count?: number }) {
  const t = useTranslations("expense");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block aspect-[3/5] w-24 shrink-0 overflow-hidden rounded-md border border-line bg-subtle sm:w-28"
        aria-label={t("openOriginal")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- private, access-checked files */}
        <img src={`/api/files/${fileId}?size=thumb`} alt="" className="size-full object-cover object-top transition-transform group-hover:scale-[1.02]" />
        {count && count > 1 && (
          <span className="num absolute right-1 bottom-1 rounded bg-ink/80 px-1.5 text-[11px] leading-5 font-medium text-white">+{count - 1}</span>
        )}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("receiptAlt", { number: 1 })} wide>
        {/* eslint-disable-next-line @next/next/no-img-element -- private, access-checked files */}
        <img src={`/api/files/${fileId}`} alt="" className="mx-auto max-h-[78vh] w-auto rounded-md" />
      </Dialog>
    </>
  );
}
