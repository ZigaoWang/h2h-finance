import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeEach, describe, expect, it } from "vitest";

// The triggers in drizzle/0001_integrity.sql are the last line of defence for the accounts,
// so they're tested directly against SQL, the way a careless script or manual session would hit them.

let sqlite: Database.Database;
const run = (sql: string) => sqlite.prepare(sql).run();
const status = (id: number) => (sqlite.prepare("select status from expenses where id = ?").get(id) as { status: string }).status;

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  migrate(drizzle(sqlite), { migrationsFolder: path.join(import.meta.dirname, "../../../drizzle") });
  run("insert into users (id, name, role) values (1, 'Admin', 'admin'), (2, 'Member', 'member')");
  run("insert into budget_years (id, label, starts_on, ends_on, budget_cents) values (1, '2026–27', '2026-09-01', '2027-08-31', 100000)");
  run("insert into categories (id, name_en, name_zh) values (1, 'Supplies', '物资')");
  run(`insert into expenses (id, user_id, year_id, category_id, amount_cents, merchant, spent_on, description)
       values (1, 2, 1, 1, 2500, 'Shop', '2026-10-01', 'Flour')`);
  run(`insert into files (id, owner_id, kind, size, width, height, sha256, dhash, expense_id)
       values ('f1', 2, 'receipt', 1, 1, 1, 'h', 'd', 1)`);
});

const approve = () => run("update expenses set status = 'approved', reviewed_by = 1, reviewed_at = 1 where id = 1");

describe("pending expenses", () => {
  it("can be edited and withdrawn, leaving a copy of what was deleted", () => {
    run("update expenses set amount_cents = 3000 where id = 1");
    run("update files set expense_id = null where id = 'f1'");
    run("delete from expenses where id = 1");
    expect(sqlite.prepare("select count(*) n from expenses").get()).toEqual({ n: 0 });
    const last = sqlite.prepare("select row from expense_revisions where expense_id = 1 order by id desc").get() as { row: string };
    expect(JSON.parse(last.row)).toMatchObject({ deleted: 1, amount_cents: 3000 });
  });

  it("reject zero and negative amounts", () => {
    expect(() => run("update expenses set amount_cents = 0 where id = 1")).toThrow();
  });
});

const revisions = () => (sqlite.prepare("select count(*) n from expense_revisions where expense_id = 1").get() as { n: number }).n;

describe("approved expenses", () => {
  beforeEach(approve);

  it("can be edited, and every earlier version is kept", () => {
    const before = revisions();
    run("update expenses set amount_cents = 3000, updated_by = 1 where id = 1");
    expect(revisions()).toBe(before + 1);
    const last = sqlite.prepare("select row from expense_revisions where expense_id = 1 order by id desc").get() as { row: string };
    expect(JSON.parse(last.row)).toMatchObject({ amount_cents: 2500, status: "approved" });
  });

  it("can't be hard-deleted, and neither can their receipts", () => {
    expect(() => run("delete from expenses where id = 1")).toThrow(/only pending/);
    expect(() => run("delete from files where id = 'f1'")).toThrow();
    expect(() => run("update files set expense_id = null where id = 'f1'")).toThrow();
  });

  it("keep their history even when deleted by marking", () => {
    run("update expenses set status = 'voided', voided_by = 1, voided_at = 1, void_reason = 'Duplicate' where id = 1");
    const last = sqlite.prepare("select row from expense_revisions where expense_id = 1 order by id desc").get() as { row: string };
    expect(JSON.parse(last.row)).toMatchObject({ status: "approved" });
  });
});

// Paying back is no longer tracked, but past reimbursement records keep their rules.
describe("past reimbursements", () => {
  beforeEach(() => {
    approve();
    run("insert into reimbursements (id, user_id, amount_cents, paid_on, paid_by) values (1, 2, 2500, '2026-10-05', 1)");
    run("update expenses set status = 'reimbursed', reimbursement_id = 1 where id = 1");
  });

  it("go back to approved when the reimbursement is undone, once, with a reason", () => {
    expect(() => run("update reimbursements set undone_at = 1 where id = 1")).toThrow(/undone once with a reason/);
    run("update reimbursements set undone_at = 1, undone_by = 1, undo_reason = 'Wrong person' where id = 1");
    run("update expenses set status = 'approved', reimbursement_id = null where id = 1");
    expect(status(1)).toBe("approved");
    expect(() => run("update reimbursements set undo_reason = 'x' where id = 1")).toThrow(/undone once with a reason/);
  });
});

describe("permanent records", () => {
  it("reimbursements can have their date and note corrected, but not their amount, and are never deleted", () => {
    run("insert into reimbursements (id, user_id, amount_cents, paid_on, paid_by) values (1, 2, 2500, '2026-10-05', 1)");
    run("update reimbursements set paid_on = '2026-10-06', note = 'Cash' where id = 1");
    expect(() => run("update reimbursements set amount_cents = 1")).toThrow(/only the date and note/);
    expect(() => run("update reimbursements set user_id = 1")).toThrow(/only the date and note/);
    expect(() => run("delete from reimbursements")).toThrow(/permanent/);
  });

  it("expense history can't be edited or deleted", () => {
    run("update expenses set description = 'x' where id = 1");
    expect(() => run("update expense_revisions set row = '{}'")).toThrow(/append-only/);
    expect(() => run("delete from expense_revisions")).toThrow(/append-only/);
  });

  it("the audit log is append-only", () => {
    run("insert into audit_log (action, entity, entity_id) values ('expense.approved', 'expense', '1')");
    expect(() => run("update audit_log set action = 'x'")).toThrow(/append-only/);
    expect(() => run("delete from audit_log")).toThrow(/append-only/);
  });

  it("members are never deleted", () => {
    expect(() => run("delete from users where id = 2")).toThrow(/never deleted/);
  });
});
