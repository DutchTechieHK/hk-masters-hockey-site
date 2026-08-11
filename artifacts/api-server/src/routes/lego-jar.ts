import { Router } from "express";
import { db } from "@workspace/db";
import { legoJarConfigTable, legoJarRoundsTable, legoJarGuessesTable, legoJarPrizesTable } from "@workspace/db/schema";
import { eq, isNull, desc, sql, asc, and } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import { sendLegoJarGuessConfirmationEmail, sendLegoJarGuessAdminNotificationEmail } from "../utils/email";

export const legoJarPublicRouter = Router();
export const legoJarAdminRouter = Router();

const VALID_PAYMENT_METHODS = ["payme", "wise", "bank_transfer", "cash"] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getConfig() {
  const [row] = await db.select().from(legoJarConfigTable).where(eq(legoJarConfigTable.id, 1));
  return row ?? null;
}

async function getCurrentRound() {
  // The "current holder" is the latest open round that is NOT the special
  // Website designation (the Website round is permanently open but is not a
  // physical jar holder).
  const [round] = await db
    .select()
    .from(legoJarRoundsTable)
    .where(and(isNull(legoJarRoundsTable.endedAt), eq(legoJarRoundsTable.isWebsite, false)))
    .orderBy(desc(legoJarRoundsTable.startedAt))
    .limit(1);
  return round ?? null;
}

// Find (or lazily create) the single permanent "Website" round that online
// submissions are attributed to, kept separate from the physical jar holders.
async function getWebsiteRound() {
  const [existing] = await db
    .select()
    .from(legoJarRoundsTable)
    .where(eq(legoJarRoundsTable.isWebsite, true))
    .orderBy(asc(legoJarRoundsTable.id))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(legoJarRoundsTable)
    .values({ holderName: "Website", isWebsite: true })
    .returning();
  return created;
}

function serializeRound(r: typeof legoJarRoundsTable.$inferSelect & { guessCount?: number; paidCount?: number; amountRaised?: number }) {
  return {
    id: r.id,
    holderName: r.holderName,
    company: (r as any).company ?? null,
    squadMemberId: r.squadMemberId ?? null,
    location: r.location ?? null,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
    notes: (r as any).notes ?? null,
    isWebsite: r.isWebsite,
    guessCount: (r as any).guessCount ?? 0,
    paidCount: (r as any).paidCount ?? 0,
    amountRaised: (r as any).amountRaised ?? 0,
    isCurrent: r.endedAt === null && !r.isWebsite,
  };
}

function serializeGuess(g: typeof legoJarGuessesTable.$inferSelect) {
  return {
    id: g.id,
    roundId: g.roundId,
    guesserName: g.guesserName,
    guesserEmail: g.guesserEmail ?? null,
    guesserPhone: g.guesserPhone ?? null,
    guessNumber: g.guessNumber,
    paymentMethod: g.paymentMethod ?? null,
    paid: g.paid,
    paidAt: g.paidAt?.toISOString() ?? null,
    amountPaid: g.amountPaid != null ? Number(g.amountPaid) : null,
    createdAt: g.createdAt.toISOString(),
  };
}

// ─── Default prize data ───────────────────────────────────────────────────────

const DEFAULT_PRIZES = [
  {
    rank: 1,
    badge: "1st Prize",
    badgeColor: "bg-amber-400 text-amber-900",
    title: "7 Nights in a 4-Bedroom Bali Villa",
    description:
      "Stay at The Starling Villa in Bali — a stunning 4-bedroom private villa with its own pool, open-plan living areas, and lush tropical gardens. Perfect for a family holiday or a group getaway.",
    imageUrl: "/bali-villa.jpg",
    imageAlt: "The Starling Villa, Bali — private pool and tropical gardens",
  },
  {
    rank: 2,
    badge: "2nd Prize",
    badgeColor: "bg-gray-200 text-gray-700",
    title: "To be announced",
    description: "Watch this space — we're lining up something great for second place.",
    imageUrl: null,
    imageAlt: null,
  },
  {
    rank: 3,
    badge: "3rd Prize",
    badgeColor: "bg-orange-100 text-orange-700",
    title: "To be announced",
    description: "A special prize for the runner-up. Stay tuned!",
    imageUrl: null,
    imageAlt: null,
  },
];

