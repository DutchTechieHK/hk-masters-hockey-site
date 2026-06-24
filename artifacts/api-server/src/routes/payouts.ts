import { Router } from "express";
import { db } from "@workspace/db";
import { playerPayoutsTable, playersTable, fundraisingTable, legoJarGuessesTable } from "@workspace/db/schema";
import { eq, sql, desc, isNull } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";

const VALID_METHODS = ["fps", "payme", "bank_transfer", "cash", "cheque", "other"] as const;
const VALID_SOURCES = ["fundraising", "lego_jar", "general"] as const;
type Method = typeof VALID_METHODS[number];
type Source = typeof VALID_SOURCES[number];

function validatePayoutBody(body: Record<string, unknown>): {
  playerId?: number | null;
  recipientName: string;
  amount: number;
  payoutDate: string;
  method: Method;
  source: Source;
  reference?: string | null;
  notes?: string | null;
} | null {
  const { playerId, recipientName, amount, payoutDate, method, source, reference, notes } = body;
  if (typeof recipientName !== "string" || recipientName.trim() === "") return null;
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) return null;
  if (typeof payoutDate !== "string" || payoutDate.trim() === "") return null;
  if (!VALID_METHODS.includes(method as Method)) return null;
  if (!VALID_SOURCES.includes(source as Source)) return null;
  return {
    playerId: typeof playerId === "number" ? playerId : null,
    recipientName: recipientName.trim(),
    amount,
    payoutDate: payoutDate.trim(),
    method: method as Method,
    source: source as Source,
    reference: typeof reference === "string" ? reference : null,
    notes: typeof notes === "string" ? notes : null,
  };
}

const router = Router();
router.use(requireAdminAccess);

// GET /api/payouts — list all payouts newest first
router.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: playerPayoutsTable.id,
      playerId: playerPayoutsTable.playerId,
      recipientName: playerPayoutsTable.recipientName,
      amount: playerPayoutsTable.amount,
      payoutDate: playerPayoutsTable.payoutDate,
      method: playerPayoutsTable.method,
      source: playerPayoutsTable.source,
      reference: playerPayoutsTable.reference,
      notes: playerPayoutsTable.notes,
      createdAt: playerPayoutsTable.createdAt,
      playerName: playersTable.name,
    })
    .from(playerPayoutsTable)
    .leftJoin(playersTable, eq(playerPayoutsTable.playerId, playersTable.id))
    .orderBy(desc(playerPayoutsTable.createdAt));

  res.json(
    rows.map((r) => ({
      ...r,
      amount: parseFloat(r.amount),
    }))
  );
});

