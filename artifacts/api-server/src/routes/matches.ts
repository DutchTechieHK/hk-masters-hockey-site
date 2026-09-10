import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable, matchesTable, teamsTable } from "@workspace/db/schema";
import { eq, asc, and, inArray, isNull } from "drizzle-orm";
import {
  CreateMatchBody,
  CorrectSeptemberHktImportResponse,
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

const SEPTEMBER_HKT_IMPORT = [
  { id: 11, teamId: 5, opponent: "KCC B", importedKickoff: "2026-10-09T12:30:00.000Z", correctedKickoff: "2026-10-09T06:30:00.000Z" },
  { id: 12, teamId: 5, opponent: "Dutch A", importedKickoff: "2026-10-16T12:30:00.000Z", correctedKickoff: "2026-10-16T06:30:00.000Z" },
  { id: 13, teamId: 5, opponent: "HKCC A", importedKickoff: "2026-10-23T12:30:00.000Z", correctedKickoff: "2026-10-23T06:30:00.000Z" },
  { id: 14, teamId: 5, opponent: "HKFC C", importedKickoff: "2026-11-13T13:30:00.000Z", correctedKickoff: "2026-11-13T07:30:00.000Z" },
  { id: 15, teamId: 5, opponent: "Valley A", importedKickoff: "2026-10-02T12:30:00.000Z", correctedKickoff: "2026-10-02T06:30:00.000Z" },
  { id: 16, teamId: 5, opponent: "HKFC B", importedKickoff: "2026-10-30T13:30:00.000Z", correctedKickoff: "2026-10-30T07:30:00.000Z" },
  { id: 17, teamId: 5, opponent: "Antlers B", importedKickoff: "2026-11-06T13:30:00.000Z", correctedKickoff: "2026-11-06T07:30:00.000Z" },
  { id: 18, teamId: 5, opponent: "Khalsa B", importedKickoff: "2026-11-20T13:30:00.000Z", correctedKickoff: "2026-11-20T07:30:00.000Z" },
] as const;

const SEPTEMBER_TRIAL_EVENTS = [
  { id: 90, kind: "training", title: "MASTERS TRIALS", startsAt: "2026-09-18T12:00:00.000Z", endsAt: "2026-09-18T13:30:00.000Z" },
  { id: 91, kind: "training", title: "MASTERS TRIALS", startsAt: "2026-09-25T12:00:00.000Z", endsAt: "2026-09-25T13:30:00.000Z" },
] as const;

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

router.post("/correct-september-hkt-import", requireAdminAccess, async (req, res): Promise<void> => {
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(matchesTable)
      .where(inArray(matchesTable.id, SEPTEMBER_HKT_IMPORT.map(({ id }) => id)));
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    let correctedCount = 0;
    let alreadyCorrectCount = 0;
    let classifiedEventCount = 0;
    let alreadyClassifiedEventCount = 0;

    for (const expected of SEPTEMBER_HKT_IMPORT) {
      const row = rowsById.get(expected.id);
      const isImported = row?.kickoffAt.toISOString() === expected.importedKickoff && row.operationalScope == null;
      const isCorrect = row?.kickoffAt.toISOString() === expected.correctedKickoff && row.operationalScope === "local_2026_27";
      const hasExpectedIdentity = row?.teamId === expected.teamId && row.opponent === expected.opponent;

      if (!row || !hasExpectedIdentity || (!isImported && !isCorrect)) {
        throw new Error(`Match ${expected.id} no longer matches the September 2026 import batch`);
      }
      if (isCorrect) {
        alreadyCorrectCount += 1;
        continue;
      }

      const [updated] = await tx
        .update(matchesTable)
        .set({
          kickoffAt: new Date(expected.correctedKickoff),
          operationalScope: "local_2026_27",
        })
        .where(and(
          eq(matchesTable.id, expected.id),
          eq(matchesTable.kickoffAt, new Date(expected.importedKickoff)),
          isNull(matchesTable.operationalScope),
        ))
        .returning();
      if (!updated) {
        throw new Error(`Match ${expected.id} changed while the correction was being applied`);
      }
      rowsById.set(updated.id, updated);
      correctedCount += 1;
    }

    const eventRows = await tx
      .select()
      .from(eventsTable)
      .where(inArray(eventsTable.id, SEPTEMBER_TRIAL_EVENTS.map(({ id }) => id)));
    const eventsById = new Map(eventRows.map((row) => [row.id, row]));

    for (const expected of SEPTEMBER_TRIAL_EVENTS) {
      const event = eventsById.get(expected.id);
      const hasExpectedIdentity = event?.kind === expected.kind
        && event.title === expected.title
        && event.startsAt.toISOString() === expected.startsAt
        && event.endsAt?.toISOString() === expected.endsAt;
      const isUnclassified = event?.operationalScope == null;
      const isCurrent = event?.operationalScope === "local_2026_27";

      if (!event || !hasExpectedIdentity || (!isUnclassified && !isCurrent)) {
        throw new Error(`Event ${expected.id} no longer matches the September 2026 trial batch`);
      }
      if (isCurrent) {
        alreadyClassifiedEventCount += 1;
        continue;
      }

      const [updated] = await tx
        .update(eventsTable)
        .set({ operationalScope: "local_2026_27" })
        .where(and(eq(eventsTable.id, expected.id), isNull(eventsTable.operationalScope)))
        .returning({ id: eventsTable.id });
      if (!updated) {
        throw new Error(`Event ${expected.id} changed while the correction was being applied`);
      }
      classifiedEventCount += 1;
    }

    return {
      correctedCount,
      alreadyCorrectCount,
      classifiedEventCount,
      alreadyClassifiedEventCount,
      matches: SEPTEMBER_HKT_IMPORT.map(({ id }) => serialize(rowsById.get(id)!, undefined, undefined, true)),
    };
  }).catch((error: unknown) => {
    console.warn("[matches] September HKT match correction rejected", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (!result) {
    res.status(409).json({ error: "The affected matches no longer match the known September 2026 import batch. No records were changed." });
    return;
  }
  console.info("[matches] September match and trial event correction applied", {
    correctedCount: result.correctedCount,
    alreadyCorrectCount: result.alreadyCorrectCount,
    classifiedEventCount: result.classifiedEventCount,
    alreadyClassifiedEventCount: result.alreadyClassifiedEventCount,
  });
  res.json(CorrectSeptemberHktImportResponse.parse(result));
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
