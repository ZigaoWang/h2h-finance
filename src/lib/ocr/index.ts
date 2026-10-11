import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import type { OcrResult } from "@/lib/db/schema";
import { combineReadings } from "./parse";

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

async function recognize(image: Buffer, width: number): Promise<string> {
  const prepared = await sharp(image).rotate().resize({ width }).greyscale().normalise().png().toBuffer();
  const w = await getWorker();
  const { data } = await w.recognize(prepared);
  return data.text;
}

// No single scale reads every screenshot: the headline amount is huge and thin and Tesseract
// can miss it at full size, while small print needs the detail. Read at two widths and combine.
async function read(image: Buffer): Promise<OcrResult> {
  const small = await recognize(image, 700);
  const large = await recognize(image, 1200);
  return combineReadings([small, large]);
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
