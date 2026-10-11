import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Keyed so a copy of the database alone can't be used to brute-force live codes.
export function hashCode(email: string, code: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`${email}:${code}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
