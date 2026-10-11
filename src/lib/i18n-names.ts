/** Picks the Chinese name in Chinese, falling back to English when it's missing. */
export function localName(locale: string, en: string | null, zh: string | null): string {
  return (locale === "zh" ? zh || en : en || zh) ?? "";
}
