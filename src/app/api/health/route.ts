import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** For the container health check and uptime monitors. */
export function GET() {
  db.run(sql`select 1`);
  return Response.json({ ok: true });
}