async function getPrizes() {
  const rows = await db.select().from(legoJarPrizesTable).orderBy(asc(legoJarPrizesTable.rank));
  if (rows.length === 0) {
    const inserted = await db.insert(legoJarPrizesTable).values(DEFAULT_PRIZES).returning();
    return inserted.sort((a, b) => a.rank - b.rank);
  }
  return rows;
}

function serializePrize(p: typeof legoJarPrizesTable.$inferSelect) {
  return {
    id: p.id,
    rank: p.rank,
    badge: p.badge,
    badgeColor: p.badgeColor,
    title: p.title,
    description: p.description,
    imageUrl: p.imageUrl ?? null,
    imageAlt: p.imageAlt ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

// ─── Public Routes ───────────────────────────────────────────────────────────

// GET /api/lego-jar/stats
legoJarPublicRouter.get("/stats", async (_req, res) => {
  const config = await getConfig();
  const currentRound = await getCurrentRound();
  const pricePerGuess = Number(config?.pricePerGuess ?? 50);

  // Public counts reflect only verified (paid) guesses — pending guesses are
  // not yet active participations.
  const [totals] = await db
    .select({
      totalGuesses: sql<number>`COUNT(*) FILTER (WHERE paid)`,
      totalRaised: sql<string>`COALESCE(SUM(CASE WHEN paid THEN COALESCE(amount_paid, ${pricePerGuess}) ELSE 0 END), 0)`,
    })
    .from(legoJarGuessesTable);

  // The Website designation is excluded from the public holder journey (it is
  // not a physical jar holder); its paid guesses still count in the totals above.
  const allRounds = await db
    .select()
    .from(legoJarRoundsTable)
    .where(eq(legoJarRoundsTable.isWebsite, false))
    .orderBy(desc(legoJarRoundsTable.startedAt));

  const roundStats = await Promise.all(
    allRounds.map(async (r) => {
      const [s] = await db
        .select({
          guessCount: sql<number>`COUNT(*) FILTER (WHERE paid)`,
          amountRaised: sql<string>`COALESCE(SUM(CASE WHEN paid THEN COALESCE(amount_paid, ${pricePerGuess}) ELSE 0 END), 0)`,
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
        amountRaised: Number(s.amountRaised),
      };
    })
  );

  res.json({
    config: config
      ? {
          pricePerGuess,
          // Never reveal the actual count publicly until the winner has been
          // announced — otherwise a guaranteed-winning guess could be submitted.
          actualCount: config.winnerAnnounced ? config.actualCount ?? null : null,
          status: config.status,
          imageUrl: config.imageUrl ?? null,
        }
      : { pricePerGuess: 50, actualCount: null, status: "active", imageUrl: null },
    winner: config?.winnerAnnounced
      ? {
          name: config.winnerName ?? null,
          guess: config.winnerGuess ?? null,
          actualCount: config.actualCount ?? null,
          message: config.winnerMessage ?? null,
        }
      : null,
    currentRound: currentRound
      ? {
          id: currentRound.id,
          holderName: currentRound.holderName,
          company: currentRound.company ?? null,
          location: currentRound.location ?? null,
          startedAt: currentRound.startedAt.toISOString(),
        }
      : null,
    totalGuesses: Number(totals.totalGuesses),
    totalRaised: Number(totals.totalRaised),
    rounds: roundStats,
  });
});

// GET /api/lego-jar/prizes
legoJarPublicRouter.get("/prizes", async (_req, res) => {
  const prizes = await getPrizes();
  res.json(prizes.map(serializePrize));
});

// POST /api/lego-jar/guesses  (public submission)
legoJarPublicRouter.post("/guesses", async (req, res) => {
  const { guesserName, guesserEmail, guesserPhone, guessNumbers, guessNumber, paymentMethod, totalAmountPaid } = req.body ?? {};

  const errors: string[] = [];
  if (typeof guesserName !== "string" || !guesserName.trim()) errors.push("guesserName is required");
  else if (guesserName.trim().length > 200) errors.push("guesserName is too long");

  if (typeof guesserEmail !== "string" || !guesserEmail.trim()) errors.push("guesserEmail is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guesserEmail.trim())) errors.push("guesserEmail is invalid");

  if (typeof guesserPhone !== "string" || !guesserPhone.trim()) errors.push("guesserPhone is required");

  // Accept either guessNumbers array or single guessNumber
  const rawNumbers: unknown[] = Array.isArray(guessNumbers) ? guessNumbers : guessNumber != null ? [guessNumber] : [];
  if (rawNumbers.length === 0) errors.push("At least one guess number is required");
  if (rawNumbers.length > 10) errors.push("A maximum of 10 guess numbers is allowed");

  const parsedNumbers: number[] = [];
  for (const n of rawNumbers) {
    const parsed = typeof n === "number" ? n : parseInt(String(n), 10);
    if (isNaN(parsed) || parsed < 1) { errors.push("Each guess number must be a positive integer"); break; }
    if (parsed > 100000) { errors.push("A guess number is unreasonably large"); break; }
    parsedNumbers.push(parsed);
  }

  if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    errors.push("paymentMethod must be one of: payme, wise, bank_transfer, cash");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: "Invalid request", details: errors });
    return;
  }

  // Online submissions are attributed to the dedicated "Website" designation,
  // not to whoever is physically holding the jar right now.
  const config = await getConfig();

  // Reject submissions once the challenge is over or the winner is announced.
  if (config?.winnerAnnounced || config?.status === "completed") {
    res.status(409).json({ error: "The LEGO Jar Challenge has ended — guessing is closed." });
    return;
  }

  const websiteRound = await getWebsiteRound();
  const pricePerGuess = Number(config?.pricePerGuess ?? 50);

  // Single-item model: store the full bet amount on the first row and 0 on the
  // rest, so SUM(amount_paid) equals the total exactly with no rounding/decimals
  // (a 3-guess bet is one $100 item, a 1-guess bet is one $50 item).
  const totalPaid = totalAmountPaid != null ? Number(totalAmountPaid) : null;
  const perRowAmounts: (string | null)[] = parsedNumbers.map((_, i) => {
    if (totalPaid == null) return null;
    return i === 0 ? String(totalPaid) : "0";
  });

  const insertedGuesses = await db
    .insert(legoJarGuessesTable)
    .values(
      parsedNumbers.map((num, i) => ({
        roundId: websiteRound.id,
        guesserName: (guesserName as string).trim(),
        guesserEmail: guesserEmail?.trim() || null,
        guesserPhone: guesserPhone?.trim() || null,
        guessNumber: num,
        paymentMethod,
        paid: false,
        amountPaid: perRowAmounts[i],
      }))
    )
    .returning();

  const firstGuess = insertedGuesses[0];

  if (firstGuess.guesserEmail) {
    sendLegoJarGuessConfirmationEmail({
      guesserName: firstGuess.guesserName,
      guesserEmail: firstGuess.guesserEmail,
      guessNumber: firstGuess.guessNumber,
      paymentMethod: firstGuess.paymentMethod ?? paymentMethod,
      pricePerGuess: totalPaid ?? pricePerGuess,
    }).catch((err) => console.error("[lego-jar] Failed to send confirmation email:", err));
  }

  sendLegoJarGuessAdminNotificationEmail({
    guesserName: firstGuess.guesserName,
    guesserEmail: firstGuess.guesserEmail ?? null,
    guesserPhone: firstGuess.guesserPhone ?? null,
    guessNumber: firstGuess.guessNumber,
    paymentMethod: firstGuess.paymentMethod ?? paymentMethod,
    guessId: firstGuess.id,
  }).catch((err) => console.error("[lego-jar] Failed to send admin notification email:", err));

  res.status(201).json({
    guesses: insertedGuesses.map(serializeGuess),
    // backward compat: single-guess callers still get top-level fields
    id: firstGuess.id,
    guesserName: firstGuess.guesserName,
    guessNumber: firstGuess.guessNumber,
    paymentMethod: firstGuess.paymentMethod,
    createdAt: firstGuess.createdAt.toISOString(),
  });
});

// ─── Admin Routes ────────────────────────────────────────────────────────────

legoJarAdminRouter.use(requireAdminAccess);

// GET /api/admin/lego-jar/prizes
legoJarAdminRouter.get("/prizes", async (_req, res) => {
  const prizes = await getPrizes();
  res.json(prizes.map(serializePrize));
});

// PUT /api/admin/lego-jar/prizes/:rank
legoJarAdminRouter.put("/prizes/:rank", async (req, res) => {
  const rank = parseInt(req.params.rank, 10);
  if (isNaN(rank) || rank < 1 || rank > 3) {
    res.status(400).json({ error: "rank must be 1, 2, or 3" });
    return;
  }

  const { badge, badgeColor, title, description, imageUrl, imageAlt } = req.body ?? {};

  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof description !== "string" || !description.trim()) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  await getPrizes();

  const [existing] = await db
    .select()
    .from(legoJarPrizesTable)
    .where(eq(legoJarPrizesTable.rank, rank));

  const values = {
    rank,
    badge: badge?.trim() || `${rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"} Prize`,
    badgeColor: badgeColor?.trim() || "",
    title: title.trim(),
    description: description.trim(),
    imageUrl: imageUrl?.trim() || null,
    imageAlt: imageAlt?.trim() || null,
    updatedAt: new Date(),
  };

  if (!existing) {
    const [row] = await db.insert(legoJarPrizesTable).values(values).returning();
    res.json(serializePrize(row));
  } else {
    const [row] = await db
      .update(legoJarPrizesTable)
      .set(values)
      .where(eq(legoJarPrizesTable.rank, rank))
      .returning();
    res.json(serializePrize(row));
  }
});

