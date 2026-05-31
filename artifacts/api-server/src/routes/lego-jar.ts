import { Router } from "express";
import { db } from "@workspace/db";
import { legoJarConfigTable, legoJarRoundsTable, legoJarGuessesTable } from "@workspace/db/schema";
import { eq, isNull, desc, sql } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";

export const legoJarPublicRouter = Router();
export const legoJarAdminRouter = Router();

const VALID_PAYMENT_METHODS = ["payme", "wise", "bank_transfer", "cash"] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getConfig() {
  const [row] = await db.select().from(legoJarConfigTable).where(eq(legoJarConfigTable.id, 1));
  return row ?? null;
}

async function getCurrentRound() {
  const [round] = await db
    .select()
    .from(legoJarRoundsTable)
    .where(isNull(legoJarRoundsTable.endedAt))
    .orderBy(desc(legoJarRoundsTable.startedAt))
    .limit(1);
  return round ?? null;
}

function serializeRound(r: typeof legoJarRoundsTable.$inferSelect & { guessCount?: number; paidCount?: number; amountRaised?: number }) {
  return {
    id: r.id,
    holderName: r.holderName,
    squadMemberId: r.squadMemberId ?? null,
    location: r.location ?? null,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
    notes: (r as any).notes ?? null,
    guessCount: (r as any).guessCount ?? 0,
    paidCount: (r as any).paidCount ?? 0,
    amountRaised: (r as any).amountRaised ?? 0,
    isCurrent: r.endedAt === null,
  };
}

async function getRoundWithStats(roundId: number) {
  const [stats] = await db
    .select({
      guessCount: sql<number>`COUNT(*)`,
      totalRaised: sql<string>`COALESCE(SUM(CASE WHEN paid THEN 50 ELSE 0 END), 0)`,
    })
    .from(legoJarGuessesTable)
    .where(eq(legoJarGuessesTable.roundId, roundId));
  return stats;
}

// ─── Public Routes ───────────────────────────────────────────────────────────

// GET /api/lego-jar/stats
legoJarPublicRouter.get("/stats", async (_req, res) => {
  const config = await getConfig();
  const currentRound = await getCurrentRound();

  const [totals] = await db
    .select({
      totalGuesses: sql<number>`COUNT(*)`,
      paidGuesses: sql<number>`COUNT(*) FILTER (WHERE paid = true)`,
    })
    .from(legoJarGuessesTable);

  const allRounds = await db
    .select()
    .from(legoJarRoundsTable)
    .orderBy(desc(legoJarRoundsTable.startedAt));

  const roundStats = await Promise.all(
    allRounds.map(async (r) => {
      const [s] = await db
        .select({
          guessCount: sql<number>`COUNT(*)`,
          paidCount: sql<number>`COUNT(*) FILTER (WHERE paid = true)`,
        })
        .from(legoJarGuessesTable)
        .where(eq(legoJarGuessesTable.roundId, r.id));
      return {
        id: r.id,
        holderName: r.holderName,
        location: r.location ?? null,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString() ?? null,
        guessCount: Number(s.guessCount),
        amountRaised: Number(s.paidCount) * Number(config?.pricePerGuess ?? 50),
      };
    })
  );

  const pricePerGuess = Number(config?.pricePerGuess ?? 50);
  const totalRaised = Number(totals.paidGuesses) * pricePerGuess;

  res.json({
    config: config
      ? {
          pricePerGuess,
          actualCount: config.actualCount ?? null,
          status: config.status,
          imageUrl: config.imageUrl ?? null,
        }
      : { pricePerGuess: 50, actualCount: null, status: "active", imageUrl: null },
    currentRound: currentRound
      ? {
          id: currentRound.id,
          holderName: currentRound.holderName,
          location: currentRound.location ?? null,
          startedAt: currentRound.startedAt.toISOString(),
        }
      : null,
    totalGuesses: Number(totals.totalGuesses),
    totalRaised,
    rounds: roundStats,
  });
});

