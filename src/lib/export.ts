import "server-only";
import { once } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { asc, eq, inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import { auditLog, categories, db, events, expenses, files, users, type ExpenseStatus } from "@/lib/db";
import { timestamp } from "@/lib/dates";
import { readStoredFile } from "@/lib/files";
import { localName } from "@/lib/i18n-names";
import { yearSummary } from "@/lib/stats";
import type { BudgetYear } from "@/lib/years";

type Locale = "en" | "zh";

const COPY = {
  en: {
    summary: "Summary",
    expenses: "Expenses",
    audit: "Audit log",
    title: "Heart to Heart · Year-end accounts",
    period: "Period",
    generated: "Generated",
    budget: "Budget",
    spent: "Spent",
    remaining: "Remaining",
    byCategory: "By category",
    byEvent: "By event",
    byPerson: "By person",
    noEvent: "Not tied to an event",
    amount: "Amount (¥)",
    count: "Expenses",
    columns: {
      id: "ID",
      date: "Date paid",
      description: "Description",
      merchant: "Shop",
      category: "Category",
      event: "Event",
      member: "Submitted by",
      amount: "Amount (¥)",
      status: "Status",
      receipts: "Receipts",
      note: "Note / reason",
      expenseIds: "Expenses",
      time: "Time (Beijing)",
      actor: "By",
      action: "Action",
      entity: "Record",
      details: "Details",
    },
    total: "Total spent",
    status: { pending: "Recorded", approved: "Recorded", reimbursed: "Recorded", rejected: "Deleted", voided: "Deleted" },
  },
  zh: {
    summary: "汇总",
    expenses: "支出明细",
    audit: "审计日志",
    title: "心连心 · 年终账目",
    period: "期间",
    generated: "导出时间",
    budget: "预算",
    spent: "已支出",
    remaining: "剩余",
    byCategory: "按类别",
    byEvent: "按活动",
    byPerson: "按成员",
    noEvent: "不属于任何活动",
    amount: "金额（元）",
    count: "笔数",
    columns: {
      id: "编号",
      date: "付款日期",
      description: "用途",
      merchant: "商家",
      category: "类别",
      event: "活动",
      member: "提交人",
      amount: "金额（元）",
      status: "状态",
      receipts: "凭证",
      note: "备注 / 原因",
      expenseIds: "支出编号",
      time: "时间（北京）",
      actor: "操作人",
      action: "操作",
      entity: "记录",
      details: "详情",
    },
    total: "支出合计",
    status: { pending: "已记录", approved: "已记录", reimbursed: "已记录", rejected: "已删除", voided: "已删除" },
  },
} as const;

const MONEY = '#,##0.00';
const COUNTED: ExpenseStatus[] = ["approved", "reimbursed"];

/** Safe for every common file system and zip tool. */
function fileName(...parts: (string | number)[]) {
  return parts
    .map((p) => String(p).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("_")
    .slice(0, 120);
}

const expenseRef = (id: number) => `E${String(id).padStart(4, "0")}`;
const toDate = (d: Date) => timestamp(d).slice(0, 10);

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F3F2" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

function loadYear(year: BudgetYear) {
  const rows = db
    .select({
      id: expenses.id,
      spentOn: expenses.spentOn,
      description: expenses.description,
      merchant: expenses.merchant,
      categoryEn: categories.nameEn,
      categoryZh: categories.nameZh,
      eventEn: events.nameEn,
      eventZh: events.nameZh,
      member: users.name,
      amountCents: expenses.amountCents,
      status: expenses.status,
      note: expenses.note,
      rejectionReason: expenses.rejectionReason,
      voidReason: expenses.voidReason,
    })
    .from(expenses)
    .innerJoin(users, eq(users.id, expenses.userId))
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(events, eq(events.id, expenses.eventId))
    .where(eq(expenses.yearId, year.id))
    .orderBy(asc(expenses.spentOn), asc(expenses.id))
    .all();

  const expenseIds = rows.map((r) => r.id);
  const expenseIdSet = new Set(expenseIds);
  const receipts = expenseIds.length
    ? db.select({ id: files.id, expenseId: files.expenseId }).from(files).where(inArray(files.expenseId, expenseIds)).orderBy(asc(files.createdAt)).all()
    : [];

  const history = db
    .select({ createdAt: auditLog.createdAt, actor: users.name, action: auditLog.action, entity: auditLog.entity, entityId: auditLog.entityId, data: auditLog.data })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .orderBy(asc(auditLog.id))
    .all()
    .filter((h) => {
      // Expense entries follow their records; setup changes follow the calendar.
      if (h.entity === "expense") return expenseIdSet.has(Number(h.entityId));
      const day = toDate(h.createdAt);
      return day >= year.startsOn && day <= year.endsOn;
    });

  return { rows, receipts, history };
}

/** Builds the zip: a spreadsheet plus every receipt, named to match its row. */
export async function buildYearEndPack(year: BudgetYear, locale: Locale): Promise<{ name: string; stream: ReadableStream }> {
  const c = COPY[locale];
  const { rows, receipts, history } = loadYear(year);
  const summary = yearSummary(year, { includePeople: true });
  const folder = fileName(`H2H Finance ${year.label}`);

  // Decide every file's path first so the spreadsheet can link to it.
  const receiptPaths = new Map<number, { fileId: string; path: string }[]>();
  for (const row of rows) {
    const own = receipts.filter((r) => r.expenseId === row.id);
    receiptPaths.set(
      row.id,
      own.map((r, i) => ({
        fileId: r.id,
        path: `receipts/${fileName(expenseRef(row.id), row.spentOn, row.merchant, (row.amountCents / 100).toFixed(2), own.length > 1 ? String(i + 1) : "")}.jpg`,
      })),
    );
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "H2H Finance";
  workbook.created = new Date();

  // Summary
  const s = workbook.addWorksheet(c.summary);
  s.columns = [{ width: 36 }, { width: 18 }, { width: 12 }];
  s.addRow([c.title]).font = { bold: true, size: 14 };
  s.addRow([year.label]);
  s.addRow([c.period, `${year.startsOn} – ${year.endsOn}`]);
  s.addRow([c.generated, timestamp(new Date())]);
  s.addRow([]);
  for (const [label, cents] of [
    [c.budget, summary.budgetCents],
    [c.spent, summary.spent.cents],
    [c.remaining, summary.remainingCents],
  ] as const) {
    const row = s.addRow([label, cents / 100]);
    row.getCell(2).numFmt = MONEY;
  }
  for (const [title, slices, fallback] of [
    [c.byCategory, summary.byCategory, ""],
    [c.byEvent, summary.byEvent, c.noEvent],
    [c.byPerson, summary.byPerson, ""],
  ] as const) {
    s.addRow([]);
    s.addRow([title, c.amount, c.count]).font = { bold: true };
    for (const slice of slices) {
      const row = s.addRow([localName(locale, slice.nameEn, slice.nameZh) || fallback, slice.cents / 100, slice.count]);
      row.getCell(2).numFmt = MONEY;
    }
  }

  // Expenses
  const e = workbook.addWorksheet(c.expenses);
  const col = c.columns;
  e.columns = [
    { header: col.id, key: "id", width: 8 },
    { header: col.date, key: "date", width: 12 },
    { header: col.description, key: "description", width: 40 },
    { header: col.merchant, key: "merchant", width: 24 },
    { header: col.category, key: "category", width: 16 },
    { header: col.event, key: "event", width: 20 },
    { header: col.member, key: "member", width: 16 },
    { header: col.amount, key: "amount", width: 14, style: { numFmt: MONEY } },
    { header: col.status, key: "status", width: 14 },
    { header: col.receipts, key: "receipts", width: 40 },
    { header: col.note, key: "note", width: 40 },
  ];
  for (const r of rows) {
    const files = receiptPaths.get(r.id) ?? [];
    const row = e.addRow({
      id: expenseRef(r.id),
      date: r.spentOn,
      description: r.description,
      merchant: r.merchant,
      category: localName(locale, r.categoryEn, r.categoryZh),
      event: r.eventEn ? localName(locale, r.eventEn, r.eventZh) : "",
      member: r.member,
      amount: r.amountCents / 100,
      status: c.status[r.status],
      receipts: files.map((f) => f.path).join("\n"),
      note: [r.note, r.rejectionReason, r.voidReason].filter(Boolean).join("\n"),
    });
    // A single receipt becomes a clickable link that opens the file next to the spreadsheet.
    if (files.length === 1) row.getCell("receipts").value = { text: files[0].path, hyperlink: files[0].path };
    if (!COUNTED.includes(r.status)) row.font = { color: { argb: "FF8A8884" } };
  }
  const totalRow = e.addRow({
    description: c.total,
    amount: rows.filter((r) => COUNTED.includes(r.status)).reduce((sum, r) => sum + r.amountCents, 0) / 100,
  });
  totalRow.font = { bold: true };
  styleHeader(e);

  // Audit log
  const a = workbook.addWorksheet(c.audit);
  a.columns = [
    { header: col.time, key: "time", width: 20 },
    { header: col.actor, key: "actor", width: 16 },
    { header: col.action, key: "action", width: 24 },
    { header: col.entity, key: "entity", width: 16 },
    { header: col.details, key: "details", width: 60 },
  ];
  for (const h of history) {
    a.addRow({
      time: timestamp(h.createdAt),
      actor: h.actor ?? "",
      action: h.action,
      entity: `${h.entity} ${h.entity === "expense" ? expenseRef(Number(h.entityId)) : h.entityId}`,
      details: h.data ? JSON.stringify(h.data) : "",
    });
  }
  styleHeader(a);

  const spreadsheet = Buffer.from(await workbook.xlsx.writeBuffer());

  // Images are already compressed; storing them keeps the zip fast to build and open.
  const archive = new ZipArchive({ store: true });
  const output = new PassThrough();
  archive.on("error", (error) => output.destroy(error));
  archive.pipe(output);
  archive.append(spreadsheet, { name: `${folder}/${folder}.xlsx` });

  // One file at a time, waiting for each to be written, so memory stays flat however many receipts there are.
  const entries = [...receiptPaths.values()].flat();
  void (async () => {
    try {
      for (const f of entries) {
        const written = once(archive, "entry");
        archive.append(await readStoredFile(f.fileId, "full"), { name: `${folder}/${f.path}` });
        await written;
      }
      await archive.finalize();
    } catch (error) {
      archive.abort();
      output.destroy(error as Error);
    }
  })();

  return { name: `${folder}.zip`, stream: Readable.toWeb(output) as ReadableStream };
}
