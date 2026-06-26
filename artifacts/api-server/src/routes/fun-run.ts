import { Router } from "express";
import { db } from "@workspace/db";
import { funRunIncomeTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";

const router = Router();
router.use(requireAdminAccess);

const VALID_CATEGORIES = ["entry_fee", "pledge", "drinks_cookies", "other"] as const;
type Category = typeof VALID_CATEGORIES[number];

function serialize(row: typeof funRunIncomeTable.$inferSelect) {
  return {
    id: row.id,
    date: row.date,
    payerName: row.payerName,
    description: row.description ?? null,
    category: row.category as Category,
    amountHkd: Number(row.amountHkd),
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseRow(b: Record<string, unknown>): { error: string } | {
  date: string; payerName: string; description: string | null;
  category: string; amountHkd: string; notes: string | null;
} {
  const payerName = typeof b.payerName === "string" ? b.payerName.trim() : "";
  if (!payerName) return { error: "payerName is required" };
  const amount = parseFloat(b.amountHkd as string ?? b.amount as string ?? "0");
  if (isNaN(amount) || amount < 0) return { error: "amountHkd must be a non-negative number" };
  const category = VALID_CATEGORIES.includes(b.category as Category) ? b.category as string : "entry_fee";
  return {
    date: typeof b.date === "string" ? b.date.trim() : "",
    payerName,
    description: typeof b.description === "string" ? b.description.trim() || null : null,
    category,
    amountHkd: String(amount),
    notes: typeof b.notes === "string" ? b.notes.trim() || null : null,
  };
}

// GET /api/fun-run — list all income rows
router.get("/", async (_req, res) => {
  const rows = await db.select().from(funRunIncomeTable).orderBy(funRunIncomeTable.id);
  res.json(rows.map(serialize));
});

// GET /api/fun-run/summary — totals by category
router.get("/summary", async (_req, res) => {
  const [totals] = await db
    .select({
      total: sql<string>`COALESCE(SUM(amount_hkd), 0)`,
      count: sql<number>`COUNT(*)::int`,
      entryFee: sql<string>`COALESCE(SUM(CASE WHEN category = 'entry_fee' THEN amount_hkd ELSE 0 END), 0)`,
      pledge: sql<string>`COALESCE(SUM(CASE WHEN category = 'pledge' THEN amount_hkd ELSE 0 END), 0)`,
      drinksCookies: sql<string>`COALESCE(SUM(CASE WHEN category = 'drinks_cookies' THEN amount_hkd ELSE 0 END), 0)`,
      other: sql<string>`COALESCE(SUM(CASE WHEN category = 'other' THEN amount_hkd ELSE 0 END), 0)`,
    })
    .from(funRunIncomeTable);

  res.json({
    total: Number(totals?.total ?? 0),
    count: Number(totals?.count ?? 0),
    byCategory: {
      entry_fee: Number(totals?.entryFee ?? 0),
      pledge: Number(totals?.pledge ?? 0),
      drinks_cookies: Number(totals?.drinksCookies ?? 0),
      other: Number(totals?.other ?? 0),
    },
  });
});

// GET /api/fun-run/export — CSV export
router.get("/export", async (_req, res) => {
  const rows = await db.select().from(funRunIncomeTable).orderBy(funRunIncomeTable.id);
  const header = "ID,Date,Payer Name,Description,Category,Amount HKD,Notes,Created At";
  const lines = rows.map(r => [
    r.id,
    `"${r.date}"`,
    `"${(r.payerName ?? "").replace(/"/g, '""')}"`,
    `"${(r.description ?? "").replace(/"/g, '""')}"`,
    r.category,
    Number(r.amountHkd).toFixed(2),
    `"${(r.notes ?? "").replace(/"/g, '""')}"`,
    r.createdAt.toISOString(),
  ].join(","));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="fun-run-income-${Date.now()}.csv"`);
  res.send([header, ...lines].join("\n"));
});

// POST /api/fun-run — add single row
router.post("/", async (req, res) => {
  const parsed = parseRow(req.body ?? {});
  if ("error" in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const [row] = await db.insert(funRunIncomeTable).values(parsed).returning();
  res.status(201).json(serialize(row));
});

// POST /api/fun-run/bulk — add multiple rows
router.post("/bulk", async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  if (items.length === 0) { res.status(400).json({ error: "No rows provided" }); return; }
  if (items.length > 500) { res.status(400).json({ error: "Maximum 500 rows per import" }); return; }

  const parsed: ReturnType<typeof parseRow>[] = items.map(parseRow);
  const errors = parsed.filter(p => "error" in p);
  if (errors.length > 0) {
    res.status(400).json({ error: `Row validation failed: ${(errors[0] as { error: string }).error}` });
    return;
  }

  const values = parsed as Exclude<ReturnType<typeof parseRow>, { error: string }>[];
  const inserted = await db.insert(funRunIncomeTable).values(values).returning();
  res.status(201).json({ inserted: inserted.length, rows: inserted.map(serialize) });
});

// PUT /api/fun-run/:id — update a row
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if ("payerName" in b) {
    const v = typeof b.payerName === "string" ? b.payerName.trim() : "";
    if (!v) { res.status(400).json({ error: "payerName is required" }); return; }
    updates.payerName = v;
  }
  if ("date" in b) updates.date = typeof b.date === "string" ? b.date.trim() : "";
  if ("description" in b) updates.description = typeof b.description === "string" ? b.description.trim() || null : null;
  if ("category" in b) updates.category = VALID_CATEGORIES.includes(b.category as Category) ? b.category : "entry_fee";
  if ("amountHkd" in b) {
    const v = parseFloat(b.amountHkd as string);
    if (isNaN(v) || v < 0) { res.status(400).json({ error: "amountHkd must be a non-negative number" }); return; }
    updates.amountHkd = String(v);
  }
  if ("notes" in b) updates.notes = typeof b.notes === "string" ? b.notes.trim() || null : null;

  const [row] = await db
    .update(funRunIncomeTable)
    .set(updates as Partial<typeof funRunIncomeTable.$inferInsert>)
    .where(eq(funRunIncomeTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Row not found" }); return; }
  res.json(serialize(row));
});

// DELETE /api/fun-run/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(funRunIncomeTable).where(eq(funRunIncomeTable.id, id));
  res.status(204).send();
});

export default router;
