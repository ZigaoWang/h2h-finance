import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { TIME_ZONE } from "@/lib/dates";
import { isLocale, LOCALE_COOKIE, type Locale } from "./config";

async function resolveLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accepted = (await headers()).get("accept-language") ?? "";
  return /^zh\b/i.test(accepted.trim()) ? "zh" : "en";
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    timeZone: TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
