-- Records that matter for the year-end accounts are enforced here as well as in the app,
-- so no code path (or manual SQL session) can quietly rewrite history.

-- Once approved, an expense's details are frozen. The only allowed moves are
-- approved -> reimbursed and approved -> voided; reimbursed and voided are final.
CREATE TRIGGER expenses_locked_update
BEFORE UPDATE ON expenses
WHEN OLD.status IN ('approved', 'reimbursed', 'voided')
BEGIN
  SELECT CASE
    WHEN NEW.user_id IS NOT OLD.user_id
      OR NEW.year_id IS NOT OLD.year_id
      OR NEW.category_id IS NOT OLD.category_id
      OR NEW.event_id IS NOT OLD.event_id
      OR NEW.amount_cents IS NOT OLD.amount_cents
      OR NEW.merchant IS NOT OLD.merchant
      OR NEW.spent_on IS NOT OLD.spent_on
      OR NEW.description IS NOT OLD.description
      OR NEW.note IS NOT OLD.note
      OR NEW.reviewed_by IS NOT OLD.reviewed_by
      OR NEW.reviewed_at IS NOT OLD.reviewed_at
      OR NEW.created_at IS NOT OLD.created_at
    THEN RAISE(ABORT, 'approved expenses cannot be changed')
    WHEN OLD.status = 'approved' AND NEW.status = 'reimbursed' AND NEW.reimbursement_id IS NOT NULL
    THEN NULL
    WHEN OLD.status = 'approved' AND NEW.status = 'voided'
      AND NEW.voided_by IS NOT NULL AND NEW.voided_at IS NOT NULL AND NEW.void_reason IS NOT NULL
    THEN NULL
    WHEN NEW.status IS NOT OLD.status
      OR NEW.reimbursement_id IS NOT OLD.reimbursement_id
      OR NEW.voided_by IS NOT OLD.voided_by
      OR NEW.voided_at IS NOT OLD.voided_at
      OR NEW.void_reason IS NOT OLD.void_reason
    THEN RAISE(ABORT, 'invalid status change for an approved expense')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER expenses_locked_delete
BEFORE DELETE ON expenses
WHEN OLD.status <> 'pending'
BEGIN
  SELECT RAISE(ABORT, 'only pending expenses can be deleted');
END;
--> statement-breakpoint
-- Proof attached to a locked expense or to a reimbursement stays attached forever.
CREATE TRIGGER files_locked_update
BEFORE UPDATE ON files
WHEN OLD.reimbursement_id IS NOT NULL
  OR (OLD.expense_id IS NOT NULL
      AND (SELECT status FROM expenses WHERE id = OLD.expense_id) IN ('approved', 'reimbursed', 'voided'))
BEGIN
  SELECT RAISE(ABORT, 'proof attached to an approved expense or reimbursement cannot be changed');
END;
--> statement-breakpoint
CREATE TRIGGER files_locked_delete
BEFORE DELETE ON files
WHEN OLD.reimbursement_id IS NOT NULL
  OR (OLD.expense_id IS NOT NULL
      AND (SELECT status FROM expenses WHERE id = OLD.expense_id) <> 'pending')
BEGIN
  SELECT RAISE(ABORT, 'proof attached to a submitted expense or reimbursement cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER reimbursements_no_update
BEFORE UPDATE ON reimbursements
BEGIN
  SELECT RAISE(ABORT, 'reimbursements are permanent');
END;
--> statement-breakpoint
CREATE TRIGGER reimbursements_no_delete
BEFORE DELETE ON reimbursements
BEGIN
  SELECT RAISE(ABORT, 'reimbursements are permanent');
END;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'the audit log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'the audit log is append-only');
END;
--> statement-breakpoint
-- Removing a member must not erase what they spent.
CREATE TRIGGER users_no_delete
BEFORE DELETE ON users
BEGIN
  SELECT RAISE(ABORT, 'members are removed, never deleted');
END;
