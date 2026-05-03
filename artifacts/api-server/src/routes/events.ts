import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, eventsTable, teamsTable, eventRsvpsTable, playersTable, RSVP_STATUSES, type RsvpStatus } from "@workspace/db";
import { eq, asc, sql, or, isNull, and, inArray } from "drizzle-orm";
import { requireAdminAccess, hasAdminAccess } from "../middleware/adminAuth";
import { requirePlayerSession } from "../middleware/playerSession";

const router: IRouter = Router();

// GET /api/events accepts either an admin session OR a player session.
// - Admin callers see every event (used by the admin Events page).
// - Player callers see only events visible to them (team-scoped or all-squad).
function requireAdminOrPlayer(req: Request, res: Response, next: NextFunction) {
  if (hasAdminAccess(req)) {
    (req as Request & { isAdmin?: boolean }).isAdmin = true;
    return next();
  }
  return requirePlayerSession(req, res, next);
}

const ALLOWED_KINDS = ["training", "meeting", "social"] as const;
type EventKind = typeof ALLOWED_KINDS[number];

type RsvpCounts = { yes: number; no: number; maybe: number };

function emptyCounts(): RsvpCounts {
  return { yes: 0, no: 0, maybe: 0 };
}

function serialize(
  row: typeof eventsTable.$inferSelect,
  teamName?: string | null,
  extras?: { rsvpCounts?: RsvpCounts; myRsvp?: RsvpStatus | null },
) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    location: row.location,
    description: row.description,
    teamId: row.teamId,
    teamName: teamName ?? null,
    isPublic: row.isPublic,
    createdAt: row.createdAt.toISOString(),
    rsvpCounts: extras?.rsvpCounts ?? emptyCounts(),
    myRsvp: extras?.myRsvp ?? null,
  };
}

function parseBody(body: unknown): {
  kind: EventKind;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  description: string | null;
  teamId: number | null;
  isPublic: boolean;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const kind = String(b.kind ?? "");
  if (!ALLOWED_KINDS.includes(kind as EventKind)) {
    return { error: "kind must be training, meeting or social" };
  }
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { error: "title required" };
  const startsAtRaw = typeof b.startsAt === "string" ? b.startsAt : "";
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return { error: "Valid startsAt required" };
  let endsAt: Date | null = null;
  if (b.endsAt) {
    const d = new Date(String(b.endsAt));
    if (Number.isNaN(d.getTime())) return { error: "Invalid endsAt" };
    if (d.getTime() <= startsAt.getTime()) return { error: "endsAt must be after startsAt" };
    endsAt = d;
  }
  const teamIdRaw = b.teamId;
  let teamId: number | null = null;
  if (teamIdRaw !== null && teamIdRaw !== undefined && teamIdRaw !== "") {
    const n = Number(teamIdRaw);
    if (!Number.isInteger(n) || n <= 0) return { error: "Invalid teamId" };
    teamId = n;
  }
  return {
    kind: kind as EventKind,
    title,
    startsAt,
    endsAt,
    location: typeof b.location === "string" && b.location.trim() ? b.location.trim() : null,
    description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : null,
    teamId,
    isPublic: b.isPublic === true,
  };
}

// Aggregate RSVP counts grouped by event id for the supplied set of events.
async function loadRsvpCounts(eventIds: number[]): Promise<Map<number, RsvpCounts>> {
  const map = new Map<number, RsvpCounts>();
  if (eventIds.length === 0) return map;
  const rows = await db
    .select({
      eventId: eventRsvpsTable.eventId,
      status: eventRsvpsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(eventRsvpsTable)
    .where(inArray(eventRsvpsTable.eventId, eventIds))
    .groupBy(eventRsvpsTable.eventId, eventRsvpsTable.status);
  for (const r of rows) {
    const bucket = map.get(r.eventId) ?? emptyCounts();
    const s = r.status as RsvpStatus;
    if (s === "yes" || s === "no" || s === "maybe") {
      bucket[s] = Number(r.count);
    }
    map.set(r.eventId, bucket);
  }
  return map;
}

async function loadMyRsvps(playerId: number, eventIds: number[]): Promise<Map<number, RsvpStatus>> {
  const map = new Map<number, RsvpStatus>();
  if (eventIds.length === 0) return map;
  const rows = await db
    .select({ eventId: eventRsvpsTable.eventId, status: eventRsvpsTable.status })
    .from(eventRsvpsTable)
    .where(and(eq(eventRsvpsTable.playerId, playerId), inArray(eventRsvpsTable.eventId, eventIds)));
  for (const r of rows) {
    if (r.status === "yes" || r.status === "no" || r.status === "maybe") {
      map.set(r.eventId, r.status);
    }
  }
  return map;
}

// Public, unauthenticated: events explicitly marked as public, for the public website.
router.get("/public", (async (_req, res) => {
  const rows = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.isPublic, true))
    .orderBy(asc(eventsTable.startsAt));
  res.json(rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    location: r.location,
    description: r.description,
  })));
}) as (req: Request, res: Response) => Promise<void>);

router.get("/", requireAdminOrPlayer, (async (req, res) => {
  const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin === true;
  if (isAdmin) {
    const rows = await db
      .select({ event: eventsTable, teamName: teamsTable.name })
      .from(eventsTable)
      .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
      .orderBy(asc(eventsTable.startsAt));
    const counts = await loadRsvpCounts(rows.map((r) => r.event.id));
    res.json(rows.map(({ event, teamName }) =>
      serialize(event, teamName, { rsvpCounts: counts.get(event.id) ?? emptyCounts() })));
    return;
  }
  const filtered = await listEventsForPlayer(req.player?.teamId ?? null, req.player?.id ?? null);
  res.json(filtered);
}) as (req: Request, res: Response) => Promise<void>);

