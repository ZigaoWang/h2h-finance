-- The club no longer tracks paying members back. Paid-back expenses become ordinary recorded
-- ones; the reimbursement rows and the revision history keep what happened.
DROP TRIGGER expenses_reimbursed_amount;
--> statement-breakpoint
UPDATE expenses SET status = 'approved' WHERE status = 'reimbursed';
