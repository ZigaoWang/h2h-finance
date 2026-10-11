import "server-only";
import { and, count, eq, isNull, max, min, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeAllSessionsExcept, revokeSessions } from "@/lib/auth/session";
import { budgetYears, categories, db, events, expenses, sessions, users, ROLES } from "@/lib/db";
import { isIsoDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { parseMoney } from "@/lib/money";
import { getSetting, setSetting } from "@/lib/settings";

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("invalid", result.error.issues[0]?.path.join("."));
  return result.data;
}

const id = z.coerce.number().int().positive();
const optionalId = z.preprocess((v) => (v === "" || v == null ? undefined : v), id.optional());
const name = z.string().trim().min(1).max(80);
const isoDate = z.string().refine(isIsoDate);

// Budget years ---------------------------------------------------------------

const yearSchema = z
  .object({
    id: optionalId,
    label: z.string().trim().min(1).max(40),
    startsOn: isoDate,
    endsOn: isoDate,
    budget: z.string().transform((v, ctx) => {
      const cents = v.trim() === "0" ? 0 : parseMoney(v);
      return cents ?? (ctx.addIssue({ code: "custom" }), z.NEVER);
    }),
  })
  .refine((y) => y.startsOn <= y.endsOn, { path: ["endsOn"] });

export function saveYear(admin: SessionUser, input: unknown) {
  const data = parse(yearSchema, input);

  const overlapping = db
    .select({ id: budgetYears.id })
    .from(budgetYears)
    .where(
      and(
        data.id ? ne(budgetYears.id, data.id) : undefined,
        sql`${budgetYears.startsOn} <= ${data.endsOn} and ${budgetYears.endsOn} >= ${data.startsOn}`,
      ),
    )
    .get();
  if (overlapping) throw new AppError("overlapping_year");

  if (data.id) {
    const before = db.select().from(budgetYears).where(eq(budgetYears.id, data.id)).get();
    if (!before) throw new AppError("not_found");
    // Dates can move, but never so far that existing expenses fall outside the year.
    const range = db
      .select({ first: min(expenses.spentOn), last: max(expenses.spentOn) })
      .from(expenses)
      .where(eq(expenses.yearId, data.id))
      .get();
    if ((range?.first && range.first < data.startsOn) || (range?.last && range.last > data.endsOn)) {
      throw new AppError("invalid", "range");
    }
    db.transaction((tx) => {
      tx.update(budgetYears)
        .set({ label: data.label, startsOn: data.startsOn, endsOn: data.endsOn, budgetCents: data.budget })
        .where(eq(budgetYears.id, data.id!))
        .run();
      audit(tx, {
        actorId: admin.id,
        action: "year.saved",
        entity: "year",
        entityId: data.id!,
        data: { before: { ...before, createdAt: undefined }, after: { ...data, budgetCents: data.budget } },
      });
    });
    return;
  }

  db.transaction((tx) => {
    const { id: newId } = tx
      .insert(budgetYears)
      .values({ label: data.label, startsOn: data.startsOn, endsOn: data.endsOn, budgetCents: data.budget })
      .returning({ id: budgetYears.id })
      .get();
    audit(tx, { actorId: admin.id, action: "year.saved", entity: "year", entityId: newId, data: { after: data } });
  });
}

// Categories and events ------------------------------------------------------

const optionSchema = z.object({
  id: optionalId,
  nameEn: name,
  nameZh: z.string().trim().max(80).optional().default(""),
  heldOn: z.preprocess((v) => (v === "" ? undefined : v), isoDate.optional()),
});

export function saveCategory(admin: SessionUser, input: unknown) {
  const data = parse(optionSchema, input);
  const values = { nameEn: data.nameEn, nameZh: data.nameZh || data.nameEn };
  db.transaction((tx) => {
    const savedId = data.id
      ? (tx.update(categories).set(values).where(eq(categories.id, data.id)).run(), data.id)
      : tx.insert(categories).values(values).returning({ id: categories.id }).get().id;
    audit(tx, { actorId: admin.id, action: "category.saved", entity: "category", entityId: savedId, data: values });
  });
}

