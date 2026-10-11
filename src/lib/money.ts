// All amounts are stored as integer fen (cents) to avoid floating-point drift.

const grouped = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}¥${grouped.format(Math.abs(cents) / 100)}`;
}

/** Plain decimal for form inputs and spreadsheets, e.g. 1234.5 -> "1234.50". */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Parses user input like "25", "25.5", "¥1,234.50". Returns null unless it's a positive amount. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[¥￥,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
