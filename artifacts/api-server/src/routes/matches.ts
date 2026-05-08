import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, teamsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  CreateMatchBody,
  UpdateMatchBody,
  UpdateMatchParams,
  DeleteMatchParams,
  ListMatchesQueryParams,
} from "@workspace/api-zod";
import { requireAdminAccess, hasAdminAccess } from "../middleware/adminAuth";
import { buildIcsCalendar, icsFilename } from "../utils/ics";

const router = Router();

type MatchRow = typeof matchesTable.$inferSelect;

function serialize(
  row: MatchRow,
  teamName?: string | null,
  teamCategory?: string | null,
  includeAdminFields = false,
) {
  return {
    id: row.id,
    teamId: row.teamId,
    teamName: teamName ?? undefined,
    teamCategory: teamCategory ?? undefined,
    opponent: row.opponent,
    kickoffAt: row.kickoffAt.toISOString(),
    venue: row.venue ?? undefined,
    ourScore: row.ourScore,
    theirScore: row.theirScore,
    status: row.status,
    notes: includeAdminFields ? (row.notes ?? undefined) : undefined,
    createdAt: row.createdAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const query = ListMatchesQueryParams.parse(req.query);
  const baseQuery = db
    .select({ match: matchesTable, teamName: teamsTable.name, teamCategory: teamsTable.category })
    .from(matchesTable)
    .leftJoin(teamsTable, eq(matchesTable.teamId, teamsTable.id))
    .orderBy(asc(matchesTable.kickoffAt));
  const rows = query.teamId
    ? await baseQuery.where(eq(matchesTable.teamId, query.teamId))
    : await baseQuery;
  const isAdmin = await hasAdminAccess(req);
  res.json(rows.map(({ match, teamName, teamCategory }) => serialize(match, teamName, teamCategory, isAdmin)));
});

router.get("/calendar.ics", async (req, res) => {
  const query = ListMatchesQueryParams.parse(req.query);
  const baseQuery = db
    .select({ match: matchesTable, teamName: teamsTable.name, teamCategory: teamsTable.category })
    .from(matchesTable)
    .leftJoin(teamsTable, eq(matchesTable.teamId, teamsTable.id))
    .orderBy(asc(matchesTable.kickoffAt));
  const rows = query.teamId
    ? await baseQuery.where(eq(matchesTable.teamId, query.teamId))
    : await baseQuery;

  const matches = rows.map(({ match, teamName, teamCategory }) => ({
    id: match.id,
    teamName,
    teamCategory,
    opponent: match.opponent,
    kickoffAt: match.kickoffAt,
    venue: match.venue,
    status: match.status as "scheduled" | "in_progress" | "final" | "cancelled",
    notes: null,
    ourScore: match.ourScore,
    theirScore: match.theirScore,
    createdAt: match.createdAt ?? null,
    updatedAt: match.createdAt ?? null,
  }));

  const teamLabel = matches[0]?.teamName || matches[0]?.teamCategory;
  const calendarName = query.teamId && teamLabel
    ? `HK ${teamLabel} – Rotterdam 2026`
    : "HK Masters Hockey – Rotterdam 2026";
  const ics = buildIcsCalendar(matches, { calendarName });

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Disposition", `inline; filename="${icsFilename(calendarName)}"`);
  res.send(ics);
});

router.get("/:id/calendar.ics", async (req, res) => {
  const { id } = UpdateMatchParams.parse(req.params);
  const [row] = await db
    .select({ match: matchesTable, teamName: teamsTable.name, teamCategory: teamsTable.category })
    .from(matchesTable)
    .leftJoin(teamsTable, eq(matchesTable.teamId, teamsTable.id))
    .where(eq(matchesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  const match = {
    id: row.match.id,
    teamName: row.teamName,
    teamCategory: row.teamCategory,
    opponent: row.match.opponent,
    kickoffAt: row.match.kickoffAt,
    venue: row.match.venue,
    status: row.match.status as "scheduled" | "in_progress" | "final" | "cancelled",
    notes: null,
    ourScore: row.match.ourScore,
    theirScore: row.match.theirScore,
    createdAt: row.match.createdAt ?? null,
    updatedAt: row.match.createdAt ?? null,
  };
  const label = `HK ${match.teamName || match.teamCategory || "Masters"} vs ${match.opponent}`;
  const ics = buildIcsCalendar([match], { calendarName: label });

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("Content-Disposition", `attachment; filename="${icsFilename(label)}"`);
  res.send(ics);
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreateMatchBody.parse(req.body);
  const kickoffDate = new Date(body.kickoffAt);
  if (Number.isNaN(kickoffDate.getTime())) {
    res.status(400).json({ error: "Invalid kickoffAt date" });
    return;
  }
  const [match] = await db.insert(matchesTable).values({
    teamId: body.teamId,
    opponent: body.opponent,
    kickoffAt: kickoffDate,
    venue: body.venue || null,
    ourScore: body.ourScore ?? null,
    theirScore: body.theirScore ?? null,
    status: body.status,
    notes: body.notes || null,
  }).returning();
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, match.teamId));
  res.status(201).json(serialize(match, team?.name, team?.category, true));
});

async function handleUpdateMatch(req: import("express").Request, res: import("express").Response) {
  const { id } = UpdateMatchParams.parse(req.params);
  const body = UpdateMatchBody.parse(req.body);
  const kickoffDate = new Date(body.kickoffAt);
  if (Number.isNaN(kickoffDate.getTime())) {
    res.status(400).json({ error: "Invalid kickoffAt date" });
    return;
  }
  const [match] = await db.update(matchesTable).set({
    teamId: body.teamId,
    opponent: body.opponent,
    kickoffAt: kickoffDate,
    venue: body.venue || null,
    ourScore: body.ourScore ?? null,
    theirScore: body.theirScore ?? null,
    status: body.status,
    notes: body.notes || null,
  }).where(eq(matchesTable.id, id)).returning();
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, match.teamId));
  res.json(serialize(match, team?.name, team?.category, true));
}

router.patch("/:id", requireAdminAccess, handleUpdateMatch);
router.put("/:id", requireAdminAccess, handleUpdateMatch);

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteMatchParams.parse(req.params);
  await db.delete(matchesTable).where(eq(matchesTable.id, id));
  res.status(204).send();
});

export default router;
