import crypto from "crypto";
import { withLeagueNumbers } from "../utils/shirtNumbers";
import { Router, type Request, type Response } from "express";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db, staffTeamGrantsTable, staffSessionsTable, staffAuditTable, playersTable,
  teamsTable, playerParticipationsTable, eventsTable, matchesTable, eventRsvpsTable,
  matchRsvpsTable,
} from "@workspace/db";
import { SaveStaffGrantBody, RevokeStaffGrantBody, CorrectStaffAttendanceBody } from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";
import { getSessionLabel } from "../middleware/adminSession";
import { requirePlayerSession } from "../middleware/playerSession";
import { assertStaffResource, currentStaffSeason, lookupStaffIdentity, requireStaff, requireStaffTeam, StaffAccessError } from "../middleware/staffAccess";
import { isArchivedRotterdamTeam } from "../utils/archivedTeams";
import { createLocalMatch, handleUpdateMatch } from "./matches";
import { createLocalEvent, updateLocalEvent, listEventInvitees } from "./events";
import { adminCorrectMatchRsvp, eligiblePlayersForTeams, remindMatchNonresponders } from "./matchAttendance";
import { remindStaffEvent } from "../utils/staffEventReminders";

const router = Router();
router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); res.vary("X-Session-Token"); next(); });

async function adminActor(req: Request) {
  const token = req.headers["x-session-token"];
  return typeof token === "string" ? await getSessionLabel(token) ?? "Full admin" : "Admin API key";
}

router.post("/session", requirePlayerSession, async (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(staffSessionsTable).values({
    token, playerId: req.player!.id, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
  });
  const identity = await lookupStaffIdentity(token);
  if (!identity) {
    await db.delete(staffSessionsTable).where(eq(staffSessionsTable.token, token));
    res.status(403).json({ error: "No current team staff access is assigned to your account. Please contact a full administrator." }); return;
  }
  res.json({ token });
});
router.delete("/session", async (req, res) => {
  const token = req.headers["x-session-token"];
  if (typeof token === "string") await db.delete(staffSessionsTable).where(eq(staffSessionsTable.token, token));
  res.status(204).send();
});
router.get("/me", requireStaff, (req, res) => { res.json(req.staffIdentity); });

router.get("/access", requireAdminAccess, async (_req, res) => {
  const season = await currentStaffSeason();
  const [members, teams, grants, audit] = await Promise.all([
    db.select({ id: playersTable.id, name: playersTable.name, email: playersTable.email, memberStatus: playersTable.memberStatus })
      .from(playersTable).orderBy(asc(playersTable.name)),
    db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.isInternal, false)).orderBy(asc(teamsTable.name)),
    db.select({ grant: staffTeamGrantsTable, playerName: playersTable.name, teamName: teamsTable.name })
      .from(staffTeamGrantsTable).innerJoin(playersTable, eq(playersTable.id, staffTeamGrantsTable.playerId))
      .innerJoin(teamsTable, eq(teamsTable.id, staffTeamGrantsTable.teamId))
      .where(eq(staffTeamGrantsTable.seasonId, season.id)).orderBy(asc(playersTable.name), asc(teamsTable.name)),
    db.select().from(staffAuditTable).orderBy(desc(staffAuditTable.id)).limit(100),
  ]);
  const eligibleTeams = [];
  for (const team of teams) if (!await isArchivedRotterdamTeam(team.id)) eligibleTeams.push(team);
  res.json({
    seasonId: season.id, seasonName: season.name, members, teams: eligibleTeams,
    grants: grants.map(({ grant, playerName, teamName }) => ({ ...grant, playerName, teamName, revokedAt: grant.revokedAt?.toISOString() ?? null })),
    audit: audit.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  });
});

