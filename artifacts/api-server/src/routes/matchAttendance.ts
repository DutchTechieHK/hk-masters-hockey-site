import type { Request, Response } from "express";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import {
  db, pool, matchesTable, matchRsvpsTable, playerParticipationsTable, playersTable, seasonsTable,
  emailBlastsTable, emailBlastRecipientsTable,
} from "@workspace/db";
import { sendMatchReminderEmail } from "../utils/email";
import { getSessionLabel } from "../middleware/adminSession";

const CURRENT_SEASON = "membership-2026-27";
const STATUSES = ["yes", "maybe", "no"] as const;
type Status = typeof STATUSES[number];

function matchId(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function eligiblePlayers(teamId: number) {
  return db.select({
    id: playersTable.id, name: playersTable.name, shirtNumber: playersTable.shirtNumber,
    email: playersTable.email,
  }).from(playerParticipationsTable)
    .innerJoin(seasonsTable, eq(seasonsTable.id, playerParticipationsTable.seasonId))
    .innerJoin(playersTable, eq(playersTable.id, playerParticipationsTable.playerId))
    .where(and(
      eq(seasonsTable.slug, CURRENT_SEASON),
      eq(playerParticipationsTable.participationStatus, "active"),
      eq(playerParticipationsTable.teamId, teamId),
      eq(playersTable.memberStatus, "active"),
    )).orderBy(asc(playersTable.name));
}

export async function remindMatchNonresponders(req: Request, res: Response): Promise<void> {
  const id = matchId(req);
  if (id == null) { res.status(400).json({ error: "Invalid match id" }); return; }
  // Session-level PostgreSQL lock serializes batches even across server instances.
  const lockClient = await pool.connect();
  let acquired = false;
  try {
    const lock = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(602, $1) AS acquired", [id]);
    acquired = lock.rows[0]?.acquired === true;
    if (!acquired) {
      res.status(409).json({ error: "Reminders for this match are already being sent" }); return;
    }
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id)).limit(1);
    if (!match) { res.status(404).json({ error: "Match not found" }); return; }
    if (match.operationalScope !== "local_2026_27" || match.status !== "scheduled" || match.kickoffAt <= new Date()) {
      res.status(409).json({ error: "Only future scheduled local matches can receive reminders" }); return;
    }

    const players = await eligiblePlayers(match.teamId);
    const replies = await db.select({ playerId: matchRsvpsTable.playerId }).from(matchRsvpsTable)
      .where(eq(matchRsvpsTable.matchId, id));
    const replied = new Set(replies.map((row) => row.playerId));
    const nonresponders = players.filter((player) => !replied.has(player.id));
    const noEmail = nonresponders.filter((player) => !player.email).length;

    // The match-specific audience key keeps successful sends distinct from Event reminders
    // and allows failed sends to be retried without re-emailing successful recipients.
    const audienceType = `match-rsvp-reminder:${id}`;
    const previous = await db.select({
      playerId: emailBlastRecipientsTable.playerId,
      sent: emailBlastRecipientsTable.sent,
      errorMessage: emailBlastRecipientsTable.errorMessage,
    })
      .from(emailBlastRecipientsTable)
      .innerJoin(emailBlastsTable, eq(emailBlastsTable.id, emailBlastRecipientsTable.blastId))
      .where(eq(emailBlastsTable.audienceType, audienceType));
    const alreadySent = new Set(previous.filter((row) => row.sent).map((row) => row.playerId));
    // Pending/uncertain may already have been accepted by the provider. Never resend
    // automatically until staff have independently reconciled its delivery.
    const uncertain = new Set(previous.filter((row) =>
      !row.sent && (row.errorMessage === "delivery_pending" || row.errorMessage === "delivery_uncertain"),
    ).map((row) => row.playerId));
    const skippedAlreadySent = nonresponders.filter((player) => player.email && alreadySent.has(player.id)).length;
    const skippedUncertain = nonresponders.filter((player) => player.email && !alreadySent.has(player.id) && uncertain.has(player.id)).length;
    const recipients = nonresponders.filter((player) => player.email && !alreadySent.has(player.id) && !uncertain.has(player.id));
    const sender = typeof req.headers["x-session-token"] === "string"
      ? await getSessionLabel(req.headers["x-session-token"]) : null;

    if (!recipients.length) {
      res.json({ sent: 0, total: nonresponders.length, skippedNoEmail: noEmail,
        skippedAlreadySent, skippedUncertain, skippedChanged: 0, failed: 0, historyRecorded: true }); return;
    }

    const date = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong", day: "numeric", month: "long", year: "numeric",
    }).format(match.kickoffAt);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(match.kickoffAt);
    const subject = `Quick reply needed: HK Masters vs ${match.opponent}`;
    // Create the audit batch before delivery, so a history failure never causes an untracked send.
    const [blast] = await db.insert(emailBlastsTable).values({
      subject,
      body: `Match attendance reminder\nMatch #${id}: HK Masters vs ${match.opponent}\n${date} ${time} HKT${match.venue ? `\nVenue: ${match.venue}` : ""}`,
      audienceType, teamIds: JSON.stringify([match.teamId]),
      playerIds: JSON.stringify(recipients.map((player) => player.id)),
      recipientCount: recipients.length, failedCount: recipients.length,
      sentByEmail: sender ?? "HK Masters Hockey", operationalScope: "local_2026_27",
    }).returning({ id: emailBlastsTable.id });
    let sent = 0;
    let failed = 0;
    let skippedChanged = 0;
    let historyRecorded = true;
    for (let i = 0; i < recipients.length; i++) {
      const player = recipients[i];
      // Re-check eligibility and replies while the batch is running; a player may respond or change squads.
      const [currentMatch] = await db.select({
        status: matchesTable.status, kickoffAt: matchesTable.kickoffAt,
        operationalScope: matchesTable.operationalScope, teamId: matchesTable.teamId,
      })
        .from(matchesTable).where(eq(matchesTable.id, id)).limit(1);
      const currentPlayers = await eligiblePlayers(match.teamId);
      const [reply] = await db.select({ playerId: matchRsvpsTable.playerId }).from(matchRsvpsTable)
        .where(and(eq(matchRsvpsTable.matchId, id), eq(matchRsvpsTable.playerId, player.id))).limit(1);
      if (!currentMatch || currentMatch.operationalScope !== "local_2026_27" ||
        currentMatch.teamId !== match.teamId || currentMatch.status !== "scheduled" || currentMatch.kickoffAt <= new Date()) {
        skippedChanged += recipients.length - i;
        break;
      }
      if (reply || !currentPlayers.some((p) => p.id === player.id && p.email === player.email)) {
        skippedChanged++;
        continue;
      }
      // Durable claim BEFORE calling the provider. A crash or timeout thereafter leaves
      // this recipient blocked from automatic retries, even when no success was recorded.
      let recipientId: number;
      try {
        const [claim] = await db.insert(emailBlastRecipientsTable).values({
          blastId: blast.id, playerId: player.id, playerName: player.name,
          playerEmail: player.email!, sent: false, errorMessage: "delivery_pending",
        }).returning({ id: emailBlastRecipientsTable.id });
        recipientId = claim.id;
      } catch {
        historyRecorded = false;
        break; // Never send without a durable recipient claim.
      }
      let ok = false;
      try {
        ok = await sendMatchReminderEmail({
          playerName: player.name, playerEmail: player.email!,
          opponent: match.opponent, date, time, venue: match.venue,
          matchUrl: `${process.env.PUBLIC_URL || "https://www.hkmastershockey.com"}/schedule#match-${id}`,
        });
      } catch {
        // The delivery result is recorded per recipient below.
      }
      if (ok) sent++; else failed++;
      try {
        await db.transaction(async (tx) => {
          await tx.update(emailBlastRecipientsTable).set({
            sent: ok, errorMessage: ok ? null : "delivery_uncertain",
          }).where(eq(emailBlastRecipientsTable.id, recipientId));
          await tx.update(emailBlastsTable).set({
            sentCount: sent, failedCount: recipients.length - sent - skippedChanged,
          }).where(eq(emailBlastsTable.id, blast.id));
        });
      } catch {
        historyRecorded = false;
        break; // Do not continue sending when successes cannot be audited.
      }
      if (i < recipients.length - 1) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (historyRecorded && skippedChanged) {
      try {
        await db.update(emailBlastsTable).set({
          recipientCount: sent + failed, sentCount: sent, failedCount: failed,
        }).where(eq(emailBlastsTable.id, blast.id));
      } catch {
        historyRecorded = false;
      }
    }
    res.json({ sent, total: nonresponders.length, skippedNoEmail: noEmail,
      skippedAlreadySent, skippedUncertain, skippedChanged, failed, historyRecorded });
  } finally {
    try {
      if (acquired) await lockClient.query("SELECT pg_advisory_unlock(602, $1)", [id]);
    } finally {
      lockClient.release();
    }
  }
}

