"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { normalizeEmail, requestCode, verifyCode } from "@/lib/auth/codes";
import { createSession, destroySession } from "@/lib/auth/session";
import { clientIp } from "@/lib/request";

export type LoginState =
  | { step: "email"; error?: "invalid_email" | "rate_limited" | "send_failed"; email?: string }
  | { step: "code"; email: string; error?: "invalid_code"; resent?: boolean };

const emailSchema = z.email().max(254);

export async function login(state: LoginState, formData: FormData): Promise<LoginState> {
  switch (formData.get("intent")) {
    case "verify":
      return checkCode(formData);
    case "change-email":
      return { step: "email", email: state.email };
    default:
      return sendCode(formData, state.step === "code");
  }
}

async function sendCode(formData: FormData, resend: boolean): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!emailSchema.safeParse(email).success) return { step: "email", error: "invalid_email", email };

  try {
    const result = await requestCode(email, await clientIp(), await getLocale());
    if (result === "rate_limited") return { step: "email", error: "rate_limited", email };
  } catch (error) {
    console.error("Failed to send sign-in code", error);
    return { step: "email", error: "send_failed", email };
  }
  return { step: "code", email, resent: resend };
}

async function checkCode(formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const userId = code.length === 6 ? verifyCode(email, code) : null;
  if (!userId) return { step: "code", email, error: "invalid_code" };

  await createSession(userId);
  redirect("/");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}
