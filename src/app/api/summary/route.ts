import { isPublicPageEnabled } from "@/lib/settings";
import { yearSummary } from "@/lib/stats";
import { selectYear } from "@/lib/years";

// The club's website shows these figures on its home page.
const ALLOWED_ORIGINS = new Set(["https://h2h.ykps.net"]);

/** This year's headline figures, as shown on the public page. Nothing about people. */
export function GET(request: Request) {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = { "Cache-Control": "public, max-age=300", Vary: "Origin" };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;

  const year = isPublicPageEnabled() ? selectYear(undefined) : undefined;
  if (!year) return Response.json({ year: null }, { headers });

  const summary = yearSummary(year, { includePeople: false });
  return Response.json(
    {
      year: { label: year.label, startsOn: summary.startsOn, endsOn: summary.endsOn },
      budgetCents: summary.budgetCents,
      spentCents: summary.spent.cents,
      expenseCount: summary.spent.count,
      remainingCents: summary.remainingCents,
    },
    { headers },
  );
}
