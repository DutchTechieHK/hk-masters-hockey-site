import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, eventsTable, teamsTable } from "@workspace/db";
import { eq, asc, sql, or, isNull } from "drizzle-orm";
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

function serialize(row: typeof eventsTable.$inferSelect, teamName?: string | null) {
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

router.get("/", requireAdminOrPlayer, async (req, res) => {
  const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin === true;
  if (isAdmin) {
    const rows = await db
      .select({ event: eventsTable, teamName: teamsTable.name })
      .from(eventsTable)
      .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
      .orderBy(asc(eventsTable.startsAt));
    return res.json(rows.map(({ event, teamName }) => serialize(event, teamName)));
  }
  // Player path — scope to their team + all-squad events.
  const filtered = await listEventsForPlayer(req.player?.teamId ?? null);
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

export async function listEventsForPlayer(playerTeamId: number | null) {
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
  return rows.map(({ event, teamName }) => serialize(event, teamName));
}

export default router;