export function setCategoryArchived(admin: SessionUser, categoryId: number, archived: boolean) {
  db.transaction((tx) => {
    tx.update(categories)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(categories.id, categoryId))
      .run();
    audit(tx, { actorId: admin.id, action: "category.saved", entity: "category", entityId: categoryId, data: { archived } });
  });
}

export function saveEvent(admin: SessionUser, input: unknown) {
  const data = parse(optionSchema, input);
  const values = { nameEn: data.nameEn, nameZh: data.nameZh || data.nameEn, heldOn: data.heldOn ?? null };
  db.transaction((tx) => {
    const savedId = data.id
      ? (tx.update(events).set(values).where(eq(events.id, data.id)).run(), data.id)
      : tx.insert(events).values(values).returning({ id: events.id }).get().id;
    audit(tx, { actorId: admin.id, action: "event.saved", entity: "event", entityId: savedId, data: values });
  });
}

export function setEventArchived(admin: SessionUser, eventId: number, archived: boolean) {
  db.transaction((tx) => {
    tx.update(events)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(events.id, eventId))
      .run();
    audit(tx, { actorId: admin.id, action: "event.saved", entity: "event", entityId: eventId, data: { archived } });
  });
}

// Members --------------------------------------------------------------------

const memberSchema = z.object({
  id: optionalId,
  name,
  role: z.enum(ROLES),
});

