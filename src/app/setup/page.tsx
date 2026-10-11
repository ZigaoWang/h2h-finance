import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { isSetUp } from "@/lib/auth/sign-in";
import { SetupForm } from "./setup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("setup");
  return { title: t("title") };
}

export default async function SetupPage() {
  if (isSetUp()) redirect("/login");
  return (
    <AuthShell>
      <SetupForm />
    </AuthShell>
  );
}
