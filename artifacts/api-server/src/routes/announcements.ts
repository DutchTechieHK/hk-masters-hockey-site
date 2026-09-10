import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, announcementsTable, teamsTable } from "@workspace/db";
import { and, eq, desc, or, isNull } from "drizzle-orm";
import { requireAdminAccess, hasAdminAccess } from "../middleware/adminAuth";
import { requirePlayerSession } from "../middleware/playerSession";
import { sendPushToAll, sendPushToMembershipSection, sendPushToTeam } from "../utils/push";

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
    membershipSection: row.membershipSection,
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseBody(body: unknown): {
  title: string;
  body: string;
  teamId: number | null;
  membershipSection: "men" | "women" | null;
  pinned: boolean;
  sendPush: boolean;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { error: "title required" };
  if (title.length > 200) return { error: "title too long (max 200)" };
  const rawBody = typeof b.body === "string" ? b.body.trim() : "";
  const messageBody = stripHtml(rawBody);
  if (!messageBody) return { error: "body required" };
  let teamId: number | null = null;
  if (b.teamId !== null && b.teamId !== undefined && b.teamId !== "") {
    const n = Number(b.teamId);
    if (!Number.isInteger(n) || n <= 0) return { error: "Invalid teamId" };
    teamId = n;
  }
  const membershipSection =
    b.membershipSection === "men" || b.membershipSection === "women"
      ? b.membershipSection
      : null;
  if (
    b.membershipSection !== null &&
    b.membershipSection !== undefined &&
    b.membershipSection !== "" &&
    membershipSection === null
  ) {
    return { error: "Invalid membershipSection" };
  }
  if (teamId !== null && membershipSection !== null) {
    return { error: "Choose either a squad or a membership section" };
  }
  const pinned = b.pinned === true || b.pinned === "true";
  const sendPush = b.sendPush !== false && b.sendPush !== "false";
  return { title, body: messageBody, teamId, membershipSection, pinned, sendPush };
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
        or(
          and(
            isNull(announcementsTable.teamId),
            isNull(announcementsTable.membershipSection),
          ),
          req.player!.teamId == null
            ? undefined
            : eq(announcementsTable.teamId, req.player!.teamId),
          eq(announcementsTable.membershipSection, req.player!.currentMembershipSection),
        ),
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
    membershipSection: parsed.membershipSection,
    pinned: parsed.pinned,
  }).returning();

  if (parsed.sendPush) {
    const excerpt = parsed.body.length > 120 ? parsed.body.slice(0, 119) + "…" : parsed.body;
    const pushPayload = { title: parsed.title, body: excerpt, url: "/announcements" };
    if (parsed.teamId != null) {
      sendPushToTeam(parsed.teamId, pushPayload).catch(console.error);
    } else if (parsed.membershipSection != null) {
      sendPushToMembershipSection(parsed.membershipSection, pushPayload).catch(console.error);
    } else {
      sendPushToAll(pushPayload).catch(console.error);
    }
  }

  return res.status(201).json(serialize(row, teamResult.team?.name));
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
      membershipSection: parsed.membershipSection,
      pinned: parsed.pinned,
      updatedAt: new Date(),
    })
    .where(eq(announcementsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Announcement not found" });
  return res.json(serialize(row, teamResult.team?.name));
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  return res.status(204).send();
});

export default router;
