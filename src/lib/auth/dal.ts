import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

export type { SessionUser };
export { getSessionUser };

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  // Admin pages simply don't exist for members.
  if (user.role !== "admin") notFound();
  return user;
}