// GET /api/admin/lego-jar/config
legoJarAdminRouter.get("/config", async (_req, res) => {
  const config = await getConfig();
  res.json(
    config ?? { id: 1, pricePerGuess: 50, actualCount: null, status: "active", imageUrl: null }
  );
});

// PUT /api/admin/lego-jar/config
legoJarAdminRouter.put("/config", async (req, res) => {
  const { pricePerGuess, actualCount, status, imageUrl, winnerAnnounced, winnerName, winnerGuess, winnerMessage } = req.body ?? {};

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (winnerAnnounced !== undefined) {
    if (typeof winnerAnnounced !== "boolean") { res.status(400).json({ error: "winnerAnnounced must be a boolean" }); return; }
    updateData.winnerAnnounced = winnerAnnounced;
  }
  if (winnerName !== undefined) updateData.winnerName = typeof winnerName === "string" && winnerName.trim() ? winnerName.trim() : null;
  if (winnerGuess !== undefined) {
    if (winnerGuess === null || winnerGuess === "") {
      updateData.winnerGuess = null;
    } else {
      const g = parseInt(winnerGuess, 10);
      if (isNaN(g) || g < 1) { res.status(400).json({ error: "winnerGuess must be a positive integer" }); return; }
      updateData.winnerGuess = g;
    }
  }
  if (winnerMessage !== undefined) updateData.winnerMessage = typeof winnerMessage === "string" && winnerMessage.trim() ? winnerMessage.trim() : null;
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
      winnerAnnounced: (updateData.winnerAnnounced as boolean | undefined) ?? false,
      winnerName: (updateData.winnerName as string | null | undefined) ?? null,
      winnerGuess: (updateData.winnerGuess as number | null | undefined) ?? null,
      winnerMessage: (updateData.winnerMessage as string | null | undefined) ?? null,
    }).returning();
    res.json(row);
  } else {
    const [row] = await db.update(legoJarConfigTable).set(updateData as any).where(eq(legoJarConfigTable.id, 1)).returning();
    res.json(row);
  }
});

