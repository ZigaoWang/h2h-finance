import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/dal";
import { budgetYears, db } from "@/lib/db";
import { buildYearEndPack } from "@/lib/export";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return new Response("Not found", { status: 404 });

  const id = Number(new URL(request.url).searchParams.get("year"));
  const year = Number.isSafeInteger(id) ? db.select().from(budgetYears).where(eq(budgetYears.id, id)).get() : undefined;
  if (!year) return new Response("Not found", { status: 404 });

  const { name, stream } = await buildYearEndPack(year, await getLocale());
  audit(db, { actorId: user.id, action: "export.downloaded", entity: "year", entityId: year.id });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="h2h-finance.zip"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
