import type { OcrResult } from "@/lib/db/schema";

// Pulls amount, merchant, date and transaction number out of OCR text from WeChat Pay,
// Alipay and shopping-app screenshots. Every field is optional: a wrong guess is worse
// than an empty field, so anything uncertain is left for the member to fill in.

/** A line of OCR output with Tesseract's confidence in it, 0–100. */
export type OcrLine = { text: string; confidence: number };

// Lines read with less confidence than this are too likely to be garbled to fill a field.
const MIN_CONFIDENCE = 80;
// The big headline amount reads with low confidence even when right, but it must match a strict
// money format to count at all, so a lower bar is safe there.
const MIN_HEADLINE_AMOUNT_CONFIDENCE = 50;
// Reads this confident count as votes, but a value needs one solid read to win.
const MIN_VOTE_CONFIDENCE = 60;
// When readings disagree evenly, the most confident one wins only by a clear margin.
const DECISIVE_MARGIN = 8;

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

// Who was paid, best source first. Alipay's counterparty row is the actual shop (its headline
// is often the product), then the name above the amount, then the company's legal name.
const COUNTERPARTY_LABELS = /^(对方账户|收款方(?!全称)|收款人|店铺名称|店铺|Payee|Merchant(?! Name))\s*:?\s*/i;
const LEGAL_NAME_LABELS = /^(商户全称|商户名称|收款方全称|Merchant Name)\s*:?\s*/i;
// Lines near the amount that are statuses or UI chrome, never a merchant.
const NOT_MERCHANT =
  /(支付成功|交易成功|付款成功|当前状态|账单详情|全部账单|余额明细|对此订单有疑问|Payment Successful|Transaction|Details|Successful|^\d|^[-+¥￥])/i;

// Row labels on payment screens. When OCR reads the label column apart from the values,
// "the line after a label" can be another label, which must never become a value.
const ROW_LABEL =
  /^(当前状态|支付时间|付款时间|创建时间|商品|商品说明|商户全称|商户名称|收单机构|支付方式|付款方式|交易类型|交易单号|交易号|商户单号|商家订单号|订单号|对方账户|收款方全称|收款方|标价|市场汇率|优惠|外语凭证|备注|余额|关联账单|账单服务|联系商家)$/;

/** The row label of the platform transaction number, e.g. for re-reading just that row. */
export const TRANSACTION_ROW = /^(交易单号|交易号)/;

/**
 * WeChat and Alipay transaction numbers are 28 digits and contain the payment date
 * (Alipay starts with it; WeChat has it at the eleventh digit). Anything else is a misread.
 */
export function checkTransactionId(digits: string | undefined, spentOn: string | undefined): string | undefined {
  if (!digits || !/^\d{28}$/.test(digits)) return undefined;
  if (spentOn && !digits.includes(spentOn.replaceAll("-", ""))) return undefined;
  return digits;
}

type Candidate<T> = { value: T; confidence: number };
type Field<T> = Candidate<T> | undefined;

type Reading = {
  amount: Field<number>;
  headline: boolean;
  counterparty: Field<string>;
  headlineName: Field<string>;
  legalName: Field<string>;
  spentOn: Field<string>;
  paidAt: Field<string>;
  transactionId: Field<string>;
};

function toCents(whole: string, fraction: string): number | undefined {
  const cents = Number(whole.replace(/,/g, "")) * 100 + Number(fraction);
  return Number.isSafeInteger(cents) && cents > 0 && cents < 100_000_000 ? cents : undefined;
}

function findAmount(lines: OcrLine[]): { field: Candidate<number>; headlineLine?: number } | undefined {
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].text.match(HEADLINE_AMOUNT);
    const cents = match && toCents(match[1], match[2]);
    if (cents) return { field: { value: cents, confidence: lines[i].confidence }, headlineLine: i };
  }
  for (const label of AMOUNT_LABELS) {
    for (let i = 0; i < lines.length; i++) {
      if (!label.test(lines[i].text)) continue;
      // The value is usually on the same line, otherwise on the next one.
      for (const line of [{ ...lines[i], text: lines[i].text.replace(label, " ") }, lines[i + 1]]) {
        const match = line?.text.match(AMOUNT);
        const cents = match && toCents(match[1], match[2]);
        if (cents) return { field: { value: cents, confidence: line.confidence } };
      }
    }
  }
  return undefined;
}

function findDate(lines: OcrLine[]): { field: Candidate<string>; line: OcrLine } | undefined {
  const line = lines.find((l) => DATE_LABELS.test(l.text) && DATE.test(l.text)) ?? lines.find((l) => DATE.test(l.text));
  const match = line?.text.match(DATE);
  if (!line || !match) return undefined;
  const [, y, m, d] = match;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(iso)) return undefined;
  return { field: { value: iso, confidence: line.confidence }, line };
}

function findTime(dateLine: OcrLine): Field<string> {
  const match = dateLine.text.replace(DATE, " ").match(TIME);
  return match ? { value: `${match[1].padStart(2, "0")}:${match[2]}`, confidence: dateLine.confidence } : undefined;
}

function findTransactionId(lines: OcrLine[]): Field<string> {
  for (const [label, valid] of TRANSACTION_LABELS) {
    for (let i = 0; i < lines.length; i++) {
      if (!label.test(lines[i].text)) continue;
      let digits = lines[i].text.replace(label, "").replace(/\s+/g, "");
      // Long numbers wrap onto the next line in Alipay.
      if (/^\d{1,6}$/.test(lines[i + 1]?.text ?? "")) digits += lines[i + 1].text;
      if (valid.test(digits)) return { value: digits, confidence: lines[i].confidence };
    }
  }
  return undefined;
}

