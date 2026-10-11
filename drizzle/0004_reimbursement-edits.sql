-- Admins can correct a reimbursement's date and note, or undo it once with a reason.
-- Who was paid, how much, and by whom never change.
DROP TRIGGER reimbursements_undo_only;
--> statement-breakpoint
CREATE TRIGGER reimbursements_guard
BEFORE UPDATE ON reimbursements
WHEN OLD.undone_at IS NOT NULL
  OR NEW.user_id IS NOT OLD.user_id OR NEW.amount_cents IS NOT OLD.amount_cents
  OR NEW.paid_by IS NOT OLD.paid_by OR NEW.created_at IS NOT OLD.created_at
  OR (NEW.undone_at IS NOT NULL AND (NEW.undone_by IS NULL OR NEW.undo_reason IS NULL))
BEGIN
  SELECT RAISE(ABORT, 'only the date and note of a reimbursement can change, or it can be undone once with a reason');
END;