// GET /api/payouts/reconciliation
router.get("/reconciliation", async (_req, res) => {
  // All players
  const players = await db
    .select({ id: playersTable.id, name: playersTable.name })
    .from(playersTable)
    .orderBy(playersTable.name);

  // Fundraising received per beneficiary name (case-insensitive)
  const fundRows = await db
    .select({
      beneficiary: sql<string>`LOWER(TRIM(${fundraisingTable.beneficiary}))`,
      total: sql<string>`COALESCE(SUM(${fundraisingTable.amountReceived}), 0)`,
    })
    .from(fundraisingTable)
    .where(sql`${fundraisingTable.beneficiary} IS NOT NULL AND TRIM(${fundraisingTable.beneficiary}) <> ''`)
    .groupBy(sql`LOWER(TRIM(${fundraisingTable.beneficiary}))`);

  const fundMap = new Map<string, number>();
  for (const row of fundRows) {
    fundMap.set(row.beneficiary, parseFloat(row.total));
  }

  // All payouts per linked player (strict playerId match only — no fuzzy name attribution)
  const payoutsByPlayer = await db
    .select({
      playerId: playerPayoutsTable.playerId,
      totalAll: sql<string>`COALESCE(SUM(${playerPayoutsTable.amount}), 0)`,
      totalLegoJar: sql<string>`COALESCE(SUM(CASE WHEN ${playerPayoutsTable.source} = 'lego_jar' THEN ${playerPayoutsTable.amount} ELSE 0 END), 0)`,
    })
    .from(playerPayoutsTable)
    .where(sql`${playerPayoutsTable.playerId} IS NOT NULL`)
    .groupBy(playerPayoutsTable.playerId);

  const payoutTotalMap = new Map<number, number>();
  const payoutLegoMap = new Map<number, number>();
  for (const row of payoutsByPlayer) {
    if (row.playerId !== null) {
      payoutTotalMap.set(row.playerId, parseFloat(row.totalAll));
      payoutLegoMap.set(row.playerId, parseFloat(row.totalLegoJar));
    }
  }

  // Lego Jar total collected (the whole pot)
  const [legoRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${legoJarGuessesTable.amountPaid}), 0)` })
    .from(legoJarGuessesTable)
    .where(eq(legoJarGuessesTable.paid, true));

  const legoJarTotal = parseFloat(legoRow?.total ?? "0");

  // Build per-player reconciliation
  // balance = (fundraisingReceived + legoJarAllocated) - totalPaidOut
  // legoJarAllocated = payouts with source='lego_jar' (admin explicitly tagged these as lego jar disbursements)
  // This nets to zero for lego jar payments, leaving only outstanding fundraising obligations in the balance
  const playerRows = players.map((p) => {
    const nameLower = p.name.toLowerCase().trim();
    const fundraisingReceived = fundMap.get(nameLower) ?? 0;
    const totalPaidOut = payoutTotalMap.get(p.id) ?? 0;
    const legoJarAllocated = payoutLegoMap.get(p.id) ?? 0;
    const balance = (fundraisingReceived + legoJarAllocated) - totalPaidOut;
    return {
      playerId: p.id,
      playerName: p.name,
      fundraisingReceived,
      legoJarAllocated,
      totalPaidOut,
      balance,
    };
  });

  // Only return players who have some fundraising or some linked payouts
  const activeRows = playerRows.filter(
    (r) => r.fundraisingReceived > 0 || r.totalPaidOut > 0
  );

  res.json({ players: activeRows, legoJarTotal });
});

// POST /api/payouts
router.post("/", async (req, res) => {
  const data = validatePayoutBody(req.body as Record<string, unknown>);
  if (!data) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { playerId, recipientName, amount, payoutDate, method, source, reference, notes } = data;

  const [row] = await db
    .insert(playerPayoutsTable)
    .values({
      playerId: playerId ?? null,
      recipientName,
      amount: String(amount),
      payoutDate,
      method,
      source,
      reference: reference ?? null,
      notes: notes ?? null,
    })
    .returning();

  res.status(201).json({ ...row, amount: parseFloat(row.amount) });
});

// PATCH /api/payouts/:id
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const b = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if ("playerId" in b) update.playerId = typeof b.playerId === "number" ? b.playerId : null;
  if ("recipientName" in b && typeof b.recipientName === "string") update.recipientName = b.recipientName.trim();
  if ("amount" in b && typeof b.amount === "number" && b.amount > 0) update.amount = String(b.amount);
  if ("payoutDate" in b && typeof b.payoutDate === "string") update.payoutDate = b.payoutDate.trim();
  if ("method" in b && VALID_METHODS.includes(b.method as Method)) update.method = b.method;
  if ("source" in b && VALID_SOURCES.includes(b.source as Source)) update.source = b.source;
  if ("reference" in b) update.reference = typeof b.reference === "string" ? b.reference : null;
  if ("notes" in b) update.notes = typeof b.notes === "string" ? b.notes : null;

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [row] = await db
    .update(playerPayoutsTable)
    .set(update)
    .where(eq(playerPayoutsTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, amount: parseFloat(row.amount) });
});

// DELETE /api/payouts/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .delete(playerPayoutsTable)
    .where(eq(playerPayoutsTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

export default router;
