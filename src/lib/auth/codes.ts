import "server-only";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { db, loginCodes, users } from "@/lib/db";
import { sendMail, signInCodeMail } from "@/lib/email";
import { hashCode, randomCode, safeEqual } from "./crypto";

const MINUTE = 60 * 1000;
const CODE_LIFETIME = 10 * MINUTE;
const RESEND_COOLDOWN = MINUTE;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
const MAX_CODES_PER_IP_PER_HOUR = 20;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type RequestCodeResult = "sent" | "rate_limited";

/**
 * Emails a sign-in code if the address belongs to an active member. The result is the
 * same whether or not the address is invited, so the form can't be used to probe who's a member.
 */
export async function requestCode(email: string, ip: string | null, locale: "en" | "zh"): Promise<RequestCodeResult> {
  const hourAgo = new Date(Date.now() - 60 * MINUTE);

  if (ip) {
    const byIp = db
      .select({ n: count() })
      .from(loginCodes)
      .where(and(eq(loginCodes.ip, ip), gt(loginCodes.createdAt, hourAgo)))
      .get();
    if ((byIp?.n ?? 0) >= MAX_CODES_PER_IP_PER_HOUR) return "rate_limited";
  }

  const recent = db
    .select({ createdAt: loginCodes.createdAt })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gt(loginCodes.createdAt, hourAgo)))
    .orderBy(desc(loginCodes.createdAt))
    .all();
  if (recent.length >= MAX_CODES_PER_EMAIL_PER_HOUR) return "rate_limited";
  // A code was just sent; don't send another, the first one still works.
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN) return "sent";

  const member = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.removedAt)))
    .get();

  const code = randomCode();
  // Record the request even for unknown addresses so they count towards the limits.
  db.insert(loginCodes)
    .values({
      email,
      ip,
      codeHash: member ? hashCode(email, code) : "",
      expiresAt: new Date(Date.now() + CODE_LIFETIME),
      usedAt: member ? null : new Date(),
    })
    .run();

  if (member) await sendMail(signInCodeMail(email, code, locale));
  return "sent";
}

/** Checks a code and returns the member's id if it's valid. Each code allows five tries. */
export function verifyCode(email: string, code: string): number | null {
  const now = new Date();
  const latest = db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt), gt(loginCodes.expiresAt, now)))
    .orderBy(desc(loginCodes.createdAt))
    .get();
  if (!latest || latest.attempts >= MAX_ATTEMPTS) return null;

  if (!safeEqual(latest.codeHash, hashCode(email, code))) {
    db.update(loginCodes)
      .set({ attempts: latest.attempts + 1 })
      .where(eq(loginCodes.id, latest.id))
      .run();
    return null;
  }

  db.update(loginCodes).set({ usedAt: now }).where(eq(loginCodes.id, latest.id)).run();
  const member = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.removedAt)))
    .get();
  return member?.id ?? null;
}
