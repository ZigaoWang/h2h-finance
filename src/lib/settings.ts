import "server-only";
import { eq } from "drizzle-orm";
import { db, settings } from "@/lib/db";

const DEFAULTS = {
  publicPage: "off",
};

type Key = keyof typeof DEFAULTS;

export function getSetting(key: Key): string {
  return db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()?.value ?? DEFAULTS[key];
}

export function setSetting(key: Key, value: string) {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function isPublicPageEnabled() {
  return getSetting("publicPage") === "on";
}