router.put("/access/grants", requireAdminAccess, async (req, res) => {
  const parsed = SaveStaffGrantBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Select a member, team, role and valid permissions/version." }); return; }
  const input = parsed.data;
  if (![input.playerId, input.teamId, input.seasonId, input.version].every(Number.isSafeInteger)) {
    throw new StaffAccessError(400, "Member, team, season and version must be whole-number identifiers.");
  }
  const season = await currentStaffSeason();
  if (input.seasonId !== season.id) throw new StaffAccessError(409, "The current season changed. Reload before assigning access.");
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, input.teamId));
  if (!team || team.isInternal || await isArchivedRotterdamTeam(team.id)) throw new StaffAccessError(400, "Choose a current, non-archived team.");
  const actor = await adminActor(req);
  await db.transaction(async (tx) => {
    const [member] = await tx.select().from(playersTable).where(eq(playersTable.id, input.playerId)).for("share");
    if (!member || member.memberStatus !== "active" || !member.email.trim()) throw new StaffAccessError(400, "Choose an active member with a unique email address.");
    const matches = await tx.select({ id: playersTable.id }).from(playersTable).where(and(
      eq(playersTable.memberStatus, "active"), sql`lower(trim(${playersTable.email})) = ${member.email.trim().toLowerCase()}`,
    ));
    if (matches.length !== 1) throw new StaffAccessError(400, "This email belongs to multiple active members. Resolve it before granting access.");
    const [existing] = await tx.select().from(staffTeamGrantsTable).where(and(
      eq(staffTeamGrantsTable.playerId, input.playerId), eq(staffTeamGrantsTable.teamId, input.teamId),
      eq(staffTeamGrantsTable.seasonId, season.id),
    )).for("update");
    if ((existing?.version ?? 0) !== input.version) throw new StaffAccessError(409, "Access changed since you opened it. Reload before saving.");
    const values = { roleLabel: input.roleLabel, manageAttendance: input.manageAttendance, manageSchedule: input.manageSchedule, revokedAt: null, updatedAt: new Date() };
    if (existing) {
      await tx.update(staffTeamGrantsTable).set({ ...values, version: existing.version + 1 }).where(eq(staffTeamGrantsTable.id, existing.id));
    } else {
      const inserted = await tx.insert(staffTeamGrantsTable).values({
        ...values, playerId: input.playerId, teamId: input.teamId, seasonId: season.id,
      }).onConflictDoNothing().returning({ id: staffTeamGrantsTable.id });
      if (!inserted.length) throw new StaffAccessError(409, "Access was created by another administrator. Reload before saving.");
    }
    await tx.insert(staffAuditTable).values({
      actor, teamId: input.teamId, action: existing ? "access.updated" : "access.granted",
      target: `member:${input.playerId};season:${season.id};role:${input.roleLabel};attendance:${input.manageAttendance};schedule:${input.manageSchedule}`,
      status: 200,
    });
  });
  res.json({ ok: true });
});

router.post("/access/grants/:grantId/revoke", requireAdminAccess, async (req, res) => {
  const parsed = RevokeStaffGrantBody.safeParse(req.body);
  const id = Number(req.params.grantId);
  if (!parsed.success || !Number.isSafeInteger(parsed.data.version) || !Number.isSafeInteger(id) || id < 1) throw new StaffAccessError(400, "A valid grant and version are required.");
  const actor = await adminActor(req);
  await db.transaction(async (tx) => {
    const [grant] = await tx.update(staffTeamGrantsTable).set({
      revokedAt: new Date(), version: sql`${staffTeamGrantsTable.version} + 1`, updatedAt: new Date(),
    }).where(and(eq(staffTeamGrantsTable.id, id), eq(staffTeamGrantsTable.version, parsed.data.version), isNull(staffTeamGrantsTable.revokedAt))).returning();
    if (!grant) throw new StaffAccessError(409, "Access changed or was already revoked. Reload the access list.");
    await tx.insert(staffAuditTable).values({ actor, teamId: grant.teamId, action: "access.revoked", target: `member:${grant.playerId};season:${grant.seasonId}`, status: 200 });
  });
  res.status(204).send();
});

// No legacy full-admin handler can be reached below without a current staff
// identity, a team grant, and the matching capability.
router.use("/teams", requireStaff);

async function roster(teamId: number, seasonId: number) {
  const rows = await db.select({ id: playersTable.id, name: playersTable.name, shirtNumber: playersTable.shirtNumber, position: playersTable.position })
    .from(playersTable).leftJoin(playerParticipationsTable, and(
      eq(playerParticipationsTable.playerId, playersTable.id), eq(playerParticipationsTable.seasonId, seasonId),
      eq(playerParticipationsTable.participationStatus, "active"),
    )).where(and(eq(playersTable.memberStatus, "active"),
      sql`coalesce(${playerParticipationsTable.teamId}, ${playersTable.teamId}) = ${teamId}`,
    )).orderBy(asc(playersTable.name));
  return (await withLeagueNumbers(rows.map((p) => ({ ...p, teamId })), seasonId)).map(({ teamId: _teamId, ...p }) => p);
}

const privateEvent = (teamId: number) => and(eq(eventsTable.teamId, teamId), eq(eventsTable.operationalScope, "local_2026_27"), eq(eventsTable.audienceMode, "squad"), eq(eventsTable.isPublic, false));

