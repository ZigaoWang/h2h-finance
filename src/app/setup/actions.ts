"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isSetUp } from "@/lib/auth/sign-in";
import { db, users } from "@/lib/db";
import { setSetting } from "@/lib/settings";

export type SetupState = { error?: "name" | "admin_password" | "team_password" | "same_password" };

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  adminPassword: z.string().min(8).max(200),
  teamPassword: z.string().min(6).max(200),
});

/** First run only: creates the first admin and both passwords. */
export async function setUp(_: SetupState, formData: FormData): Promise<SetupState> {
  if (isSetUp()) redirect("/login");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "name" ? "name" : field === "adminPassword" ? "admin_password" : "team_password" };
  }
  const { name, adminPassword, teamPassword } = parsed.data;
  if (adminPassword === teamPassword) return { error: "same_password" };

  const [adminHash, teamHash] = await Promise.all([hashPassword(adminPassword), hashPassword(teamPassword)]);
  const userId = db.transaction((tx) => {
    const { id } = tx.insert(users).values({ name, role: "admin" }).returning({ id: users.id }).get();
    audit(tx, { actorId: id, action: "member.added", entity: "member", entityId: id, data: { name, role: "admin", setup: true } });
    return id;
  });
  setSetting("adminPasswordHash", adminHash);
  setSetting("teamPasswordHash", teamHash);
  await createSession(userId);
  redirect("/admin");
}