function nameTaken(candidate: string, exceptId?: number) {
  const match = db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.name}) = lower(${candidate})`)
    .get();
  return !!match && match.id !== exceptId;
}

function activeAdminCount() {
  return (
    db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), isNull(users.removedAt)))
      .get()?.n ?? 0
  );
}

export function saveMember(admin: SessionUser, input: unknown) {
  const data = parse(memberSchema, input);

  if (data.id) {
    const member = db.select().from(users).where(eq(users.id, data.id)).get();
    if (!member) throw new AppError("not_found");
    if (member.role === "admin" && data.role !== "admin" && !member.removedAt && activeAdminCount() <= 1) {
      throw new AppError("last_admin");
    }
    if (nameTaken(data.name, member.id)) throw new AppError("name_taken");
    db.transaction((tx) => {
      tx.update(users).set({ name: data.name, role: data.role }).where(eq(users.id, member.id)).run();
      audit(tx, { actorId: admin.id, action: "member.updated", entity: "member", entityId: member.id, data: { name: data.name, role: data.role } });
    });
    return;
  }

  if (nameTaken(data.name)) throw new AppError("name_taken");
  db.transaction((tx) => {
    const { id: newId } = tx.insert(users).values({ name: data.name, role: data.role }).returning({ id: users.id }).get();
    audit(tx, { actorId: admin.id, action: "member.added", entity: "member", entityId: newId, data: { name: data.name, role: data.role } });
  });
}

/** Removed members can't sign in and are signed out everywhere; their history stays. */
export function setMemberRemoved(admin: SessionUser, memberId: number, removed: boolean) {
  const member = db.select().from(users).where(eq(users.id, memberId)).get();
  if (!member) throw new AppError("not_found");
  if (removed && member.id === admin.id) throw new AppError("not_allowed");
  if (removed && member.role === "admin" && activeAdminCount() <= 1) throw new AppError("last_admin");

  db.transaction((tx) => {
    tx.update(users)
      .set({ removedAt: removed ? new Date() : null })
      .where(eq(users.id, memberId))
      .run();
    audit(tx, { actorId: admin.id, action: removed ? "member.removed" : "member.restored", entity: "member", entityId: memberId });
  });
  if (removed) revokeSessions(memberId);
}

// Access -----------------------------------------------------------------------

const teamPasswordSchema = z.string().min(6).max(200);
const adminPasswordSchema = z.string().min(8).max(200);

/** A new team password signs everyone else out, so a leaked one stops working at once. */
export async function changeTeamPassword(admin: SessionUser, password: string) {
  const value = parse(teamPasswordSchema, password);
  if (await verifyPassword(value, getSetting("adminPasswordHash"))) throw new AppError("same_password");
  setSetting("teamPasswordHash", await hashPassword(value));
  revokeAllSessionsExcept(admin.id);
  audit(db, { actorId: admin.id, action: "access.team_password_changed", entity: "settings", entityId: "teamPassword" });
}

/** Changing the admin password needs the current one, and signs out other admins. */
export async function changeAdminPassword(admin: SessionUser, current: string, next: string) {
  if (!(await verifyPassword(current, getSetting("adminPasswordHash")))) throw new AppError("wrong_password");
  const value = parse(adminPasswordSchema, next);
  if (await verifyPassword(value, getSetting("teamPasswordHash"))) throw new AppError("same_password");
  setSetting("adminPasswordHash", await hashPassword(value));
  const otherAdmins = db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), ne(users.id, admin.id))).all();
  for (const { id } of otherAdmins) db.delete(sessions).where(eq(sessions.userId, id)).run();
  audit(db, { actorId: admin.id, action: "access.admin_password_changed", entity: "settings", entityId: "adminPassword" });
}

// Settings -------------------------------------------------------------------

export function setPublicPage(admin: SessionUser, enabled: boolean) {
  db.transaction((tx) => {
    setSetting("publicPage", enabled ? "on" : "off");
    audit(tx, { actorId: admin.id, action: "settings.updated", entity: "settings", entityId: "publicPage", data: { enabled } });
  });
}

// Lists for admin pages --------------------------------------------------------

export function listMembers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      removedAt: users.removedAt,
      expenseCount: sql<number>`(select count(*) from ${expenses} where ${expenses.userId} = ${users.id})`.mapWith(Number),
    })
    .from(users)
    .orderBy(sql`${users.removedAt} is not null`, users.name)
    .all();
}

export function listCategories() {
  return db
    .select({
      id: categories.id,
      nameEn: categories.nameEn,
      nameZh: categories.nameZh,
      archivedAt: categories.archivedAt,
      used: sql<number>`(select count(*) from ${expenses} where ${expenses.categoryId} = ${categories.id})`.mapWith(Number),
    })
    .from(categories)
    .orderBy(sql`${categories.archivedAt} is not null`, categories.id)
    .all();
}

export function listEvents() {
  return db
    .select({
      id: events.id,
      nameEn: events.nameEn,
      nameZh: events.nameZh,
      heldOn: events.heldOn,
      archivedAt: events.archivedAt,
      used: sql<number>`(select count(*) from ${expenses} where ${expenses.eventId} = ${events.id})`.mapWith(Number),
    })
    .from(events)
    .orderBy(sql`${events.archivedAt} is not null`, sql`${events.heldOn} desc nulls last`, events.id)
    .all();
}

export function activeCategories() {
  return db.select().from(categories).where(isNull(categories.archivedAt)).orderBy(categories.id).all();
}

export function activeEvents() {
  return db
    .select()
    .from(events)
    .where(isNull(events.archivedAt))
    .orderBy(sql`${events.heldOn} desc nulls last`, events.id)
    .all();
}

// Deleting ---------------------------------------------------------------------
// Only things nothing points at can be deleted; anything in use is archived instead, so old
// expenses keep their labels.

function usedBy(column: typeof expenses.categoryId | typeof expenses.eventId | typeof expenses.yearId, id: number) {
  return (db.select({ n: count() }).from(expenses).where(eq(column, id)).get()?.n ?? 0) > 0;
}

export function deleteCategory(admin: SessionUser, id: number) {
  if (usedBy(expenses.categoryId, id)) throw new AppError("in_use");
  db.transaction((tx) => {
    tx.delete(categories).where(eq(categories.id, id)).run();
    audit(tx, { actorId: admin.id, action: "category.deleted", entity: "category", entityId: id });
  });
}

export function deleteEvent(admin: SessionUser, id: number) {
  if (usedBy(expenses.eventId, id)) throw new AppError("in_use");
  db.transaction((tx) => {
    tx.delete(events).where(eq(events.id, id)).run();
    audit(tx, { actorId: admin.id, action: "event.deleted", entity: "event", entityId: id });
  });
}

export function deleteYear(admin: SessionUser, id: number) {
  if (usedBy(expenses.yearId, id)) throw new AppError("in_use");
  db.transaction((tx) => {
    tx.delete(budgetYears).where(eq(budgetYears.id, id)).run();
    audit(tx, { actorId: admin.id, action: "year.deleted", entity: "year", entityId: id });
  });
}

export function yearExpenseCount(id: number) {
  return db.select({ n: count() }).from(expenses).where(eq(expenses.yearId, id)).get()?.n ?? 0;
}
