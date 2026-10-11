import "server-only";
import { refresh } from "next/cache";
import { run, type ActionResult } from "@/lib/errors";

/** For server actions: runs the change, then refreshes the page so it shows the new data. */
export async function mutate<T>(fn: () => T | Promise<T>): Promise<ActionResult<T>> {
  const result = await run(fn);
  if (result.ok) refresh();
  return result;
}
