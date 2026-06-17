import crypto from "crypto";
import { Router, type IRouter } from "express";
import { eq, and, isNull, gt, sql, inArray } from "drizzle-orm";
import { db, playersTable, playerLoginCodesTable, playerPaymentsTable, pollsTable, pollVotesTable, teamsTable, fundraisingTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { sendPlayerLoginCodeEmail } from "../utils/email";
import { createPlayerSession, destroyPlayerSession, requirePlayerSession } from "../middleware/playerSession";
import { mapPlayer } from "./players";
import { listEventsForPlayer, playerRsvpHandler } from "./events";

const router: IRouter = Router();

const CODE_TTL_MINUTES = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

router.post("/request-code", async (req, res) => {
  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  if (!EMAIL_RE.test(rawEmail.trim())) {
    return res.status(400).json({ error: "Valid email required" });
  }
  const email = normaliseEmail(rawEmail);

  // Opportunistic cleanup: drop expired/consumed codes globally so the table
  // doesn't grow forever. Cheap because of the email index.
  await db.execute(sql`DELETE FROM player_login_codes WHERE expires_at < NOW() OR consumed_at IS NOT NULL`);

  // Look up the player but always respond OK (don't leak which emails exist).
  const [player] = await db
    .select()
    .from(playersTable)
    .where(sql`lower(${playersTable.email}) = ${email}`)
    .limit(1);

  if (player) {
    // Invalidate any still-valid codes from earlier requests so only the
    // newest one works.
    await db.delete(playerLoginCodesTable).where(eq(playerLoginCodesTable.email, email));

    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await db.insert(playerLoginCodesTable).values({ email, codeHash, expiresAt });
    await sendPlayerLoginCodeEmail({
      playerName: player.name,
      playerEmail: player.email,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    });
  } else {
    console.log(`[player-auth] request-code for unknown email ${email} — silently ignored`);
  }

  res.json({ ok: true, expiresInMinutes: CODE_TTL_MINUTES });
});

router.post("/verify-code", async (req, res) => {
  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  const rawCode = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!EMAIL_RE.test(rawEmail.trim()) || !CODE_RE.test(rawCode)) {
    return res.status(400).json({ error: "Email and 6-digit code required" });
  }
  const email = normaliseEmail(rawEmail);
  const codeHash = hashCode(rawCode);
  const now = new Date();

  // Atomic single-use redemption: only one concurrent caller can flip
  // consumed_at from NULL to now(). Returning the row guarantees the caller
  // is the unique winner.
  const claimed = await db
    .update(playerLoginCodesTable)
    .set({ consumedAt: now })
    .where(and(
      eq(playerLoginCodesTable.email, email),
      eq(playerLoginCodesTable.codeHash, codeHash),
      isNull(playerLoginCodesTable.consumedAt),
      gt(playerLoginCodesTable.expiresAt, now),
    ))
    .returning({ id: playerLoginCodesTable.id });

  if (claimed.length === 0) {
    return res.status(401).json({ error: "Code is invalid or has expired" });
  }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(sql`lower(${playersTable.email}) = ${email}`)
    .limit(1);

  if (!player) {
    return res.status(401).json({ error: "No player found for this email" });
  }

  const sessionToken = await createPlayerSession(player.id);
  res.json({ sessionToken, player: { ...mapPlayer(player, null), accessToken: player.accessToken } });
});

router.get("/me", requirePlayerSession, async (req, res) => {
  res.json({ ...mapPlayer(req.player!, null), accessToken: req.player!.accessToken });
});

router.get("/my-schedule", requirePlayerSession, async (req, res) => {
  const events = await listEventsForPlayer(req.player!.teamId ?? null, req.player!.id);
  res.json({ events });
});

router.post("/events/:id/rsvp", requirePlayerSession, playerRsvpHandler);
router.patch("/events/:id/rsvp", requirePlayerSession, playerRsvpHandler);

router.get("/my-fees", requirePlayerSession, async (req, res) => {
  const player = req.player!;
  const payments = await db
    .select()
    .from(playerPaymentsTable)
    .where(eq(playerPaymentsTable.playerId, player.id))
    .orderBy(desc(playerPaymentsTable.paymentDate), desc(playerPaymentsTable.id));
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const amountDue = player.paymentAmountDue ? parseFloat(player.paymentAmountDue) : null;
  const balance = amountDue == null ? null : Math.max(0, amountDue - totalPaid);
  const feePaid = amountDue != null ? totalPaid + 1e-6 >= amountDue && totalPaid > 0 : totalPaid > 0;
  res.json({
    amountDue,
    amountPaid: Number(totalPaid.toFixed(2)),
    balance,
    feePaid,
    payments: payments.map((p) => ({
      id: p.id,
      amount: parseFloat(p.amount),
      paymentDate: p.paymentDate,
      method: p.method || null,
      notes: p.notes || null,
    })),
  });
});