router.post("/", requireAdminAccess, async (req, res) => {
  const parsed = parseBody(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const [row] = await db.insert(eventsTable).values(parsed).returning();
  const team = parsed.teamId
    ? (await db.select().from(teamsTable).where(eq(teamsTable.id, parsed.teamId)))[0]
    : null;
  res.status(201).json(serialize(row, team?.name));
});

router.patch("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const parsed = parseBody(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const [row] = await db.update(eventsTable).set(parsed).where(eq(eventsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Event not found" });
  const team = parsed.teamId
    ? (await db.select().from(teamsTable).where(eq(teamsTable.id, parsed.teamId)))[0]
    : null;
  res.json(serialize(row, team?.name));
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  await db.delete(eventsTable).where(eq(eventsTable.id, id));
  res.status(204).send();
});

// Admin-only: roster of who RSVP'd what for a single event.
router.get("/:id/rsvps", requireAdminAccess, (async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const rows = await db
    .select({
      playerId: playersTable.id,
      playerName: playersTable.name,
      shirtNumber: playersTable.shirtNumber,
      teamId: playersTable.teamId,
      teamName: teamsTable.name,
      status: eventRsvpsTable.status,
      respondedAt: eventRsvpsTable.respondedAt,
    })
    .from(eventRsvpsTable)
    .innerJoin(playersTable, eq(playersTable.id, eventRsvpsTable.playerId))
    .leftJoin(teamsTable, eq(teamsTable.id, playersTable.teamId))
    .where(eq(eventRsvpsTable.eventId, id))
    .orderBy(asc(playersTable.name));

  // Players invited to this event = team-scoped players (or all if event is all-squads).
  const invitedQuery = event.teamId == null
    ? db.select({ id: playersTable.id, name: playersTable.name, teamId: playersTable.teamId, teamName: teamsTable.name, shirtNumber: playersTable.shirtNumber })
        .from(playersTable)
        .leftJoin(teamsTable, eq(teamsTable.id, playersTable.teamId))
        .orderBy(asc(playersTable.name))
    : db.select({ id: playersTable.id, name: playersTable.name, teamId: playersTable.teamId, teamName: teamsTable.name, shirtNumber: playersTable.shirtNumber })
        .from(playersTable)
        .leftJoin(teamsTable, eq(teamsTable.id, playersTable.teamId))
        .where(eq(playersTable.teamId, event.teamId))
        .orderBy(asc(playersTable.name));
  const invited = await invitedQuery;

  const responses = rows.map((r) => ({
    playerId: r.playerId,
    playerName: r.playerName,
    shirtNumber: r.shirtNumber,
    teamId: r.teamId,
    teamName: r.teamName ?? null,
    status: r.status,
    respondedAt: r.respondedAt.toISOString(),
  }));

  const respondedIds = new Set(responses.map((r) => r.playerId));
  const noResponse = invited
    .filter((p) => !respondedIds.has(p.id))
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      shirtNumber: p.shirtNumber,
      teamId: p.teamId,
      teamName: p.teamName ?? null,
    }));

  const counts = emptyCounts();
  for (const r of responses) {
    if (r.status === "yes" || r.status === "no" || r.status === "maybe") counts[r.status]++;
  }

  res.json({
    event: serialize(event, null, { rsvpCounts: counts }),
    counts: { ...counts, noResponse: noResponse.length, invited: invited.length },
    responses,
    noResponse,
  });
}) as (req: Request, res: Response) => Promise<void>);

// Player upserts their own RSVP for an event.
async function upsertOwnRsvp(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const status = String((req.body as { status?: unknown })?.status ?? "");
  if (!RSVP_STATUSES.includes(status as RsvpStatus)) {
    res.status(400).json({ error: "status must be yes, no or maybe" }); return;
  }
  const player = req.player!;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.teamId != null && event.teamId !== player.teamId) {
    res.status(403).json({ error: "Event not available to your team" }); return;
  }

  const now = new Date();
  await db.insert(eventRsvpsTable)
    .values({ eventId: id, playerId: player.id, status, respondedAt: now })
    .onConflictDoUpdate({
      target: [eventRsvpsTable.eventId, eventRsvpsTable.playerId],
      set: { status, respondedAt: now },
    });

  res.json({ eventId: id, status, respondedAt: now.toISOString() });
}

export const playerRsvpHandler = upsertOwnRsvp;

export async function listEventsForPlayer(playerTeamId: number | null, playerId: number | null) {
  const rows = await db
    .select({ event: eventsTable, teamName: teamsTable.name })
    .from(eventsTable)
    .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
    .where(
      playerTeamId == null
        ? isNull(eventsTable.teamId)
        : or(isNull(eventsTable.teamId), eq(eventsTable.teamId, playerTeamId)),
    )
    .orderBy(asc(eventsTable.startsAt));

  const ids = rows.map((r) => r.event.id);
  const counts = await loadRsvpCounts(ids);
  const mine = playerId != null ? await loadMyRsvps(playerId, ids) : new Map<number, RsvpStatus>();

  return rows.map(({ event, teamName }) =>
    serialize(event, teamName, {
      rsvpCounts: counts.get(event.id) ?? emptyCounts(),
      myRsvp: mine.get(event.id) ?? null,
    }),
  );
}

export default router;