// GET /api/admin/lego-jar/rounds
legoJarAdminRouter.get("/rounds", async (_req, res) => {
  // Make sure the Website designation always exists so the admin can see/use it.
  await getWebsiteRound();

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
          amountRaised: sql<string>`COALESCE(SUM(CASE WHEN paid THEN COALESCE(amount_paid, ${pricePerGuess}) ELSE 0 END), 0)`,
        })
        .from(legoJarGuessesTable)
        .where(eq(legoJarGuessesTable.roundId, r.id));
      return serializeRound({
        ...r,
        guessCount: Number(s.guessCount),
        paidCount: Number(s.paidCount),
        amountRaised: Number(s.amountRaised),
      });
    })
  );

  res.json(result);
});

// POST /api/admin/lego-jar/rounds  (start a new round / pass the jar)
legoJarAdminRouter.post("/rounds", async (req, res) => {
  const { holderName, company, squadMemberId, location, notes, closeCurrentRound } = req.body ?? {};

  if (typeof holderName !== "string" || !holderName.trim()) {
    res.status(400).json({ error: "holderName is required" });
    return;
  }

  let squadMemberIdValue: number | null = null;
  if (squadMemberId) {
    squadMemberIdValue = parseInt(squadMemberId, 10);
    if (isNaN(squadMemberIdValue)) {
      res.status(400).json({ error: "squadMemberId must be a number" });
      return;
    }
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
      company: company?.trim() || null,
      squadMemberId: squadMemberIdValue,
      location: location?.trim() || null,
      notes: notes?.trim() || null,
    })
    .returning();

  res.status(201).json({
    id: round.id,
    holderName: round.holderName,
    company: round.company ?? null,
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

// PATCH /api/admin/lego-jar/rounds/:id  (edit holder info)
legoJarAdminRouter.patch("/rounds/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { holderName, company, squadMemberId, location, notes } = req.body ?? {};

  const updates: Partial<typeof legoJarRoundsTable.$inferInsert> = {};

  if (holderName !== undefined) {
    if (typeof holderName !== "string" || !holderName.trim()) {
      res.status(400).json({ error: "holderName cannot be empty" });
      return;
    }
    updates.holderName = holderName.trim();
  }
  if (company !== undefined) updates.company = company?.trim() || null;
  if (location !== undefined) updates.location = location?.trim() || null;
  if (notes !== undefined) updates.notes = notes?.trim() || null;
  if (squadMemberId !== undefined) {
    if (squadMemberId) {
      const parsed = parseInt(squadMemberId, 10);
      if (isNaN(parsed)) {
        res.status(400).json({ error: "squadMemberId must be a number" });
        return;
      }
      updates.squadMemberId = parsed;
    } else {
      updates.squadMemberId = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [round] = await db
    .update(legoJarRoundsTable)
    .set(updates)
    .where(eq(legoJarRoundsTable.id, id))
    .returning();

  if (!round) { res.status(404).json({ error: "Round not found" }); return; }
  res.json(serializeRound(round));
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

  res.json(guesses.map(serializeGuess));
});

// POST /api/admin/lego-jar/guesses  (manual entry — supports batch)
legoJarAdminRouter.post("/guesses", async (req, res) => {
  const { roundId, guesserName, guesserEmail, guesserPhone, guessNumbers, guessNumber, paymentMethod, paid, amountPaid } = req.body ?? {};

  if (typeof guesserName !== "string" || !guesserName.trim()) {
    res.status(400).json({ error: "guesserName is required" });
    return;
  }

  // Accept either guessNumbers array or legacy single guessNumber
  const rawNumbers: unknown[] = Array.isArray(guessNumbers) ? guessNumbers : guessNumber != null ? [guessNumber] : [];
  if (rawNumbers.length === 0) {
    res.status(400).json({ error: "At least one guess number is required" });
    return;
  }
  if (rawNumbers.length > 10) {
    res.status(400).json({ error: "A maximum of 10 guess numbers is allowed" });
    return;
  }

  const parsedNumbers: number[] = [];
  for (const n of rawNumbers) {
    const parsed = typeof n === "number" ? n : parseInt(String(n), 10);
    if (isNaN(parsed) || parsed < 1) {
      res.status(400).json({ error: "Each guess number must be a positive integer" });
      return;
    }
    parsedNumbers.push(parsed);
  }

  // Single-item model: store the full bet amount on the first row and 0 on the
  // rest, so SUM(amount_paid) equals the total exactly with no rounding/decimals
  // (a 3-guess bet is one $100 item, a 1-guess bet is one $50 item).
  const totalPaid = amountPaid != null && amountPaid !== "" ? Number(amountPaid) : null;
  const perRowAmounts: (string | null)[] = parsedNumbers.map((_, i) => {
    if (totalPaid == null) return null;
    return i === 0 ? String(totalPaid) : "0";
  });

  const insertedGuesses = await db
    .insert(legoJarGuessesTable)
    .values(
      parsedNumbers.map((num, i) => ({
        roundId: roundId ? parseInt(roundId, 10) : null,
        guesserName: (guesserName as string).trim(),
        guesserEmail: guesserEmail?.trim() || null,
        guesserPhone: guesserPhone?.trim() || null,
        guessNumber: num,
        paymentMethod: paymentMethod || null,
        paid: !!paid,
        paidAt: paid ? new Date() : null,
        amountPaid: perRowAmounts[i],
      }))
    )
    .returning();

  res.status(201).json(insertedGuesses.map(serializeGuess));
});

// PATCH /api/admin/lego-jar/guesses/:id  (toggle paid, etc.)
legoJarAdminRouter.patch("/guesses/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { paid, guesserName, guesserEmail, guesserPhone, guessNumber, paymentMethod, amountPaid, roundId } = req.body ?? {};
  const updateData: Record<string, unknown> = {};
  if (paid !== undefined) {
    // Verification toggle — stamp the received time when marking paid, clear it otherwise.
    updateData.paid = !!paid;
    updateData.paidAt = paid ? new Date() : null;
  }
  if (guesserName !== undefined) updateData.guesserName = String(guesserName).trim();
  if (guesserEmail !== undefined) updateData.guesserEmail = guesserEmail?.trim() || null;
  if (guesserPhone !== undefined) updateData.guesserPhone = guesserPhone?.trim() || null;
  if (guessNumber !== undefined) updateData.guessNumber = parseInt(guessNumber, 10);
  if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod || null;
  if (amountPaid !== undefined) updateData.amountPaid = amountPaid != null && amountPaid !== "" ? String(Number(amountPaid)) : null;
  // Allow reassigning a guess to a different round / the Website designation.
  if (roundId !== undefined) {
    if (roundId === null) {
      updateData.roundId = null;
    } else {
      const parsedRoundId = parseInt(roundId, 10);
      if (isNaN(parsedRoundId)) { res.status(400).json({ error: "Invalid roundId" }); return; }
      updateData.roundId = parsedRoundId;
    }
  }

  const [guess] = await db
    .update(legoJarGuessesTable)
    .set(updateData as any)
    .where(eq(legoJarGuessesTable.id, id))
    .returning();

  if (!guess) { res.status(404).json({ error: "Guess not found" }); return; }

  res.json(serializeGuess(guess));
});

// DELETE /api/admin/lego-jar/guesses/:id
legoJarAdminRouter.delete("/guesses/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(legoJarGuessesTable).where(eq(legoJarGuessesTable.id, id));
  res.status(204).send();
});
