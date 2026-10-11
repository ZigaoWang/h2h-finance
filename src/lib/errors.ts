// Expected failures carry a code the UI translates; anything else is a bug and is logged.
export type ErrorCode =
  | "not_found"
  | "not_allowed"
  | "invalid"
  | "rate_limited"
  | "no_year"
  | "locked"
  | "file_missing"
  | "inactive_option"
  | "name_taken"
  | "wrong_password"
  | "same_password"
  | "last_admin"
  | "overlapping_year"
  | "nothing_selected"
  | "undo_reimbursement_first"
  | "in_use";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ErrorCode; detail?: string };

/** Runs a mutation and turns expected failures into a result the client can show. */
export async function run<T>(fn: () => T | Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.code, detail: error.detail };
    throw error;
  }
}