router.get("/teams/:teamId", requireStaffTeam("view"), async (req, res) => {
  const teamId = req.staffTeamId!;
  const [people, matches, events] = await Promise.all([
    roster(teamId, req.staffIdentity!.seasonId),
    db.select({ id: matchesTable.id, teamId: matchesTable.teamId, opponent: matchesTable.opponent, kickoffAt: matchesTable.kickoffAt, venue: matchesTable.venue, status: matchesTable.status, ourScore: matchesTable.ourScore, theirScore: matchesTable.theirScore, notes: matchesTable.notes }).from(matchesTable)
      .where(and(eq(matchesTable.teamId, teamId), eq(matchesTable.operationalScope, "local_2026_27"))).orderBy(asc(matchesTable.kickoffAt)),
    db.select({ id: eventsTable.id, kind: eventsTable.kind, title: eventsTable.title, startsAt: eventsTable.startsAt, endsAt: eventsTable.endsAt, location: eventsTable.location, description: eventsTable.description, teamId: eventsTable.teamId, createdAt: eventsTable.createdAt }).from(eventsTable).where(privateEvent(teamId)).orderBy(asc(eventsTable.startsAt)),
  ]);
  res.json({
    roster: people,
    matches: matches.map((m) => ({ ...m, kickoffAt: m.kickoffAt.toISOString() })),
    events: events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null, audienceMode: "squad", groupIds: [], isPublic: false, createdAt: e.createdAt.toISOString() })),
  });
});

async function resource(req: Request) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new StaffAccessError(400, "Invalid record.");
  if (req.params.resource === "matches") {
    const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
    if (!row) throw new StaffAccessError(404, "Match not found.");
    assertStaffResource(req, row);
    return { type: "matches" as const, row };
  }
  if (req.params.resource === "events") {
    const [row] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
    if (!row) throw new StaffAccessError(404, "Event not found.");
    assertStaffResource(req, row);
    return { type: "events" as const, row };
  }
  throw new StaffAccessError(404, "Unknown attendance resource.");
}

router.get("/teams/:teamId/:resource/:id/attendance", requireStaffTeam("view"), async (req, res) => {
  const record = await resource(req);
  const invited = record.type === "matches" ? await eligiblePlayersForTeams([req.staffTeamId!]) : await listEventInvitees(record.row, true);
  const ids = invited.map((p) => p.id);
  const replies = !ids.length ? [] : record.type === "matches"
    ? await db.select({ playerId: matchRsvpsTable.playerId, status: matchRsvpsTable.status, note: matchRsvpsTable.note, id: matchRsvpsTable.id, revision: matchRsvpsTable.revision }).from(matchRsvpsTable).where(and(eq(matchRsvpsTable.matchId, record.row.id), inArray(matchRsvpsTable.playerId, ids)))
    : await db.select({ playerId: eventRsvpsTable.playerId, status: eventRsvpsTable.status, note: eventRsvpsTable.note, id: eventRsvpsTable.id, revision: eventRsvpsTable.revision }).from(eventRsvpsTable).where(and(eq(eventRsvpsTable.eventId, record.row.id), inArray(eventRsvpsTable.playerId, ids)));
  const byId = new Map(replies.map((r) => [r.playerId, r]));
  const counts = { yes: 0, maybe: 0, no: 0, noResponse: 0, invited: invited.length };
  const people = invited.map((p) => {
    const reply = byId.get(p.id);
    if (!reply) counts.noResponse++;
    else if (reply.status === "yes" || reply.status === "no" || reply.status === "maybe") counts[reply.status]++;
    return { playerId: p.id, playerName: p.name, shirtNumber: p.shirtNumber, status: reply?.status ?? null, note: reply?.note ?? null, expected: reply ? { id: reply.id, revision: reply.revision } : null };
  });
  res.json({ counts, people });
});

// Persist an attributable attempt before touching data/delivering messages.
// Buffer the response so the final outcome is recorded before it is returned.
async function audited(req: Request, res: Response, action: string, handler: (req: Request, res: Response) => unknown) {
  const [entry] = await db.insert(staffAuditTable).values({
    actor: req.staffActor!, actorPlayerId: req.staffIdentity!.playerId, teamId: req.staffTeamId!,
    action, target: req.path, status: null,
  }).returning({ id: staffAuditTable.id });
  const original = res.json;
  let body: unknown;
  let hasBody = false;
  res.json = function (value) { body = value; hasBody = true; return this; };
  try {
    await handler(req, res);
    const targetId = body && typeof body === "object" && "id" in body ? String(body.id) : null;
    await db.update(staffAuditTable).set({ status: res.statusCode, ...(targetId ? { target: `${req.path};record:${targetId}` } : {}) }).where(eq(staffAuditTable.id, entry.id));
  } catch (error) {
    await db.update(staffAuditTable).set({ status: error instanceof StaffAccessError ? error.status : 500 }).where(eq(staffAuditTable.id, entry.id));
    throw error;
  } finally { res.json = original; }
  if (hasBody) res.json(body);
}

