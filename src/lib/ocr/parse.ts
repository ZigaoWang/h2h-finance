import type { OcrResult } from "@/lib/db/schema";

// Pulls amount, merchant and date out of OCR text from WeChat Pay, Alipay and
// shopping-app screenshots. Every field is optional: a wrong guess is worse than
// an empty field, so anything uncertain is left for the member to fill in.

const CJK = "\\u3400-\\u9fff\\uff00-\\uffef\\u3000-\\u303f";

/** Tesseract puts spaces between Chinese characters; join them back up. */
export function normalizeLine(line: string): string {
  return line
    .replace(new RegExp(`([${CJK}])\\s+(?=[${CJK}])`, "g"), "$1")
    .replace(/[：]/g, ":")
    .replace(/\s+/g, " ")
    .trim();
}

const AMOUNT = /(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})(?!\d)/;
// A line that is just the headline amount, e.g. "-25.00", "¥ 25.00", "Y25.00" (OCR often reads ¥ as Y).
const HEADLINE_AMOUNT = /^[-−–—~]?\s*[¥￥YXV羊]?\s*[-−–—]?\s*(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})\s*(元)?$/;
// Strongest first: what was actually paid beats subtotals.
const AMOUNT_LABELS = [
  /(实付款|实付金额|实付|实收|付款金额|支付金额|交易金额|Amount Paid|Paid)/i,
  /(合计|总计|订单金额|Total|Amount)/i,
  /(总价|商品总价|Subtotal)/i,
];

const DATE = /(20\d{2})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})/;
const DATE_LABELS = /(支付时间|付款时间|交易时间|创建时间|下单时间|成交时间|转账时间|Transaction Time|Payment Time|Time)/i;

const TIME = /(?:^|\D)([01]?\d|2[0-3])[:.：](\d{2})(?:[:.：]\d{2})?(?!\d)/;
// The platform's own number first (WeChat 交易单号, Alipay 交易号: always 28 digits),
// then a shop's order number. A number with a missing digit is worse than none.
const TRANSACTION_LABELS: [RegExp, RegExp][] = [
  [/^(交易单号|交易号|Transaction (No|ID|Number)\.?)\s*:?\s*/i, /^\d{28}$/],
  [/^(订单号|订单编号|Order (No|ID|Number)\.?)\s*:?\s*/i, /^\d{16,32}$/],
];

const MERCHANT_LABELS = /^(商户全称|商户名称|收款方全称|收款方|收款人|商家|店铺名称|店铺|Merchant Name|Merchant|Payee)\s*:?\s*/i;
// Lines near the amount that are statuses or UI chrome, never a merchant.
const NOT_MERCHANT =
  /(支付成功|交易成功|付款成功|当前状态|账单详情|全部账单|对此订单有疑问|Payment Successful|Transaction|Details|Successful|^\d|^[-+¥￥])/i;

function toCents(whole: string, fraction: string): number | undefined {
  const cents = Number(whole.replace(/,/g, "")) * 100 + Number(fraction);
  return Number.isSafeInteger(cents) && cents > 0 && cents < 100_000_000 ? cents : undefined;
}

type FoundAmount = { cents: number; headlineLine?: number };

function findAmount(lines: string[]): FoundAmount | undefined {
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(HEADLINE_AMOUNT);
    if (match) {
      const cents = toCents(match[1], match[2]);
      if (cents) return { cents, headlineLine: i };
    }
  }
  for (const label of AMOUNT_LABELS) {
    for (let i = 0; i < lines.length; i++) {
      if (!label.test(lines[i])) continue;
      // The value is usually on the same line, otherwise on the next one.
      for (const candidate of [lines[i].replace(label, " "), lines[i + 1] ?? ""]) {
        const match = candidate.match(AMOUNT);
        const cents = match && toCents(match[1], match[2]);
        if (cents) return { cents };
      }
    }
  }
  return undefined;
}

function findDate(lines: string[]): string | undefined {
  const labelled = lines.find((line) => DATE_LABELS.test(line) && DATE.test(line));
  const line = labelled ?? lines.find((l) => DATE.test(l));
  const match = line?.match(DATE);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : undefined;
}

