import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, announcementsTable, teamsTable } from "@workspace/db";
import { eq, desc, or, isNull } from "drizzle-orm";
import { requireAdminAccess, hasAdminAccess } from "../middleware/adminAuth";
import { requirePlayerSession } from "../middleware/playerSession";
import { sendPushToAll, sendPushToTeam } from "../utils/push";

const router: IRouter = Router();

async function requireAdminOrPlayer(req: Request, res: Response, next: NextFunction) {
  if (await hasAdminAccess(req)) {
    (req as Request & { isAdmin?: boolean }).isAdmin = true;
    return next();
  }
  return requirePlayerSession(req, res, next);
}

function serialize(row: typeof announcementsTable.$inferSelect, teamName?: string | null) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    teamId: row.teamId,
    teamName: teamName ?? null,
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseBody(body: unknown): {
  title: string;
  body: string;
  teamId: number | null;
  pinned: boolean;
  sendPush: boolean;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { error: "title required" };
  if (title.length > 200) return { error: "title too long (max 200)" };
  const messageBody = typeof b.body === "string" ? b.body.trim() : "";
  if (!messageBody) return { error: "body required" };
  let teamId: number | null = null;
  if (b.teamId !== null && b.teamId !== undefined && b.teamId !== "") {
    const n = Number(b.teamId);
    if (!Number.isInteger(n) || n <= 0) return { error: "Invalid teamId" };
    teamId = n;
  }
  const pinned = b.pinned === true || b.pinned === "true";
  const sendPush = b.sendPush !== false && b.sendPush !== "false";
  return { title, body: messageBody, teamId, pinned, sendPush };
}

router.get("/", requireAdminOrPlayer, async (req, res) => {
  const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin === true;
  const baseQuery = db
    .select({ a: announcementsTable, teamName: teamsTable.name })
    .from(announcementsTable)
    .leftJoin(teamsTable, eq(announcementsTable.teamId, teamsTable.id))
    .orderBy(desc(announcementsTable.pinned), desc(announcementsTable.createdAt));

  const rows = isAdmin
    ? await baseQuery
    : await baseQuery.where(
        req.player!.teamId == null
          ? isNull(announcementsTable.teamId)
          : or(isNull(announcementsTable.teamId), eq(announcementsTable.teamId, req.player!.teamId)),
      );

  res.json(rows.map(({ a, teamName }) => serialize(a, teamName)));
});

async function resolveTeam(teamId: number | null) {
  if (teamId == null) return { ok: true as const, team: null };
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) return { ok: false as const };
  return { ok: true as const, team };
}

router.post("/", requireAdminAccess, async (req, res) => {
  const parsed = parseBody(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const teamResult = await resolveTeam(parsed.teamId);
  if (!teamResult.ok) return res.status(400).json({ error: "Invalid teamId" });
  const [row] = await db.insert(announcementsTable).values({
    title: parsed.title,
    body: parsed.body,
    teamId: parsed.teamId,
    pinned: parsed.pinned,
  }).returning();

  if (parsed.sendPush) {
    const excerpt = parsed.body.length > 120 ? parsed.body.slice(0, 119) + "…" : parsed.body;
    const pushPayload = { title: parsed.title, body: excerpt, url: "/announcements" };
    if (parsed.teamId != null) {
      sendPushToTeam(parsed.teamId, pushPayload).catch(console.error);
    } else {
      sendPushToAll(pushPayload).catch(console.error);
    }
  }

  res.status(201).json(serialize(row, teamResult.team?.name));
});

router.patch("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const parsed = parseBody(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const teamResult = await resolveTeam(parsed.teamId);
  if (!teamResult.ok) return res.status(400).json({ error: "Invalid teamId" });
  const [row] = await db
    .update(announcementsTable)
    .set({
      title: parsed.title,
      body: parsed.body,
      teamId: parsed.teamId,
      pinned: parsed.pinned,
      updatedAt: new Date(),
    })
    .where(eq(announcementsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Announcement not found" });
  res.json(serialize(row, teamResult.team?.name));
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  res.status(204).send();
});

export default router;
