import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#f7f7f6",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-center" toastOptions={{ className: "!font-sans !text-sm !rounded-md" }} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
