import "server-only";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATA_DIR: z.string().default("./data"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
});

function load() {
  const raw = { ...process.env };
  const building = raw.NEXT_PHASE === "phase-production-build";
  // Development and builds work out of the box; a running production server must provide a real secret.
  if ((raw.NODE_ENV !== "production" || building) && !raw.AUTH_SECRET) {
    raw.AUTH_SECRET = "development-only-secret-do-not-use-in-production";
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return { ...parsed.data, DATA_DIR: path.resolve(parsed.data.DATA_DIR) };
}

export const env = load();
