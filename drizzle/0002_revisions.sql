CREATE TABLE `expense_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expense_id` integer NOT NULL,
	`row` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expense_revisions_expense_idx` ON `expense_revisions` (`expense_id`);--> statement-breakpoint
ALTER TABLE `expenses` ADD `updated_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `reimbursements` ADD `undone_at` integer;--> statement-breakpoint
ALTER TABLE `reimbursements` ADD `undone_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `reimbursements` ADD `undo_reason` text;