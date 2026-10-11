-- Expenses are now recorded as soon as they're submitted; there is no review step.
-- Anything waiting for review counts from now on, and rejected expenses become deleted ones,
-- keeping who rejected them and why. The revision triggers keep the earlier state.
UPDATE expenses
SET status = 'voided',
    voided_at = coalesce(reviewed_at, unixepoch('subsec') * 1000),
    voided_by = reviewed_by,
    void_reason = coalesce(rejection_reason, 'Rejected')
WHERE status = 'rejected';
--> statement-breakpoint
UPDATE expenses SET status = 'approved' WHERE status = 'pending';