function findTime(lines: string[]): string | undefined {
  const line = lines.find((l) => DATE_LABELS.test(l) && DATE.test(l));
  const match = line?.replace(DATE, " ").match(TIME);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : undefined;
}

function findTransactionId(lines: string[]): string | undefined {
  for (const [label, valid] of TRANSACTION_LABELS) {
    for (let i = 0; i < lines.length; i++) {
      if (!label.test(lines[i])) continue;
      let digits = lines[i].replace(label, "").replace(/\s+/g, "");
      // Long numbers wrap onto the next line in Alipay.
      if (/^\d{1,6}$/.test(lines[i + 1] ?? "")) digits += lines[i + 1];
      if (valid.test(digits)) return digits;
    }
  }
  return undefined;
}

function cleanMerchant(value: string): string | undefined {
  const cleaned = value.replace(/[>›»|]+$/, "").trim();
  if (cleaned.length < 2 || cleaned.length > 60) return undefined;
  if (NOT_MERCHANT.test(cleaned)) return undefined;
  return cleaned;
}

function findMerchant(lines: string[], headlineLine?: number): string | undefined {
  // Payment apps print the short shop name right above the headline amount.
  if (headlineLine !== undefined) {
    for (let i = headlineLine - 1; i >= Math.max(0, headlineLine - 2); i--) {
      const merchant = cleanMerchant(lines[i]);
      if (merchant) return merchant;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (!MERCHANT_LABELS.test(lines[i])) continue;
    const merchant = cleanMerchant(lines[i].replace(MERCHANT_LABELS, "")) ?? cleanMerchant(lines[i + 1] ?? "");
    if (merchant) return merchant;
  }
  return undefined;
}

type Reading = OcrResult & { headline: boolean };

function analyse(text: string): Reading {
  const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const amount = findAmount(lines);
  const reading: Reading = { headline: amount?.headlineLine !== undefined };
  if (amount) reading.amountCents = amount.cents;
  const merchant = findMerchant(lines, amount?.headlineLine);
  if (merchant) reading.merchant = merchant;
  const spentOn = findDate(lines);
  if (spentOn) reading.spentOn = spentOn;
  // A time only means something next to a date we trust.
  const paidAt = spentOn ? findTime(lines) : undefined;
  if (paidAt) reading.paidAt = paidAt;
  const transactionId = findTransactionId(lines);
  if (transactionId) reading.transactionId = transactionId;
  return reading;
}

export function parseReceiptText(text: string): OcrResult {
  return combineReadings([text]);
}

/** One value from several readings: the first one found, unless two readings disagree. */
function agreed<T>(values: (T | undefined)[]): T | undefined {
  const found = values.filter((v): v is T => v !== undefined);
  return found.every((v) => v === found[0]) ? found[0] : undefined;
}

/**
 * Combines readings of the same image at different scales. A reading that found the big
 * headline amount is trusted for the amount and the shop name printed above it; dates must
 * agree wherever they were read. Any conflict leaves the field for the member to fill in.
 */
export function combineReadings(texts: string[]): OcrResult {
  const readings = texts.map(analyse);
  const headline = readings.filter((r) => r.headline);
  const trusted = headline.length ? headline : readings;
  const result: OcrResult = {};
  const amountCents = agreed(trusted.map((r) => r.amountCents));
  if (amountCents) result.amountCents = amountCents;
  const merchant = agreed(trusted.map((r) => r.merchant)) ?? (headline.length ? undefined : agreed(readings.map((r) => r.merchant)));
  if (merchant) result.merchant = merchant;
  const spentOn = agreed(readings.map((r) => r.spentOn));
  if (spentOn) result.spentOn = spentOn;
  const paidAt = agreed(readings.map((r) => r.paidAt));
  if (paidAt) result.paidAt = paidAt;
  const transactionId = agreed(readings.map((r) => r.transactionId));
  if (transactionId) result.transactionId = transactionId;
  return result;
}