export async function playerMatchRsvps(req: Request, res: Response): Promise<void> {
  const playerId = req.player!.id;
  const [squad] = await db.select({ teamId: playerParticipationsTable.teamId })
    .from(playerParticipationsTable)
    .innerJoin(seasonsTable, eq(seasonsTable.id, playerParticipationsTable.seasonId))
    .where(and(eq(playerParticipationsTable.playerId, playerId),
      eq(playerParticipationsTable.participationStatus, "active"),
      eq(seasonsTable.slug, CURRENT_SEASON))).limit(1);
  if (squad?.teamId == null) { res.json({ matches: [] }); return; }
  const fixtures = await db.select({ id: matchesTable.id }).from(matchesTable)
    .where(and(eq(matchesTable.teamId, squad.teamId),
      eq(matchesTable.operationalScope, "local_2026_27"),
      eq(matchesTable.status, "scheduled"), gt(matchesTable.kickoffAt, new Date())));
  if (!fixtures.length) { res.json({ matches: [] }); return; }
  const ids = fixtures.map((m) => m.id);
  const players = await eligiblePlayers(squad.teamId);
  const playerIds = players.map((p) => p.id);
  const rows = playerIds.length
    ? await db.select().from(matchRsvpsTable)
      .where(and(inArray(matchRsvpsTable.matchId, ids), inArray(matchRsvpsTable.playerId, playerIds)))
    : [];
  const matches = fixtures.map(({ id }) => {
    const counts: Record<Status, number> = { yes: 0, maybe: 0, no: 0 };
    for (const row of rows) if (row.matchId === id && STATUSES.includes(row.status as Status)) counts[row.status as Status]++;
    const mine = rows.find((row) => row.matchId === id && row.playerId === playerId);
    return { matchId: id, myRsvp: mine?.status ?? null, myNote: mine?.note ?? null, rsvpCounts: counts };
  });
  res.json({ matches });
}

