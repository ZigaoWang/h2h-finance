import type { UploadResponse } from "@/app/api/uploads/route";

export type UploadResult = Extract<UploadResponse, { ok: true }>;
export type UploadFailure = Extract<UploadResponse, { ok: false }>["error"] | "network";

export async function uploadImage(file: File, kind: "receipt" | "transfer"): Promise<UploadResult | UploadFailure> {
  const body = new FormData();
  body.set("file", file);
  try {
    const response = await fetch(`/api/uploads?kind=${kind}`, { method: "POST", body });
    const data = (await response.json()) as UploadResponse;
    return data.ok ? data : data.error;
  } catch {
    return "network";
  }
}

/** Runs async work over a list with at most `limit` in flight, so a phone on 4G isn't swamped. */
export async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}
