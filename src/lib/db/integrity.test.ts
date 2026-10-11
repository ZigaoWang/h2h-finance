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
  it("can be edited and withdrawn", () => {
    run("update expenses set amount_cents = 3000 where id = 1");
    run("update files set expense_id = null where id = 'f1'");
    run("delete from expenses where id = 1");
    expect(sqlite.prepare("select count(*) n from expenses").get()).toEqual({ n: 0 });
  });

  it("reject zero and negative amounts", () => {
    expect(() => run("update expenses set amount_cents = 0 where id = 1")).toThrow();
  });
});

describe("approved expenses", () => {
  beforeEach(approve);

  it("can't have their details changed", () => {
    for (const change of ["amount_cents = 1", "merchant = 'x'", "spent_on = '2026-10-02'", "description = 'x'", "user_id = 1", "category_id = 1, note = 'x'"]) {
      expect(() => run(`update expenses set ${change} where id = 1`), change).toThrow(/cannot be changed/);
    }
  });

  it("can't be deleted, and neither can their receipts", () => {
    expect(() => run("delete from expenses where id = 1")).toThrow(/only pending/);
    expect(() => run("delete from files where id = 'f1'")).toThrow();
    expect(() => run("update files set expense_id = null where id = 'f1'")).toThrow();
  });

  it("can't go back to pending or rejected", () => {
    expect(() => run("update expenses set status = 'pending' where id = 1")).toThrow(/invalid status/);
    expect(() => run("update expenses set status = 'rejected' where id = 1")).toThrow(/invalid status/);
  });

  it("can be voided only with a reason, after which it's final", () => {
    expect(() => run("update expenses set status = 'voided' where id = 1")).toThrow(/invalid status/);
    run("update expenses set status = 'voided', voided_by = 1, voided_at = 1, void_reason = 'Duplicate' where id = 1");
    expect(status(1)).toBe("voided");
    expect(() => run("update expenses set status = 'approved' where id = 1")).toThrow();
    expect(() => run("update expenses set void_reason = 'x' where id = 1")).toThrow();
  });

  it("can be reimbursed, after which it's final", () => {
    expect(() => run("update expenses set status = 'reimbursed' where id = 1")).toThrow(/invalid status/);
    run("insert into reimbursements (id, user_id, amount_cents, paid_on, paid_by) values (1, 2, 2500, '2026-10-05', 1)");
    run("update expenses set status = 'reimbursed', reimbursement_id = 1 where id = 1");
    expect(status(1)).toBe("reimbursed");
    expect(() => run("update expenses set status = 'voided', voided_by = 1, voided_at = 1, void_reason = 'x' where id = 1")).toThrow();
    expect(() => run("update expenses set reimbursement_id = null where id = 1")).toThrow();
  });
});

describe("permanent records", () => {
  it("reimbursements can't be changed or deleted", () => {
    run("insert into reimbursements (id, user_id, amount_cents, paid_on, paid_by) values (1, 2, 2500, '2026-10-05', 1)");
    expect(() => run("update reimbursements set amount_cents = 1")).toThrow(/permanent/);
    expect(() => run("delete from reimbursements")).toThrow(/permanent/);
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