function cleanMerchant(value: string): string | undefined {
  const cleaned = value.replace(/[>›»|]+$/, "").trim();
  if (cleaned.length < 2 || cleaned.length > 60) return undefined;
  if (NOT_MERCHANT.test(cleaned) || ROW_LABEL.test(cleaned)) return undefined;
  return cleaned;
}

function findLabelled(lines: OcrLine[], label: RegExp): Field<string> {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i].text)) continue;
    for (const line of [{ ...lines[i], text: lines[i].text.replace(label, "") }, lines[i + 1]]) {
      const value = line && cleanMerchant(line.text);
      if (value) return { value, confidence: line.confidence };
    }
  }
  return undefined;
}

/** Payment apps print the short shop name right above the headline amount. */
function findHeadlineName(lines: OcrLine[], headlineLine: number): Field<string> {
  for (let i = headlineLine - 1; i >= Math.max(0, headlineLine - 2); i--) {
    const value = cleanMerchant(lines[i].text);
    if (value) return { value, confidence: lines[i].confidence };
  }
  return undefined;
}

function analyse(raw: OcrLine[]): Reading {
  const lines = raw.map((l) => ({ ...l, text: normalizeLine(l.text) })).filter((l) => l.text);
  const amount = findAmount(lines);
  const date = findDate(lines);
  return {
    amount: amount?.field,
    headline: amount?.headlineLine !== undefined,
    counterparty: findLabelled(lines, COUNTERPARTY_LABELS),
    headlineName: amount?.headlineLine !== undefined ? findHeadlineName(lines, amount.headlineLine) : undefined,
    legalName: findLabelled(lines, LEGAL_NAME_LABELS),
    spentOn: date?.field,
    // A time only means something next to a date we trust.
    paidAt: date ? findTime(date.line) : undefined,
    transactionId: findTransactionId(lines),
  };
}

/**
 * One value from several readings. Reasonably confident reads vote; the value most readings
 * agree on wins, provided one of them was read solidly. An even split goes to the most
 * confident only by a clear margin.
 */
function pick<T>(fields: Field<T>[], minConfidence = MIN_CONFIDENCE): T | undefined {
  const votes = new Map<T, { count: number; best: number }>();
  for (const f of fields) {
    if (!f || f.confidence < Math.min(minConfidence, MIN_VOTE_CONFIDENCE)) continue;
    const vote = votes.get(f.value) ?? { count: 0, best: 0 };
    votes.set(f.value, { count: vote.count + 1, best: Math.max(vote.best, f.confidence) });
  }
  const ranked = [...votes].sort(([, a], [, b]) => b.count - a.count || b.best - a.best);
  if (!ranked.length || ranked[0][1].best < minConfidence) return undefined;
  const [[value, top], runnerUp] = ranked;
  if (!runnerUp || top.count > runnerUp[1].count) return value;
  return top.best - runnerUp[1].best >= DECISIVE_MARGIN ? value : undefined;
}

/** A two- or three-letter brand ("OK") says less than the company's full name. */
function informative(name: string | undefined) {
  return name && !/^[A-Za-z]{1,3}$/.test(name) ? name : undefined;
}

/**
 * Combines readings of the same image at different scales. A reading that found the big
 * headline amount is trusted for the amount; dates and numbers must agree or clearly win.
 */
export function combineReadings(readings: OcrLine[][]): OcrResult {
  const parsed = readings.map(analyse);
  const headline = parsed.filter((r) => r.headline);
  const trusted = headline.length ? headline : parsed;

  const result: OcrResult = {};
  const amountCents = pick(
    trusted.map((r) => r.amount),
    headline.length ? MIN_HEADLINE_AMOUNT_CONFIDENCE : MIN_CONFIDENCE,
  );
  if (amountCents) result.amountCents = amountCents;
  const merchant =
    pick(parsed.map((r) => r.counterparty)) ??
    informative(pick(parsed.map((r) => r.headlineName))) ??
    pick(parsed.map((r) => r.legalName)) ??
    pick(parsed.map((r) => r.headlineName));
  if (merchant) result.merchant = merchant;
  const spentOn = pick(parsed.map((r) => r.spentOn));
  if (spentOn) result.spentOn = spentOn;
  const paidAt = spentOn ? pick(parsed.filter((r) => r.spentOn?.value === spentOn).map((r) => r.paidAt)) : undefined;
  if (paidAt) result.paidAt = paidAt;
  const transactionId = pick(parsed.map((r) => r.transactionId));
  // A shop's own order number has no date to check; the platform's number must contain it.
  const platformNumber = transactionId && /^\d{28}$/.test(transactionId);
  const checked = platformNumber ? checkTransactionId(transactionId, spentOn) : transactionId;
  if (checked) result.transactionId = checked;
  return result;
}

/** Plain text as if every line were read with full confidence. For tests and simple callers. */
export function textToLines(text: string): OcrLine[] {
  return text.split(/\r?\n/).map((line) => ({ text: line, confidence: 100 }));
}

export function parseReceiptText(text: string): OcrResult {
  return combineReadings([textToLines(text)]);
}
