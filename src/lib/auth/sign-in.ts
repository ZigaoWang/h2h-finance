import "server-only";
import { cookies } from "next/headers";
import { and, asc, count, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db, loginAttempts, users } from "@/lib/db";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { sign, unsign } from "./crypto";
import { verifyPassword } from "./password";

// Ten wrong passwords from one address locks it out for fifteen minutes.
const WINDOW = 15 * 60 * 1000;
const MAX_FAILURES = 10;
// After the password, the member has a few minutes to pick their name.
const UNLOCK_LIFETIME = 10 * 60 * 1000;
const UNLOCK_COOKIE = "h2h_unlock";
// Members can add themselves; a cap stops a leaked team password from flooding the list.
const MAX_NEW_NAMES_PER_DAY = 10;

export type Access = "member" | "admin";

export function isSetUp(): boolean {
  return !!getSetting("adminPasswordHash") && !!db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).get();
}

function isThrottled(ip: string): boolean {
  const since = new Date(Date.now() - WINDOW);
  db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))).run();
  const failures = db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)))
    .get();
  return (failures?.n ?? 0) >= MAX_FAILURES;
}

async function attempt(ip: string, check: () => Promise<Access | null>): Promise<Access | null | "throttled"> {
  if (isThrottled(ip)) return "throttled";
  const access = await check();
  db.insert(loginAttempts).values({ ip, success: !!access }).run();
  return access;
}

/** Step one: the team password lets someone in; the admin password works here too. */
export async function unlock(password: string, ip: string): Promise<Access | null | "throttled"> {
  const result = await attempt(ip, async () => {
    if (await verifyPassword(password, getSetting("adminPasswordHash"))) return "admin";
    if (await verifyPassword(password, getSetting("teamPasswordHash"))) return "member";
    return null;
  });
  if (result === "member" || result === "admin") {
    (await cookies()).set(UNLOCK_COOKIE, sign({ access: result, exp: Date.now() + UNLOCK_LIFETIME }), {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: UNLOCK_LIFETIME / 1000,
    });
  }
  return result;
}

export async function currentUnlock(): Promise<Access | null> {
  const data = unsign<{ access: Access; exp: number }>((await cookies()).get(UNLOCK_COOKIE)?.value);
  return data && data.exp > Date.now() ? data.access : null;
}

export async function clearUnlock() {
  (await cookies()).delete(UNLOCK_COOKIE);
}

/** Names to choose from, shown only after the team password. */
export function signInNames() {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(isNull(users.removedAt))
    .orderBy(asc(users.name))
    .all();
}

export type ChooseResult = { ok: true; userId: number } | { ok: false; error: "expired" | "admin_password" | "throttled" | "not_found" };

/**
 * Step two: the member picks their name. Signing in as an admin also needs the admin
 * password, unless that's what was entered in step one.
 */
export async function chooseName(userId: number, adminPassword: string, ip: string): Promise<ChooseResult> {
  const access = await currentUnlock();
  if (!access) return { ok: false, error: "expired" };
  const user = db.select().from(users).where(and(eq(users.id, userId), isNull(users.removedAt))).get();
  if (!user) return { ok: false, error: "not_found" };

  if (user.role === "admin" && access !== "admin") {
    const result = await attempt(ip, async () => ((await verifyPassword(adminPassword, getSetting("adminPasswordHash"))) ? "admin" : null));
    if (result === "throttled") return { ok: false, error: "throttled" };
    if (!result) return { ok: false, error: "admin_password" };
  }

  await clearUnlock();
  audit(db, { actorId: user.id, action: "member.signed_in", entity: "member", entityId: user.id, data: { ip } });
  return { ok: true, userId: user.id };
}

export type RegisterResult = { ok: true; userId: number } | { ok: false; error: "expired" | "invalid_name" | "name_taken" | "too_many_new" };

/** For someone not on the list yet: adds them as a member and signs them in. */
export async function registerName(rawName: string): Promise<RegisterResult> {
  if (!(await currentUnlock())) return { ok: false, error: "expired" };
  const name = rawName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: "invalid_name" };

  const existing = db.select({ id: users.id }).from(users).where(sql`lower(${users.name}) = lower(${name})`).get();
  if (existing) return { ok: false, error: "name_taken" };

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = db.select({ n: count() }).from(users).where(gt(users.createdAt, dayAgo)).get();
  if ((recent?.n ?? 0) >= MAX_NEW_NAMES_PER_DAY) return { ok: false, error: "too_many_new" };

  const userId = db.transaction((tx) => {
    const { id } = tx.insert(users).values({ name, role: "member" }).returning({ id: users.id }).get();
    audit(tx, { actorId: id, action: "member.added", entity: "member", entityId: id, data: { name, role: "member", selfAdded: true } });
    return id;
  });
  await clearUnlock();
  return { ok: true, userId };
}
