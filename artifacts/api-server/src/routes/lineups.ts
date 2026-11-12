import { Router, type Request, type Response, type NextFunction } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  db, matchLineupsTable, matchesTable, playersTable, playerParticipationsTable, seasonsTable,
  teamsTable, matchRsvpsTable, staffTeamGrantsTable, staffAuditTable,
  type LineupBoard, type LineupPerson,
} from "@workspace/db";
import {
  SaveMatchLineupBody, SetLineupPublicationBody, GetMatchLineupResponse, GetPublishedMatchLineupResponse,
} from "@workspace/api-zod";
import { hasAdminAccess } from "../middleware/adminAuth";
import { requirePlayerSession } from "../middleware/playerSession";
import { currentStaffSeason, requireStaff, StaffAccessError } from "../middleware/staffAccess";
import { getSessionLabel } from "../middleware/adminSession";
import { isArchivedRotterdamTeam } from "../utils/archivedTeams";
import { withLeagueNumbers } from "../utils/shirtNumbers";
import { placementIssues, suggestLineup, validatePlacements } from "../utils/lineups";

const router = Router();
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Saved = typeof matchLineupsTable.$inferSelect;
const EMPTY: LineupBoard = { formation: "4-3-3", players: [] };

function privateResponse(_req: Request, res: Response, next: NextFunction) {
  res.set("Cache-Control", "private, no-store");
  res.vary("X-Session-Token"); res.vary("Authorization"); res.vary("X-Player-Session");
  next();
}
async function staffOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (await hasAdminAccess(req)) { res.locals.lineupAdmin = true; next(); return; }
  await requireStaff(req, res, next);
}
function id(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new StaffAccessError(400, "Invalid match or team.");
  return number;
}

async function context(tx: Tx, req: Request, res: Response, writing = false) {
  const season = await currentStaffSeason();
  // Share locks serialize with grant revocation and season changes until this operation commits.
  const [current] = await tx.select().from(seasonsTable).where(eq(seasonsTable.id, season.id)).for("share");
  if (!current?.isCurrent || current.status !== "current") throw new StaffAccessError(403, "The active season changed. Reload your workspace.");
  const teamId = id(req.params.teamId);
  const [match] = await tx.select().from(matchesTable).where(eq(matchesTable.id, id(req.params.id))).for(writing ? "update" : "share");
  if (!match || match.teamId !== teamId) throw new StaffAccessError(404, "Match not found for this team.");
  const [team] = await tx.select().from(teamsTable).where(eq(teamsTable.id, teamId)).for("share");
  const date = match.kickoffAt.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  if (!team || team.isInternal || await isArchivedRotterdamTeam(teamId) ||
    match.operationalScope !== "local_2026_27" || (season.startsOn && date < season.startsOn) ||
    (season.endsOn && date > season.endsOn)) throw new StaffAccessError(403, "Lineups are only available for current-season local teams and matches.");
  let canEdit = Boolean(res.locals.lineupAdmin);
  if (!res.locals.lineupAdmin) {
    const [grant] = await tx.select().from(staffTeamGrantsTable).where(and(
      eq(staffTeamGrantsTable.playerId, req.staffIdentity!.playerId),
      eq(staffTeamGrantsTable.teamId, teamId), eq(staffTeamGrantsTable.seasonId, season.id), isNull(staffTeamGrantsTable.revokedAt),
    )).for("share");
    if (!grant) throw new StaffAccessError(403, "Your team access was revoked.");
    canEdit = grant.manageLineups;
  }
  canEdit = canEdit && match.status !== "cancelled" && match.status !== "final";
  if (writing && !canEdit) throw new StaffAccessError(403, "You do not have permission to manage lineups for this match.");
  const [saved] = await tx.select().from(matchLineupsTable).where(eq(matchLineupsTable.matchId, match.id));
  if (saved && (saved.teamId !== teamId || saved.seasonId !== season.id)) throw new StaffAccessError(409, "The match's team or season changed. Its old lineup cannot be reused.");
  return { season, match, saved, canEdit };
}