router.get("/my-supporters", requirePlayerSession, async (req, res) => {
  const player = req.player!;
  const rows = await db
    .select()
    .from(fundraisingTable)
    .where(sql`LOWER(TRIM(${fundraisingTable.beneficiary})) = LOWER(TRIM(${player.name}))`)
    .orderBy(desc(fundraisingTable.amountPledged), desc(fundraisingTable.createdAt));
  res.json({
    supporters: rows.map((r) => ({
      id: r.id,
      donorName: r.donorName,
      amountPledged: parseFloat(r.amountPledged ?? "0"),
      amountReceived: parseFloat(r.amountReceived ?? "0"),
      status: r.status,
      paymentMethod: r.paymentMethod ?? null,
      notes: r.notes ?? null,
      createdAt: r.createdAt,
    })),
  });
});

router.get("/my-travel", requirePlayerSession, async (req, res) => {
  const player = req.player!;
  const arrivalRaw = player.flightArrivalDateTime ?? null;
  // flight_arrival_date_time is stored as text (the player-facing form is a
  // <input type="datetime-local"> which always emits "YYYY-MM-DDTHH:MM").
  // We only match same-day arrivals when both sides have a parseable
  // ISO-style "YYYY-MM-DD" prefix; non-ISO values are skipped rather than
  // mis-matched.
  const ISO_DATE_RE = /^(\d{4}-\d{2}-\d{2})/;
  const arrivalMatch = arrivalRaw ? arrivalRaw.match(ISO_DATE_RE) : null;
  const arrivalDay = arrivalMatch ? arrivalMatch[1] : null;

  // Find players (any squad) arriving on the same calendar day, excluding self.
  let sameDayArrivals: Array<{ id: number; name: string; arrival: string; arrivalCity: string | null }> = [];
  if (arrivalDay) {
    const rows = await db
      .select({
        id: playersTable.id,
        name: playersTable.name,
        arrival: playersTable.flightArrivalDateTime,
        arrivalCity: playersTable.arrivalCity,
      })
      .from(playersTable)
      .where(sql`
        ${playersTable.id} <> ${player.id}
        AND ${playersTable.flightArrivalDateTime} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        AND substring(${playersTable.flightArrivalDateTime} from 1 for 10) = ${arrivalDay}
      `);
    sameDayArrivals = rows.map((r) => ({
      id: r.id,
      name: r.name,
      arrival: r.arrival ?? "",
      arrivalCity: r.arrivalCity ?? null,
    }));
  }

  // Try to resolve the named roommate to a player record (best-effort by name match).
  let roommate: { id: number; name: string } | null = null;
  const roomWith = (player.roomSharingWith ?? "").trim();
  if (roomWith) {
    const [match] = await db
      .select({ id: playersTable.id, name: playersTable.name })
      .from(playersTable)
      .where(sql`lower(${playersTable.name}) = ${roomWith.toLowerCase()}`)
      .limit(1);
    if (match) roommate = match;
  }

  res.json({
    flightArrivalDateTime: player.flightArrivalDateTime ?? null,
    flightDepartureDateTime: player.flightDepartureDateTime ?? null,
    arrivalCity: player.arrivalCity ?? null,
    travelDates: player.travelDates ?? null,
    roomSharingPreference: player.roomSharingPreference ?? null,
    roomSharingWith: player.roomSharingWith ?? null,
    roommate,
    sameDayArrivals,
    accessToken: player.accessToken ?? null,
  });
});

router.get("/polls", requirePlayerSession, async (req, res) => {
  const player = req.player!;
  const now = new Date();

  // Determine the player's team category so we can filter by audience
  let teamCategory: string | null = null;
  if (player.teamId) {
    const [teamRow] = await db
      .select({ category: teamsTable.category })
      .from(teamsTable)
      .where(eq(teamsTable.id, player.teamId));
    teamCategory = teamRow?.category ?? null;
  }

  // Fetch all polls that are open (not closed, deadline not passed)
  const allPolls = await db.select().from(pollsTable).orderBy(pollsTable.id);
  const openPolls = allPolls.filter((p) => {
    if (p.closedAt) return false;
    if (p.deadline && now > p.deadline) return false;
    return true;
  });

  // Filter by audience
  const eligible = openPolls.filter((p) => {
    const aud = p.audience;
    if (aud === "all") return true;
    if (aud === "both") return teamCategory === "MO40" || teamCategory === "MO50";
    return teamCategory === aud;
  });

  if (eligible.length === 0) {
    return res.json({ polls: [] });
  }

  // Find which polls this player has already voted on
  const pollIds = eligible.map((p) => p.id);
  const myVotes = await db
    .select({ pollId: pollVotesTable.pollId })
    .from(pollVotesTable)
    .where(and(
      eq(pollVotesTable.playerId, player.id),
      inArray(pollVotesTable.pollId, pollIds),
    ));
  const votedPollIds = new Set(myVotes.map((v) => v.pollId));

  res.json({
    polls: eligible.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description ?? null,
      deadline: p.deadline?.toISOString() ?? null,
      hasVoted: votedPollIds.has(p.id),
    })),
  });
});

router.post("/logout", requirePlayerSession, async (req, res) => {
  const token =
    (req.headers["x-player-session"] as string | undefined) ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (token) await destroyPlayerSession(token);
  res.json({ ok: true });
});

export default router;
