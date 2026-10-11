import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { sha256 } from "@/lib/auth/crypto";
import { db, files, type FileKind, type OcrResult } from "@/lib/db";
import { env } from "@/lib/env";
import { readReceipt } from "@/lib/ocr";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 2400;
// Generous for any phone photo, small enough that a crafted image can't exhaust memory.
const MAX_INPUT_PIXELS = 80_000_000;
const THUMB_WIDTH = 480;
// Out of 256 bits. Re-saved copies of one screenshot land well under this; different screenshots well over.
const SIMILAR_DISTANCE = 20;

export class UploadError extends Error {
  constructor(public code: "too_large" | "unsupported") {
    super(code);
  }
}

export type DuplicateReason = "exact" | "transaction" | "similar";
export type Duplicate = { fileId: string; expenseId: number | null; reimbursementId: number | null; reason: DuplicateReason };

export type ProcessedUpload = { id: string; ocr: OcrResult; duplicate: Duplicate | null };

function filePath(id: string, variant: "full" | "thumb") {
  return path.join(env.DATA_DIR, "files", id.slice(0, 2), variant === "full" ? `${id}.jpg` : `${id}.thumb.webp`);
}

export function readStoredFile(id: string, variant: "full" | "thumb") {
  return fs.readFile(filePath(id, variant));
}

/** 256-bit difference hash: survives recompression and resizing, not real edits. */
async function differenceHash(image: Buffer): Promise<string> {
  const { data } = await sharp(image).rotate().greyscale().resize(17, 16, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      bits += data[row * 17 + col] > data[row * 17 + col + 1] ? "1" : "0";
    }
  }
  return bits.match(/.{4}/g)!.map((nibble) => parseInt(nibble, 2).toString(16)).join("");
}

function hammingDistance(a: string, b: string): number {
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/**
 * Finds an earlier, submitted copy of this image. Uploads that were never attached to anything
 * (an abandoned form) don't count, so retrying a submission isn't flagged.
 */
function findDuplicate(kind: FileKind, hash: string, dhash: string, ocr: OcrResult): Duplicate | null {
  const candidates = db
    .select({
      id: files.id,
      sha256: files.sha256,
      dhash: files.dhash,
      ocr: files.ocr,
      expenseId: files.expenseId,
      reimbursementId: files.reimbursementId,
    })
    .from(files)
    .where(and(eq(files.kind, kind), or(isNotNull(files.expenseId), isNotNull(files.reimbursementId))))
    .all();

  const match = (c: (typeof candidates)[number], reason: DuplicateReason): Duplicate => ({
    fileId: c.id,
    expenseId: c.expenseId,
    reimbursementId: c.reimbursementId,
    reason,
  });

  const exact = candidates.find((c) => c.sha256 === hash);
  if (exact) return match(exact, "exact");

  // A different screenshot of the same payment, e.g. the bill and the payment-success screen.
  const sameTransaction = ocr.transactionId && candidates.find((c) => c.ocr?.transactionId === ocr.transactionId);
  if (sameTransaction) return match(sameTransaction, "transaction");

  // Visual similarity alone could match two bills from the same app, so the amount must agree too.
  const similar = candidates.find(
    (c) =>
      hammingDistance(c.dhash, dhash) <= SIMILAR_DISTANCE &&
      ocr.amountCents !== undefined &&
      c.ocr?.amountCents === ocr.amountCents,
  );
  return similar ? match(similar, "similar") : null;
}

export async function processUpload(input: Buffer, ownerId: number, kind: FileKind): Promise<ProcessedUpload> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("too_large");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new UploadError("unsupported");
  }
  if (!meta.format || !["jpeg", "png", "webp", "heif", "gif", "tiff"].includes(meta.format)) {
    throw new UploadError("unsupported");
  }

  // Normalise: apply camera rotation, drop metadata (including location), cap the size.
  let full: { data: Buffer; info: OutputInfo };
  try {
    full = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError("unsupported");
  }
  const thumb = await sharp(full.data).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();

  const hash = sha256(input);
  const [dhash, ocr] = await Promise.all([differenceHash(full.data), readReceipt(full.data)]);
  const duplicate = findDuplicate(kind, hash, dhash, ocr);

  const id = randomUUID();
  await fs.mkdir(path.dirname(filePath(id, "full")), { recursive: true });
  await fs.writeFile(filePath(id, "full"), full.data);
  await fs.writeFile(filePath(id, "thumb"), thumb);

  db.insert(files)
    .values({
      id,
      ownerId,
      kind,
      size: full.data.byteLength,
      width: full.info.width,
      height: full.info.height,
      sha256: hash,
      dhash,
      duplicateOfId: duplicate?.fileId ?? null,
      ocr,
    })
    .run();

  return { id, ocr, duplicate };
}

/** Removes uploads that were never attached to an expense or reimbursement within a day. */
export async function sweepAbandonedUploads() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const abandoned = db
    .select({ id: files.id })
    .from(files)
    .where(and(isNull(files.expenseId), isNull(files.reimbursementId), lt(files.createdAt, cutoff)))
    .all();
  for (const { id } of abandoned) {
    db.delete(files).where(eq(files.id, id)).run();
    await Promise.all([fs.rm(filePath(id, "full"), { force: true }), fs.rm(filePath(id, "thumb"), { force: true })]);
  }
}
