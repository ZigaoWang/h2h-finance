import { NextResponse } from "next/server";
import { and, count, eq, gt } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/dal";
import { db, expenses, files, type OcrResult } from "@/lib/db";
import { MAX_UPLOAD_BYTES, processUpload, sweepAbandonedUploads, UploadError, type DuplicateReason } from "@/lib/files";

const MAX_UPLOADS_PER_HOUR = 100;

export type UploadResponse =
  | {
      ok: true;
      id: string;
      ocr: OcrResult;
      // Members only learn which expense it was when the earlier copy is their own.
      duplicate: { reason: DuplicateReason; expenseId: number | null } | null;
    }
  | { ok: false; error: "unauthorized" | "too_large" | "unsupported" | "rate_limited" };

function fail(error: Extract<UploadResponse, { ok: false }>["error"], status: number) {
  return NextResponse.json<UploadResponse>({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized", 401);

  const kind = new URL(request.url).searchParams.get("kind") === "transfer" ? "transfer" : "receipt";
  if (kind === "transfer" && user.role !== "admin") return fail("unauthorized", 403);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return fail("too_large", 413);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = db
    .select({ n: count() })
    .from(files)
    .where(and(eq(files.ownerId, user.id), gt(files.createdAt, hourAgo)))
    .get();
  if ((recent?.n ?? 0) >= MAX_UPLOADS_PER_HOUR) return fail("rate_limited", 429);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("unsupported", 400);
  if (file.size > MAX_UPLOAD_BYTES) return fail("too_large", 413);

  try {
    const result = await processUpload(Buffer.from(await file.arrayBuffer()), user.id, kind);
    void sweepAbandonedUploads().catch((error) => console.error("Upload sweep failed", error));

    let duplicate = null;
    if (result.duplicate) {
      const owner = result.duplicate.expenseId
        ? db.select({ userId: expenses.userId }).from(expenses).where(eq(expenses.id, result.duplicate.expenseId)).get()
        : undefined;
      const visible = user.role === "admin" || owner?.userId === user.id;
      duplicate = { reason: result.duplicate.reason, expenseId: visible ? result.duplicate.expenseId : null };
    }
    return NextResponse.json<UploadResponse>({ ok: true, id: result.id, ocr: result.ocr, duplicate });
  } catch (error) {
    if (error instanceof UploadError) return fail(error.code, error.code === "too_large" ? 413 : 415);
    throw error;
  }
}