async function peopleFor(tx: Tx, teamId: number, seasonId: number): Promise<LineupPerson[]> {
  const people = await tx.select({
    playerId: playersTable.id, name: playersTable.name, position: playersTable.position,
  }).from(playerParticipationsTable).innerJoin(playersTable, eq(playersTable.id, playerParticipationsTable.playerId))
    .where(and(eq(playerParticipationsTable.seasonId, seasonId), eq(playerParticipationsTable.teamId, teamId),
      eq(playerParticipationsTable.participationStatus, "active"), eq(playersTable.memberStatus, "active")))
    .for("share");
  const numbered = await withLeagueNumbers(people.map((p) => ({ ...p, id: p.playerId, teamId, shirtNumber: null as number | null })), seasonId);
  return numbered.map((p) => ({ playerId: p.playerId, name: p.name, shirtNumber: p.shirtNumber, position: p.position, status: null }))
    .sort((a, b) => a.name.localeCompare(b.name, "en") || a.playerId - b.playerId);
}
async function matchPeople(tx: Tx, teamId: number, seasonId: number, matchId: number) {
  const people = await peopleFor(tx, teamId, seasonId);
  const replies = people.length ? await tx.select({ playerId: matchRsvpsTable.playerId, status: matchRsvpsTable.status })
    .from(matchRsvpsTable).where(and(eq(matchRsvpsTable.matchId, matchId), inArray(matchRsvpsTable.playerId, people.map((p) => p.playerId)))).for("share") : [];
  const statuses = new Map(replies.map((r) => [r.playerId, r.status]));
  return people.map((p) => {
    const status = statuses.get(p.playerId);
    return { ...p, status: status === "yes" || status === "maybe" || status === "no" ? status : null } as LineupPerson;
  });
}
function workspace(saved: Saved | undefined, people: LineupPerson[], canEdit: boolean) {
  const draft = saved?.draft ?? EMPTY;
  return GetMatchLineupResponse.parse({
    revision: saved?.revision ?? 0, draft, published: saved?.published ?? null,
    publishedAt: saved?.publishedAt?.toISOString() ?? null, updatedAt: saved?.updatedAt.toISOString() ?? null,
    canEdit, people, issues: placementIssues(draft, people),
    suggestions433: suggestLineup(people, "4-3-3"), suggestions343: suggestLineup(people, "3-4-3"),
  });
}
const staffPath = "/staff/teams/:teamId/matches/:id/lineup";
router.get(staffPath, privateResponse, staffOrAdmin, async (req, res): Promise<void> => {
  const result = await db.transaction(async (tx) => {
    const ctx = await context(tx, req, res);
    return workspace(ctx.saved, await matchPeople(tx, ctx.match.teamId, ctx.season.id, ctx.match.id), ctx.canEdit);
  });
  res.json(result);
});

router.put(staffPath, privateResponse, staffOrAdmin, async (req, res): Promise<void> => {
  const parsed = SaveMatchLineupBody.safeParse(req.body);
  if (!parsed.success) throw new StaffAccessError(400, "Invalid formation, placements or revision.");
  const input = parsed.data;
  const error = validatePlacements(input.placements);
  if (error || !Number.isSafeInteger(input.revision)) throw new StaffAccessError(400, error ?? "Invalid revision.");
  const actor = req.staffActor ?? await getSessionLabel(String(req.headers["x-session-token"] ?? "")) ?? "Full admin";
  const result = await db.transaction(async (tx) => {
    const ctx = await context(tx, req, res, true);
    if ((ctx.saved?.revision ?? 0) !== input.revision) throw new StaffAccessError(409, "This lineup changed. Your edits are kept; reload and review before saving.");
    const people = await matchPeople(tx, ctx.match.teamId, ctx.season.id, ctx.match.id);
    const byId = new Map(people.map((p) => [p.playerId, p]));
    const old = new Map(ctx.saved?.draft.players.map((p) => [p.playerId, p]) ?? []);
    const draft: LineupBoard = { formation: input.formation, players: input.placements.map((placement) => {
      const person = byId.get(placement.playerId);
      // Retain stale saved placements for review; never permit a newly added unavailable player.
      if (!person || person.status !== "yes" && person.status !== "maybe") {
        const previous = old.get(placement.playerId);
        if (!previous) throw new StaffAccessError(409, "Availability changed. Only Going or Maybe players can be added; refresh the pool.");
        return { ...previous, ...placement };
      }
      return { ...person, ...placement };
    }) };
    const values = { draft, revision: input.revision + 1, updatedAt: new Date(), updatedBy: actor };
    const [saved] = ctx.saved
      ? await tx.update(matchLineupsTable).set(values).where(and(eq(matchLineupsTable.matchId, ctx.match.id), eq(matchLineupsTable.revision, input.revision))).returning()
      : await tx.insert(matchLineupsTable).values({ ...values, matchId: ctx.match.id, teamId: ctx.match.teamId, seasonId: ctx.season.id }).returning();
    if (!saved) throw new StaffAccessError(409, "Lineup changed. Reload before saving.");
    await tx.insert(staffAuditTable).values({ actor, actorPlayerId: req.staffIdentity?.playerId, teamId: ctx.match.teamId,
      action: "lineup.saved", target: `match:${ctx.match.id};revision:${saved.revision}`, status: 200 });
    return workspace(saved, people, ctx.canEdit);
  });
  res.json(result);
});

