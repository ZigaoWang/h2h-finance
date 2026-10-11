import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { db, sessions, users } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "./crypto";

const COOKIE = "h2h_session";
const DAY = 24 * 60 * 60 * 1000;
// Members sign in once per device; sessions end after 90 idle days. The cookie lives longer so the server decides.
const IDLE_LIFETIME = 90 * DAY;
const COOKIE_LIFETIME = 400 * DAY;

export type SessionUser = {
  id: number;
  name: string;
  role: "member" | "admin";
};

export async function createSession(userId: number) {
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
  const token = randomToken();
  db.insert(sessions)
    .values({ id: sha256(token), userId, expiresAt: new Date(Date.now() + IDLE_LIFETIME) })
    .run();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_LIFETIME / 1000,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) db.delete(sessions).where(eq(sessions.id, sha256(token))).run();
  store.delete(COOKIE);
}

export function revokeSessions(userId: number) {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

/** Signs out everyone except one person, e.g. after the team password changes. */
export function revokeAllSessionsExcept(userId: number) {
  db.delete(sessions).where(ne(sessions.userId, userId)).run();
}

/** The signed-in user for this request, or null. Removed members are signed out immediately. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const id = sha256(token);
  const now = new Date();
  const row = db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now), isNull(users.removedAt)))
    .get();
  if (!row) return null;

  // Slide the idle window at most once a day to keep writes rare.
  if (row.expiresAt.getTime() - now.getTime() < IDLE_LIFETIME - DAY) {
    db.update(sessions)
      .set({ expiresAt: new Date(now.getTime() + IDLE_LIFETIME) })
      .where(eq(sessions.id, id))
      .run();
  }

  return { id: row.id, name: row.name, role: row.role };
});
