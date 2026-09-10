import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, teamsTable } from "@workspace/db/schema";
import { eq, asc, and } from "drizzle-orm";
import {
  CreateMatchBody,
  UpdateMatchBody,
  UpdateMatchParams,
  DeleteMatchParams,
  ListMatchesQueryParams,
} from "@workspace/api-zod";
import { requireAdminAccess, hasAdminAccess } from "../middleware/adminAuth";
import { buildIcsCalendar, icsFilename } from "../utils/ics";
import { isArchivedRotterdamTeam } from "../utils/archivedTeams";
import { getWorldCupTeamSnapshots } from "../utils/archivedTeams";

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
  const scope = req.query.scope === "world_cup_2026" ? "world_cup_2026" : "local_2026_27";
  const baseQuery = db
    .select({ match: matchesTable, teamName: teamsTable.name, teamCategory: teamsTable.category })
    .from(matchesTable)
    .leftJoin(teamsTable, eq(matchesTable.teamId, teamsTable.id))
    .orderBy(asc(matchesTable.kickoffAt));
  const rows = await baseQuery.where(and(
    eq(matchesTable.operationalScope, scope),
    query.teamId ? eq(matchesTable.teamId, query.teamId) : undefined,
  ));
  const isAdmin = await hasAdminAccess(req);
  const snapshots = scope === "world_cup_2026" ? await getWorldCupTeamSnapshots(rows.map((r) => r.match.teamId).filter((id): id is number => id != null)) : new Map();
  res.json(rows.map(({ match, teamName, teamCategory }) => {
    const snapshot = snapshots.get(match.teamId);
    return serialize(match, snapshot?.name ?? teamName, snapshot?.category ?? teamCategory, isAdmin);
  }));
});

router.get("/calendar.ics", async (req, res) => {
  const query = ListMatchesQueryParams.parse(req.query);
  const scope = req.query.scope === "world_cup_2026" ? "world_cup_2026" : "local_2026_27";
  const baseQuery = db
    .select({ match: matchesTable, teamName: teamsTable.name, teamCategory: teamsTable.category })
    .from(matchesTable)
    .leftJoin(teamsTable, eq(matchesTable.teamId, teamsTable.id))
    .orderBy(asc(matchesTable.kickoffAt));
  const rows = await baseQuery.where(and(
    eq(matchesTable.operationalScope, scope),
    query.teamId ? eq(matchesTable.teamId, query.teamId) : undefined,
  ));

  const snapshots = scope === "world_cup_2026" ? await getWorldCupTeamSnapshots(rows.map((r) => r.match.teamId).filter((id): id is number => id != null)) : new Map();
  const matches = rows.map(({ match, teamName, teamCategory }) => ({
    id: match.id,
    teamName: snapshots.get(match.teamId)?.name ?? teamName,
    teamCategory: snapshots.get(match.teamId)?.category ?? teamCategory,
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
    ? scope === "world_cup_2026"
      ? `HK ${teamLabel} – Rotterdam 2026`
      : `HK ${teamLabel}`
    : scope === "world_cup_2026"
      ? "HK Masters Hockey – Rotterdam 2026"
      : "HK Masters Hockey";
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
  const archiveSnapshot = row.match.operationalScope === "world_cup_2026"
    ? (await getWorldCupTeamSnapshots(row.match.teamId == null ? [] : [row.match.teamId])).get(row.match.teamId)
    : undefined;
  const match = {
    id: row.match.id,
    teamName: archiveSnapshot?.name ?? row.teamName,
    teamCategory: archiveSnapshot?.category ?? row.teamCategory,
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
  if (await isArchivedRotterdamTeam(body.teamId)) {
    res.status(409).json({ error: "Archived content is read-only" });
    return;
  }
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
    operationalScope: "local_2026_27",
    notes: body.notes || null,
  }).returning();
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, match.teamId));
  res.status(201).json(serialize(match, team?.name, team?.category, true));
});

async function handleUpdateMatch(req: import("express").Request, res: import("express").Response) {
  const { id } = UpdateMatchParams.parse(req.params);
  const [existing] = await db.select({ operationalScope: matchesTable.operationalScope }).from(matchesTable).where(eq(matchesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Match not found" });
  if (existing.operationalScope === "world_cup_2026") return res.status(409).json({ error: "Archived content is read-only" });
  if (existing.operationalScope == null) return res.status(409).json({ error: "Unclassified records must be classified before editing" });
  const body = UpdateMatchBody.parse(req.body);
  if (await isArchivedRotterdamTeam(body.teamId)) {
    return res.status(409).json({ error: "Archived content is read-only" });
  }
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
  return;
}

router.patch("/:id", requireAdminAccess, handleUpdateMatch);
router.put("/:id", requireAdminAccess, handleUpdateMatch);

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteMatchParams.parse(req.params);
  const [existing] = await db.select({ operationalScope: matchesTable.operationalScope }).from(matchesTable).where(eq(matchesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Match not found" });
  if (existing.operationalScope === "world_cup_2026") return res.status(409).json({ error: "Archived content is read-only" });
  if (existing.operationalScope == null) return res.status(409).json({ error: "Unclassified records must be classified before editing" });
  await db.delete(matchesTable).where(and(eq(matchesTable.id, id), eq(matchesTable.operationalScope, "local_2026_27")));
  res.status(204).send();
  return;
});

export default router;
