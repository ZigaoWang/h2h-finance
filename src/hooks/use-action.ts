"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";

/**
 * Runs a server action, shows a toast on success, and exposes the translated error message.
 * Unexpected failures (network, server bugs) surface as a generic error too.
 */
export function useAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  { success, onSuccess }: { success?: string; onSuccess?: (data: T) => void } = {},
) {
  const t = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function execute(...args: Args) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(...args);
        if (result.ok) {
          if (success) toast.success(success);
          onSuccess?.(result.data);
        } else {
          setError(t.has(result.error) ? t(result.error) : t("generic"));
        }
      } catch (e) {
        console.error(e);
        setError(t("generic"));
      }
    });
  }

  return { execute, pending, error, clearError: () => setError(null) };
}
