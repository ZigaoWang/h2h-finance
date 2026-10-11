-- Approved expenses become editable by admins, but never quietly: every earlier version is
-- copied into expense_revisions by the database itself, whatever makes the change.
DROP TRIGGER expenses_locked_update;
--> statement-breakpoint
CREATE TRIGGER expenses_keep_revision
AFTER UPDATE ON expenses
BEGIN
  INSERT INTO expense_revisions (expense_id, row) VALUES (OLD.id, json_object(
    'user_id', OLD.user_id, 'year_id', OLD.year_id, 'category_id', OLD.category_id, 'event_id', OLD.event_id,
    'amount_cents', OLD.amount_cents, 'merchant', OLD.merchant, 'spent_on', OLD.spent_on,
    'description', OLD.description, 'note', OLD.note, 'status', OLD.status,
    'reviewed_by', OLD.reviewed_by, 'reviewed_at', OLD.reviewed_at, 'rejection_reason', OLD.rejection_reason,
    'reimbursement_id', OLD.reimbursement_id, 'voided_by', OLD.voided_by, 'voided_at', OLD.voided_at,
    'void_reason', OLD.void_reason, 'updated_at', OLD.updated_at, 'updated_by', OLD.updated_by
  ));
END;
--> statement-breakpoint
CREATE TRIGGER expenses_keep_deleted
BEFORE DELETE ON expenses
BEGIN
  INSERT INTO expense_revisions (expense_id, row) VALUES (OLD.id, json_object(
    'deleted', 1, 'user_id', OLD.user_id, 'amount_cents', OLD.amount_cents, 'merchant', OLD.merchant,
    'spent_on', OLD.spent_on, 'description', OLD.description, 'status', OLD.status
  ));
END;
--> statement-breakpoint
-- While a reimbursement stands, the money it paid out can't be re-attributed or changed.
CREATE TRIGGER expenses_reimbursed_amount
BEFORE UPDATE ON expenses
WHEN OLD.status = 'reimbursed' AND NEW.status = 'reimbursed'
  AND (NEW.amount_cents IS NOT OLD.amount_cents OR NEW.user_id IS NOT OLD.user_id OR NEW.reimbursement_id IS NOT OLD.reimbursement_id)
BEGIN
  SELECT RAISE(ABORT, 'undo the reimbursement before changing who was paid or how much');
END;
--> statement-breakpoint
CREATE TRIGGER expense_revisions_no_update
BEFORE UPDATE ON expense_revisions
BEGIN
  SELECT RAISE(ABORT, 'expense history is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER expense_revisions_no_delete
BEFORE DELETE ON expense_revisions
BEGIN
  SELECT RAISE(ABORT, 'expense history is append-only');
END;
--> statement-breakpoint
-- A reimbursement can be undone once, with who and why; nothing else about it ever changes.
DROP TRIGGER reimbursements_no_update;
--> statement-breakpoint
CREATE TRIGGER reimbursements_undo_only
BEFORE UPDATE ON reimbursements
WHEN OLD.undone_at IS NOT NULL
  OR NEW.undone_at IS NULL OR NEW.undone_by IS NULL OR NEW.undo_reason IS NULL
  OR NEW.user_id IS NOT OLD.user_id OR NEW.amount_cents IS NOT OLD.amount_cents
  OR NEW.paid_on IS NOT OLD.paid_on OR NEW.note IS NOT OLD.note OR NEW.paid_by IS NOT OLD.paid_by
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'a reimbursement can only be undone, once, with a reason');
END;
