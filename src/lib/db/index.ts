import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

const DEFAULT_CATEGORIES: [string, string][] = [
  ["Supplies", "物资"],
  ["Food & drinks", "食品饮料"],
  ["Printing", "印刷"],
  ["Transport", "交通"],
  ["Venue & equipment", "场地与设备"],
  ["Other", "其他"],
];

function open(): DB {
  fs.mkdirSync(env.DATA_DIR, { recursive: true });
  const sqlite = new Database(path.join(env.DATA_DIR, "h2h.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  bootstrap(db);
  return db;
}

// First run: seed categories, and make sure the configured admin can always sign in.
function bootstrap(db: DB) {
  if (!db.select({ id: schema.categories.id }).from(schema.categories).limit(1).get()) {
    db.insert(schema.categories)
      .values(DEFAULT_CATEGORIES.map(([nameEn, nameZh]) => ({ nameEn, nameZh })))
      .run();
  }

  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;
  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!existing) {
    db.insert(schema.users)
      .values({ email, name: env.BOOTSTRAP_ADMIN_NAME ?? email.split("@")[0], role: "admin" })
      .run();
  } else if (existing.role !== "admin" || existing.removedAt) {
    db.update(schema.users).set({ role: "admin", removedAt: null }).where(eq(schema.users.id, existing.id)).run();
  }
}

// Opened on first use rather than at import, so `next build` never touches the database.
const globalForDb = globalThis as unknown as { h2hDb?: DB };

function instance(): DB {
  globalForDb.h2hDb ??= open();
  return globalForDb.h2hDb;
}

export const db = new Proxy({} as DB, {
  get: (_, prop) => Reflect.get(instance(), prop),
});

export * from "./schema";
