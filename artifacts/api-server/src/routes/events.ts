import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, eventsTable, teamsTable, eventRsvpsTable, playersTable } from "@workspace/db";
import { eq, asc, sql, or, isNull, and, inArray } from "drizzle-orm";
import { requireAdminAccess, hasAdminAccess } from "../middleware/adminAuth";
import { requirePlayerSession } from "../middleware/playerSession";

const router: IRouter = Router();

// GET /api/events accepts either an admin session OR a player session.
// - Admin callers see every event with aggregated RSVP counts.
// - Player callers see only events visible to them (team-scoped or all-squad)
//   plus their own RSVP status per event.
function requireAdminOrPlayer(req: Request, res: Response, next: NextFunction) {
  if (hasAdminAccess(req)) {
    (req as Request & { isAdmin?: boolean }).isAdmin = true;
    return next();
  }
  return requirePlayerSession(req, res, next);
}

const ALLOWED_KINDS = ["training", "meeting", "social"] as const;
type EventKind = typeof ALLOWED_KINDS[number];

const ALLOWED_RSVP_STATUSES = ["yes", "no", "maybe"] as const;
type RsvpStatus = typeof ALLOWED_RSVP_STATUSES[number];

type RsvpCounts = { yes: number; no: number; maybe: number };

function emptyCounts(): RsvpCounts {
  return { yes: 0, no: 0, maybe: 0 };
}

function serialize(
  row: typeof eventsTable.$inferSelect,
  teamName?: string | null,
  extra: { myRsvp?: RsvpStatus | null; rsvpCounts?: RsvpCounts } = {},
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
    createdAt: row.createdAt.toISOString(),
    myRsvp: extra.myRsvp ?? null,
    rsvpCounts: extra.rsvpCounts ?? emptyCounts(),
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
  };
}

// Build a map of eventId → RsvpCounts in a single query.
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
    let entry = map.get(r.eventId);
    if (!entry) { entry = emptyCounts(); map.set(r.eventId, entry); }
    if (r.status === "yes" || r.status === "no" || r.status === "maybe") {
      entry[r.status] = Number(r.count);
    }
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

router.get("/", requireAdminOrPlayer, async (req, res) => {
  const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin === true;
  if (isAdmin) {
    const rows = await db
      .select({ event: eventsTable, teamName: teamsTable.name })
      .from(eventsTable)
      .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
      .orderBy(asc(eventsTable.startsAt));
    const counts = await loadRsvpCounts(rows.map((r) => r.event.id));
    return res.json(rows.map(({ event, teamName }) =>
      serialize(event, teamName, { rsvpCounts: counts.get(event.id) ?? emptyCounts() })
    ));
  }
  const filtered = await listEventsForPlayer(req.player!.teamId ?? null, req.player!.id);
  res.json(filtered);
});

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

// Admin: full roster for one event (yes/no/maybe with player names + teams).
router.get("/:id/rsvps", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const rows = await db
    .select({
      status: eventRsvpsTable.status,
      respondedAt: eventRsvpsTable.respondedAt,
      playerId: playersTable.id,
      playerName: playersTable.name,
      teamName: teamsTable.name,
    })
    .from(eventRsvpsTable)
    .innerJoin(playersTable, eq(eventRsvpsTable.playerId, playersTable.id))
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(eq(eventRsvpsTable.eventId, id))
    .orderBy(asc(playersTable.name));
  res.json({
    rsvps: rows.map((r) => ({
      playerId: r.playerId,
      playerName: r.playerName,
      teamName: r.teamName,
      status: r.status,
      respondedAt: r.respondedAt.toISOString(),
    })),
  });
});

// Player: upsert own RSVP for an event the player is allowed to see.
router.post("/:id/rsvp", requirePlayerSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid event id" });
  const status = String(req.body?.status ?? "");
  if (!ALLOWED_RSVP_STATUSES.includes(status as RsvpStatus)) {
    return res.status(400).json({ error: "status must be yes, no or maybe" });
  }
  // Check player can see this event (team-scoped or all-squads).
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) return res.status(404).json({ error: "Event not found" });
  const playerTeamId = req.player!.teamId;
  if (event.teamId !== null && event.teamId !== playerTeamId) {
    return res.status(403).json({ error: "Not your event" });
  }
  const respondedAt = new Date();
  await db
    .insert(eventRsvpsTable)
    .values({ eventId: id, playerId: req.player!.id, status, respondedAt })
    .onConflictDoUpdate({
      target: [eventRsvpsTable.eventId, eventRsvpsTable.playerId],
      set: { status, respondedAt },
    });
  res.json({ ok: true, eventId: id, status });
});

export async function listEventsForPlayer(playerTeamId: number | null, playerId: number) {
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
  const eventIds = rows.map((r) => r.event.id);
  const [counts, mine] = await Promise.all([
    loadRsvpCounts(eventIds),
    loadMyRsvps(playerId, eventIds),
  ]);
  return rows.map(({ event, teamName }) =>
    serialize(event, teamName, {
      myRsvp: mine.get(event.id) ?? null,
      rsvpCounts: counts.get(event.id) ?? emptyCounts(),
    })
  );
}

export default router;
