import "server-only";
import { headers } from "next/headers";

/** The client IP as reported by the reverse proxy in front of the app. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || null;
}
