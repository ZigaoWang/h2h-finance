import "server-only";
import { auditLog, db } from "@/lib/db";

type Tx = Pick<typeof db, "insert">;

export type AuditAction =
  | "expense.submitted"
  | "expense.updated"
  | "expense.withdrawn"
  | "expense.approved"
  | "expense.rejected"
  | "expense.voided"
  | "expense.restored"
  | "reimbursement.undone"
  | "reimbursement.created"
  | "member.added"
  | "member.updated"
  | "member.removed"
  | "member.restored"
  | "member.signed_in"
  | "access.team_password_changed"
  | "access.admin_password_changed"
  | "year.saved"
  | "category.saved"
  | "event.saved"
  | "settings.updated"
  | "export.downloaded";

export function audit(
  tx: Tx,
  entry: { actorId: number | null; action: AuditAction; entity: string; entityId: string | number; data?: Record<string, unknown> },
) {
  tx.insert(auditLog)
    .values({ ...entry, entityId: String(entry.entityId) })
    .run();
}