// POST /api/lego-jar/guesses  (public submission)
legoJarPublicRouter.post("/guesses", async (req, res) => {
  const { guesserName, guesserEmail, guessNumber, paymentMethod } = req.body ?? {};

  const errors: string[] = [];
  if (typeof guesserName !== "string" || !guesserName.trim()) errors.push("guesserName is required");
  else if (guesserName.trim().length > 200) errors.push("guesserName is too long");

  if (guesserEmail !== undefined && guesserEmail !== null && guesserEmail !== "") {
    if (typeof guesserEmail !== "string") errors.push("guesserEmail must be a string");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guesserEmail.trim())) errors.push("guesserEmail is invalid");
  }

  const parsedGuess = typeof guessNumber === "number" ? guessNumber : parseInt(guessNumber, 10);
  if (isNaN(parsedGuess) || parsedGuess < 1) errors.push("guessNumber must be a positive integer");
  else if (parsedGuess > 100000) errors.push("guessNumber is unreasonably large");

  if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    errors.push("paymentMethod must be one of: payme, wise, bank_transfer, cash");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: "Invalid request", details: errors });
    return;
  }

  const currentRound = await getCurrentRound();

  const [guess] = await db
    .insert(legoJarGuessesTable)
    .values({
      roundId: currentRound?.id ?? null,
      guesserName: (guesserName as string).trim(),
      guesserEmail: guesserEmail?.trim() || null,
      guessNumber: parsedGuess,
      paymentMethod,
      paid: false,
    })
    .returning();

  res.status(201).json({
    id: guess.id,
    guesserName: guess.guesserName,
    guessNumber: guess.guessNumber,
    paymentMethod: guess.paymentMethod,
    createdAt: guess.createdAt.toISOString(),
  });
});

// ─── Admin Routes ────────────────────────────────────────────────────────────

legoJarAdminRouter.use(requireAdminAccess);

// GET /api/admin/lego-jar/config
legoJarAdminRouter.get("/config", async (_req, res) => {
  const config = await getConfig();
  res.json(
    config ?? { id: 1, pricePerGuess: 50, actualCount: null, status: "active", imageUrl: null }
  );
});

// PUT /api/admin/lego-jar/config
legoJarAdminRouter.put("/config", async (req, res) => {
  const { pricePerGuess, actualCount, status, imageUrl } = req.body ?? {};

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (pricePerGuess !== undefined) {
    const p = parseFloat(pricePerGuess);
    if (isNaN(p) || p <= 0) { res.status(400).json({ error: "pricePerGuess must be a positive number" }); return; }
    updateData.pricePerGuess = String(p);
  }
  if (actualCount !== undefined) updateData.actualCount = actualCount === null ? null : parseInt(actualCount, 10);
  if (status !== undefined) {
    if (!["active", "completed"].includes(status)) { res.status(400).json({ error: "status must be active or completed" }); return; }
    updateData.status = status;
  }
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;

  const existing = await getConfig();
  if (!existing) {
    const [row] = await db.insert(legoJarConfigTable).values({
      id: 1,
      pricePerGuess: String(pricePerGuess ?? 50),
      actualCount: actualCount ?? null,
      status: status ?? "active",
      imageUrl: imageUrl ?? null,
    }).returning();
    res.json(row);
  } else {
    const [row] = await db.update(legoJarConfigTable).set(updateData as any).where(eq(legoJarConfigTable.id, 1)).returning();
    res.json(row);
  }
});

// GET /api/admin/lego-jar/rounds
legoJarAdminRouter.get("/rounds", async (_req, res) => {
  const rounds = await db
    .select()
    .from(legoJarRoundsTable)
    .orderBy(desc(legoJarRoundsTable.startedAt));

  const config = await getConfig();
  const pricePerGuess = Number(config?.pricePerGuess ?? 50);

  const result = await Promise.all(
    rounds.map(async (r) => {
      const [s] = await db
        .select({
          guessCount: sql<number>`COUNT(*)`,
          paidCount: sql<number>`COUNT(*) FILTER (WHERE paid = true)`,
        })
        .from(legoJarGuessesTable)
        .where(eq(legoJarGuessesTable.roundId, r.id));
      return {
        id: r.id,
        holderName: r.holderName,
        squadMemberId: r.squadMemberId ?? null,
        location: r.location ?? null,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString() ?? null,
        notes: r.notes ?? null,
        guessCount: Number(s.guessCount),
        paidCount: Number(s.paidCount),
        amountRaised: Number(s.paidCount) * pricePerGuess,
        isCurrent: r.endedAt === null,
      };
    })
  );

  res.json(result);
});

// POST /api/admin/lego-jar/rounds  (start a new round / pass the jar)
legoJarAdminRouter.post("/rounds", async (req, res) => {
  const { holderName, squadMemberId, location, notes, closeCurrentRound } = req.body ?? {};

  if (typeof holderName !== "string" || !holderName.trim()) {
    res.status(400).json({ error: "holderName is required" });
    return;
  }

  if (closeCurrentRound) {
    const current = await getCurrentRound();
    if (current) {
      await db
        .update(legoJarRoundsTable)
        .set({ endedAt: new Date() })
        .where(eq(legoJarRoundsTable.id, current.id));
    }
  }

  const [round] = await db
    .insert(legoJarRoundsTable)
    .values({
      holderName: holderName.trim(),
      squadMemberId: squadMemberId ? parseInt(squadMemberId, 10) : null,
      location: location?.trim() || null,
      notes: notes?.trim() || null,
    })
    .returning();

  res.status(201).json({
    id: round.id,
    holderName: round.holderName,
    squadMemberId: round.squadMemberId ?? null,
    location: round.location ?? null,
    startedAt: round.startedAt.toISOString(),
    endedAt: null,
    notes: round.notes ?? null,
    guessCount: 0,
    paidCount: 0,
    amountRaised: 0,
    isCurrent: true,
  });
});

