import type { OcrResult } from "@/lib/db/schema";
import { dateInTransactionId } from "@/lib/ocr/parse";

/**
 * Where an expense's amount or date differs from what its screenshot shows. The transaction
 * number's embedded date beats a date read from the text, since it can't be misread into a valid one.
 */
export function screenshotMismatches(expense: { amountCents: number; spentOn: string }, ocr: OcrResult | null | undefined) {
  const screenshotDate = (ocr?.transactionId && dateInTransactionId(ocr.transactionId)) || ocr?.spentOn;
  return {
    amountCents: ocr?.amountCents && ocr.amountCents !== expense.amountCents ? ocr.amountCents : undefined,
    spentOn: screenshotDate && screenshotDate !== expense.spentOn ? screenshotDate : undefined,
  };
}
