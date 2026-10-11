import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import type { OcrResult } from "@/lib/db/schema";
import { checkTransactionId, combineReadings, TRANSACTION_ROW, type OcrLine } from "./parse";

// English first: tesseract.js fails to load the second language when chi_sim leads.
const LANGUAGES = ["eng", "chi_sim"];
const TIMEOUT = 30_000;

// Language data ships with the app (see outputFileTracingIncludes), so OCR never needs the network.
// Tesseract reads every language from one directory, so the bundled files are staged together.
async function stageLanguageData() {
  const dir = path.join(os.tmpdir(), "h2h-tessdata");
  await fs.mkdir(dir, { recursive: true });
  for (const code of LANGUAGES) {
    const file = `${code}.traineddata.gz`;
    await fs.copyFile(path.join(process.cwd(), "node_modules/@tesseract.js-data", code, "4.0.0_best_int", file), path.join(dir, file));
  }
  return dir;
}

let worker: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getWorker() {
  worker ??= (async () => {
    const langPath = await stageLanguageData();
    const w = await createWorker(LANGUAGES, OEM.LSTM_ONLY, { langPath, gzip: true, cacheMethod: "none" });
    // Payment screenshots are one column of label/value rows with a large amount near the top.
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, preserve_interword_spaces: "1" });
    return w;
  })().catch((error) => {
    worker = null;
    throw error;
  });
  return worker;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
type BoxedLine = OcrLine & { bbox: Box; words: { text: string; bbox: Box }[] };
type Reading = { lines: BoxedLine[]; scale: number };

async function recognize(image: Buffer, width: number, originalWidth: number): Promise<Reading> {
  const prepared = await sharp(image).resize({ width }).greyscale().normalise().png().toBuffer();
  const w = await getWorker();
  const { data } = await w.recognize(prepared, {}, { blocks: true });
  // Each line keeps Tesseract's confidence, so garbled reads can be told apart from clean ones,
  // and its position, so a row can be looked at again more closely.
  const lines = (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => ({
        text: line.text,
        confidence: line.confidence,
        bbox: line.bbox,
        words: line.words.map((word) => ({ text: word.text, bbox: word.bbox })),
      })),
    ),
  );
  return { lines, scale: originalWidth / width };
}

/**
 * Alipay wraps its 28-digit transaction number onto a second line and general OCR often loses
 * a digit there. Re-read just that row, digits only, from the original image.
 */
async function rereadTransactionRow(image: Buffer, readings: Reading[], width: number, height: number): Promise<string | undefined> {
  for (const { lines, scale } of [...readings].reverse()) {
    const row = lines.find((line) => TRANSACTION_ROW.test(line.text.replace(/\s+/g, "")));
    if (!row) continue;
    // The number starts after the label; the label ends at the word containing 号.
    const labelEnd = row.words.find((word) => word.text.includes("号"))?.bbox.x1 ?? row.bbox.x0 + (row.bbox.x1 - row.bbox.x0) * 0.25;
    const lineHeight = (row.bbox.y1 - row.bbox.y0) * scale;
    const left = Math.round(labelEnd * scale + 4);
    const top = Math.max(0, Math.round(row.bbox.y0 * scale - lineHeight * 0.3));
    const bottom = Math.min(height, Math.round(row.bbox.y1 * scale + lineHeight * 1.6));
    if (left >= width - 10 || bottom - top < 8) continue;

    const crop = await sharp(image)
      .extract({ left, top, width: width - left, height: bottom - top })
      .resize({ height: Math.round(((bottom - top) / lineHeight) * 48) })
      .greyscale()
      .normalise()
      .png()
      .toBuffer();
    const w = await getWorker();
    await w.setParameters({ tessedit_char_whitelist: "0123456789", tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    try {
      const { data } = await w.recognize(crop);
      // The crop can reach the next row's number; keep the first line and its short wrapped tail.
      const [first = "", second = ""] = data.text.split("\n").map((line) => line.replace(/\D/g, "")).filter(Boolean);
      return second.length <= 6 ? first + second : first;
    } finally {
      await w.setParameters({ tessedit_char_whitelist: "", tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    }
  }
  return undefined;
}

// No single scale reads every screenshot: the headline amount is huge and thin and Tesseract
// can miss it at full size, while small print needs the detail. Three widths let the
// readings outvote a single misread.
async function read(input: Buffer): Promise<OcrResult> {
  const image = await sharp(input).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(image).metadata();
  const readings: Reading[] = [];
  for (const target of [700, 950, 1200]) readings.push(await recognize(image, target, width));
  const result = combineReadings(readings.map((r) => r.lines));

  if (!result.transactionId && result.spentOn) {
    const digits = await rereadTransactionRow(image, readings, width, height);
    const checked = checkTransactionId(digits, result.spentOn);
    if (checked) result.transactionId = checked;
  }
  return result;
}

/** Best-effort: reads amount, merchant and date from a payment screenshot. Never throws. */
export function readReceipt(image: Buffer): Promise<OcrResult> {
  // One recognition at a time keeps memory flat on a small server.
  const job = queue.then(() =>
    Promise.race([
      read(image),
      new Promise<OcrResult>((resolve) => setTimeout(() => resolve({}), TIMEOUT)),
    ]),
  );
  queue = job.catch(() => undefined);
  return job.catch((error) => {
    console.error("OCR failed", error);
    return {};
  });
}