// POST /api/admin/lego-jar/rounds/:id/close
legoJarAdminRouter.post("/rounds/:id/close", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [round] = await db
    .update(legoJarRoundsTable)
    .set({ endedAt: new Date() })
    .where(eq(legoJarRoundsTable.id, id))
    .returning();

  if (!round) { res.status(404).json({ error: "Round not found" }); return; }
  res.json({ id: round.id, endedAt: round.endedAt?.toISOString() });
});

// GET /api/admin/lego-jar/guesses
legoJarAdminRouter.get("/guesses", async (req, res) => {
  const { roundId } = req.query as { roundId?: string };

  const guesses = await db
    .select()
    .from(legoJarGuessesTable)
    .where(roundId ? eq(legoJarGuessesTable.roundId, parseInt(roundId, 10)) : undefined)
    .orderBy(desc(legoJarGuessesTable.createdAt));

  res.json(
    guesses.map((g) => ({
      id: g.id,
      roundId: g.roundId,
      guesserName: g.guesserName,
      guesserEmail: g.guesserEmail ?? null,
      guessNumber: g.guessNumber,
      paymentMethod: g.paymentMethod ?? null,
      paid: g.paid,
      createdAt: g.createdAt.toISOString(),
    }))
  );
});

// POST /api/admin/lego-jar/guesses  (manual entry)
legoJarAdminRouter.post("/guesses", async (req, res) => {
  const { roundId, guesserName, guesserEmail, guessNumber, paymentMethod, paid } = req.body ?? {};

  if (typeof guesserName !== "string" || !guesserName.trim()) {
    res.status(400).json({ error: "guesserName is required" });
    return;
  }
  const parsedGuess = parseInt(guessNumber, 10);
  if (isNaN(parsedGuess) || parsedGuess < 1) {
    res.status(400).json({ error: "guessNumber must be a positive integer" });
    return;
  }

  const [guess] = await db
    .insert(legoJarGuessesTable)
    .values({
      roundId: roundId ? parseInt(roundId, 10) : null,
      guesserName: (guesserName as string).trim(),
      guesserEmail: guesserEmail?.trim() || null,
      guessNumber: parsedGuess,
      paymentMethod: paymentMethod || null,
      paid: !!paid,
    })
    .returning();

  res.status(201).json({
    id: guess.id,
    roundId: guess.roundId,
    guesserName: guess.guesserName,
    guesserEmail: guess.guesserEmail ?? null,
    guessNumber: guess.guessNumber,
    paymentMethod: guess.paymentMethod ?? null,
    paid: guess.paid,
    createdAt: guess.createdAt.toISOString(),
  });
});

// PATCH /api/admin/lego-jar/guesses/:id  (toggle paid, etc.)
legoJarAdminRouter.patch("/guesses/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { paid, guesserName, guesserEmail, guessNumber, paymentMethod } = req.body ?? {};
  const updateData: Record<string, unknown> = {};
  if (paid !== undefined) updateData.paid = !!paid;
  if (guesserName !== undefined) updateData.guesserName = String(guesserName).trim();
  if (guesserEmail !== undefined) updateData.guesserEmail = guesserEmail?.trim() || null;
  if (guessNumber !== undefined) updateData.guessNumber = parseInt(guessNumber, 10);
  if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod || null;

  const [guess] = await db
    .update(legoJarGuessesTable)
    .set(updateData as any)
    .where(eq(legoJarGuessesTable.id, id))
    .returning();

  if (!guess) { res.status(404).json({ error: "Guess not found" }); return; }

  res.json({
    id: guess.id,
    roundId: guess.roundId,
    guesserName: guess.guesserName,
    guesserEmail: guess.guesserEmail ?? null,
    guessNumber: guess.guessNumber,
    paymentMethod: guess.paymentMethod ?? null,
    paid: guess.paid,
    createdAt: guess.createdAt.toISOString(),
  });
});

// DELETE /api/admin/lego-jar/guesses/:id
legoJarAdminRouter.delete("/guesses/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(legoJarGuessesTable).where(eq(legoJarGuessesTable.id, id));
  res.status(204).send();
});
