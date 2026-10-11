import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/auth/dal";
import { isSetUp } from "@/lib/auth/sign-in";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage() {
  if (!isSetUp()) redirect("/setup");
  if (await getSessionUser()) redirect("/dashboard");
  const t = await getTranslations("login");

  return (
    <AuthShell>
      <LoginForm />
      <p className="mt-8 border-t border-line pt-6 text-[13px] leading-relaxed text-muted">{t("membersOnly")}</p>
    </AuthShell>
  );
}