router.post(`${staffPath}/publication`, privateResponse, staffOrAdmin, async (req, res): Promise<void> => {
  const parsed = SetLineupPublicationBody.safeParse(req.body);
  if (!parsed.success || !Number.isSafeInteger(parsed.data.revision)) throw new StaffAccessError(400, "A saved revision and publication action are required.");
  const { action, revision } = parsed.data;
  const actor = req.staffActor ?? await getSessionLabel(String(req.headers["x-session-token"] ?? "")) ?? "Full admin";
  const result = await db.transaction(async (tx) => {
    const ctx = await context(tx, req, res, true);
    if (!ctx.saved || ctx.saved.revision !== revision) throw new StaffAccessError(409, "The saved lineup changed. Reload and review before publishing.");
    const people = await matchPeople(tx, ctx.match.teamId, ctx.season.id, ctx.match.id);
    if (action === "publish" && (!ctx.saved.draft.players.some((p) => p.area === "pitch") || placementIssues(ctx.saved.draft, people).length))
      throw new StaffAccessError(409, "Review changed availability and save the draft before publishing. At least one player must be on the pitch.");
    const now = new Date();
    const [saved] = await tx.update(matchLineupsTable).set({
      published: action === "publish" ? ctx.saved.draft : null,
      publishedAt: action === "publish" ? now : null, revision: revision + 1, updatedAt: now, updatedBy: actor,
    }).where(and(eq(matchLineupsTable.matchId, ctx.match.id), eq(matchLineupsTable.revision, revision))).returning();
    if (!saved) throw new StaffAccessError(409, "Lineup changed. Reload before publishing.");
    await tx.insert(staffAuditTable).values({ actor, actorPlayerId: req.staffIdentity?.playerId, teamId: ctx.match.teamId,
      action: `lineup.${action === "publish" ? "published" : "withdrawn"}`, target: `match:${ctx.match.id};revision:${saved.revision}`, status: 200 });
    return workspace(saved, people, ctx.canEdit);
  });
  res.json(result);
});

router.get("/player-auth/matches/:id/lineup", privateResponse, requirePlayerSession, async (req, res): Promise<void> => {
  const result = await db.transaction(async (tx) => {
    const season = await currentStaffSeason();
    const [match] = await tx.select().from(matchesTable).where(eq(matchesTable.id, id(req.params.id))).for("share");
    if (!match || match.operationalScope !== "local_2026_27" || match.status === "cancelled") throw new StaffAccessError(404, "Lineup not available.");
    const [team] = await tx.select({ internal: teamsTable.isInternal }).from(teamsTable).where(eq(teamsTable.id, match.teamId));
    const date = match.kickoffAt.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
    if (!team || team.internal || (season.startsOn && date < season.startsOn) || (season.endsOn && date > season.endsOn))
      throw new StaffAccessError(404, "Lineup not available for this season.");
    const [eligible] = await tx.select({ id: playersTable.id }).from(playerParticipationsTable)
      .innerJoin(playersTable, eq(playersTable.id, playerParticipationsTable.playerId))
      .where(and(eq(playerParticipationsTable.seasonId, season.id), eq(playerParticipationsTable.teamId, match.teamId),
        eq(playerParticipationsTable.playerId, req.player!.id), eq(playerParticipationsTable.participationStatus, "active"),
        eq(playersTable.memberStatus, "active"))).for("share");
    if (!eligible || await isArchivedRotterdamTeam(match.teamId)) throw new StaffAccessError(403, "This lineup is not available to your current squad.");
    const [saved] = await tx.select({ published: matchLineupsTable.published, publishedAt: matchLineupsTable.publishedAt })
      .from(matchLineupsTable).where(and(eq(matchLineupsTable.matchId, match.id), eq(matchLineupsTable.teamId, match.teamId), eq(matchLineupsTable.seasonId, season.id)));
    return GetPublishedMatchLineupResponse.parse({ published: saved?.published ?? null, publishedAt: saved?.publishedAt?.toISOString() ?? null });
  });
  res.json(result);
});

export default router;
