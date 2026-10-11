import "server-only";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATA_DIR: z.string().default("./data"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  BOOTSTRAP_ADMIN_EMAIL: z.email().optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("H2H Finance <finance@h2h.ykps.net>"),
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
  const env = parsed.data;
  if (env.NODE_ENV === "production" && !building && !env.SMTP_HOST) {
    throw new Error("SMTP_HOST is required in production so sign-in codes can be emailed");
  }
  return { ...env, DATA_DIR: path.resolve(env.DATA_DIR) };
}

export const env = load();