export async function submitMatchRsvp(req: Request, res: Response): Promise<void> {
  const id = matchId(req);
  if (id == null) { res.status(400).json({ error: "Invalid match id" }); return; }
  const status = (req.body as { status?: unknown })?.status;
  if (typeof status !== "string" || !STATUSES.includes(status as Status)) {
    res.status(400).json({ error: "status must be yes, no or maybe" }); return;
  }
  const rawNote = (req.body as { note?: unknown })?.note;
  if (rawNote != null && typeof rawNote !== "string") {
    res.status(400).json({ error: "Invalid reason" }); return;
  }
  const note = status === "yes" ? null : (rawNote as string | undefined)?.trim() || null;
  if (status !== "yes" && !note) {
    res.status(400).json({ error: "A reason is required for Maybe or Not going" }); return;
  }
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id)).limit(1);
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.operationalScope !== "local_2026_27" || match.status !== "scheduled" || match.kickoffAt <= new Date()) {
    res.status(409).json({ error: "This match is not open for attendance replies" }); return;
  }
  const eligible = await eligiblePlayers(match.teamId);
  if (!eligible.some((p) => p.id === req.player!.id)) {
    res.status(403).json({ error: "Match not available to your current squad" }); return;
  }
  const now = new Date();
  await db.insert(matchRsvpsTable).values({ matchId: id, playerId: req.player!.id, status, note, respondedAt: now })
    .onConflictDoUpdate({
      target: [matchRsvpsTable.matchId, matchRsvpsTable.playerId],
      set: { status, note, respondedAt: now },
    });
  res.json({ matchId: id, status, note, respondedAt: now.toISOString() });
}

export async function adminMatchRsvps(req: Request, res: Response): Promise<void> {
  const id = matchId(req);
  if (id == null) { res.status(400).json({ error: "Invalid match id" }); return; }
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id)).limit(1);
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.operationalScope !== "local_2026_27") {
    res.status(409).json({ error: "Historical match attendance is unavailable" }); return;
  }
  const players = await eligiblePlayers(match.teamId);
  const rows = players.length
    ? await db.select().from(matchRsvpsTable)
      .where(and(eq(matchRsvpsTable.matchId, id), inArray(matchRsvpsTable.playerId, players.map((p) => p.id))))
    : [];
  const byPlayer = new Map(rows.map((r) => [r.playerId, r]));
  const counts: Record<Status, number> & { noResponse: number; invited: number } =
    { yes: 0, maybe: 0, no: 0, noResponse: 0, invited: players.length };
  const responses = players.flatMap((player) => {
    const row = byPlayer.get(player.id);
    if (!row) return [];
    if (STATUSES.includes(row.status as Status)) counts[row.status as Status]++;
    return [{ playerId: player.id, playerName: player.name, shirtNumber: player.shirtNumber,
      status: row.status, note: row.note, respondedAt: row.respondedAt.toISOString() }];
  });
  const noResponse = players.filter((p) => !byPlayer.has(p.id))
    .map((p) => ({ playerId: p.id, playerName: p.name, shirtNumber: p.shirtNumber }));
  counts.noResponse = noResponse.length;
  res.json({ counts, responses, noResponse });
}