router.put("/teams/:teamId/:resource/:id/attendance/:playerId", requireStaffTeam("attendance"), async (req, res) => {
  const record = await resource(req);
  const parsed = CorrectStaffAttendanceBody.safeParse(req.body);
  if (!parsed.success) throw new StaffAccessError(400, "A valid reply and expected version are required.");
  if (parsed.data.expected !== null && (!Number.isSafeInteger(parsed.data.expected.id) || parsed.data.expected.id < 1 ||
    !Number.isSafeInteger(parsed.data.expected.revision) || parsed.data.expected.revision < 1)) {
    throw new StaffAccessError(400, "A valid expected reply version is required.");
  }
  req.body = parsed.data;
  if (record.type === "matches") {
    await audited(req, res, "match.attendance.corrected", adminCorrectMatchRsvp); return;
  }
  await audited(req, res, "event.attendance.corrected", async (_req, response) => {
    const input = parsed.data;
    const playerId = Number(req.params.playerId);
    const note = input.status === "yes" || input.status === null ? null : input.note?.trim() || null;
    if (!Number.isSafeInteger(playerId) || playerId < 1 || (input.status !== "yes" && input.status !== null && !note)) throw new StaffAccessError(400, "Maybe and Not going need a reason.");
    await db.transaction(async (tx) => {
      const [event] = await tx.select().from(eventsTable).where(eq(eventsTable.id, record.row.id)).for("update");
      if (!event) throw new StaffAccessError(404, "Event no longer exists.");
      assertStaffResource(req, event);
      const invited = await listEventInvitees(event, true);
      if (!invited.some((p) => p.id === playerId)) throw new StaffAccessError(403, "Player is not in the current event audience.");
      const expected = input.expected;
      if (expected === null) {
        if (input.status === null) throw new StaffAccessError(400, "There is no reply to clear.");
        const inserted = await tx.insert(eventRsvpsTable).values({ eventId: event.id, playerId, status: input.status, note }).onConflictDoNothing().returning({ id: eventRsvpsTable.id });
        if (!inserted.length) throw new StaffAccessError(409, "This reply changed. Refresh attendance before editing.");
      } else {
        const where = and(eq(eventRsvpsTable.eventId, event.id), eq(eventRsvpsTable.playerId, playerId), eq(eventRsvpsTable.id, expected.id), eq(eventRsvpsTable.revision, expected.revision));
        const changed = input.status === null
          ? await tx.delete(eventRsvpsTable).where(where).returning({ id: eventRsvpsTable.id })
          : await tx.update(eventRsvpsTable).set({ status: input.status, note, respondedAt: new Date(), revision: sql`${eventRsvpsTable.revision} + 1` }).where(where).returning({ id: eventRsvpsTable.id });
        if (!changed.length) throw new StaffAccessError(409, "This reply changed. Refresh attendance before editing.");
      }
    });
    response.json({ ok: true });
  });
});

router.post("/teams/:teamId/:resource/:id/remind", requireStaffTeam("attendance"), async (req, res) => {
  const record = await resource(req);
  // Do not allow caller-provided recipient lists or forced resend flags.
  req.body = {};
  await audited(req, res, `${record.type}.attendance.reminder`, record.type === "matches" ? remindMatchNonresponders : remindStaffEvent);
});

function scheduleBody(req: Request, event: boolean) {
  const input = req.body ?? {};
  if (input.teamId !== req.staffTeamId || input.operationalScope && input.operationalScope !== "local_2026_27") throw new StaffAccessError(403, "A schedule item must stay with this team.");
  if (event) {
    if (input.isPublic === true || input.audienceMode && input.audienceMode !== "squad" ||
      Array.isArray(input.groupIds) && input.groupIds.length || input.sendNotify === true || "photoUrl" in input) throw new StaffAccessError(403, "Staff can only manage private team events without broad notifications or photo changes.");
    req.body = {
      kind: input.kind, title: input.title, startsAt: input.startsAt, endsAt: input.endsAt,
      location: input.location, description: input.description, teamId: req.staffTeamId,
      audienceMode: "squad", groupIds: [], isPublic: false, sendNotify: false,
    };
  } else {
    req.body = { teamId: req.staffTeamId, opponent: input.opponent, kickoffAt: input.kickoffAt, venue: input.venue, status: input.status, ourScore: input.ourScore, theirScore: input.theirScore, notes: input.notes };
  }
}
router.post("/teams/:teamId/matches", requireStaffTeam("schedule"), async (req, res) => {
  scheduleBody(req, false); await audited(req, res, "match.created", createLocalMatch);
});
router.patch("/teams/:teamId/matches/:id", requireStaffTeam("schedule"), async (req, res) => {
  scheduleBody(req, false); await audited(req, res, "match.updated", handleUpdateMatch);
});
router.post("/teams/:teamId/events", requireStaffTeam("schedule"), async (req, res) => {
  scheduleBody(req, true); await audited(req, res, "event.created", createLocalEvent);
});
router.patch("/teams/:teamId/events/:id", requireStaffTeam("schedule"), async (req, res) => {
  scheduleBody(req, true); await audited(req, res, "event.updated", updateLocalEvent);
});

export default router;
