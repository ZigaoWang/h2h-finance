import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/dal";
import { db, expenses, files, reimbursements } from "@/lib/db";
import { readStoredFile } from "@/lib/files";

/**
 * Receipts are visible to admins and the member who uploaded them. Transfer screenshots are
 * visible to admins and the member who was paid. Everyone else gets a 404.
 */
function canView(fileId: string, user: { id: number; role: string }) {
  if (user.role === "admin") return !!db.select({ id: files.id }).from(files).where(eq(files.id, fileId)).get();
  const file = db
    .select({ ownerId: files.ownerId, expenseOwner: expenses.userId, payee: reimbursements.userId })
    .from(files)
    .leftJoin(expenses, eq(expenses.id, files.expenseId))
    .leftJoin(reimbursements, eq(reimbursements.id, files.reimbursementId))
    .where(eq(files.id, fileId))
    .get();
  return !!file && (file.ownerId === user.id || file.expenseOwner === user.id || file.payee === user.id);
}

export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !/^[0-9a-f-]{36}$/.test(id) || !canView(id, user)) {
    return new Response("Not found", { status: 404 });
  }

  const variant = new URL(request.url).searchParams.get("size") === "thumb" ? "thumb" : "full";
  const data = await readStoredFile(id, variant).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": variant === "thumb" ? "image/webp" : "image/jpeg",
      // Files never change once stored, but they're private, so only the viewer's browser may cache them.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
