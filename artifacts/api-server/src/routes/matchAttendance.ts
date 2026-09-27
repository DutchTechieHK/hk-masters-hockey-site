import type { Request, Response } from "express";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import {
  db, matchesTable, matchRsvpsTable, playerParticipationsTable, playersTable, seasonsTable,
} from "@workspace/db";

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