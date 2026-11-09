import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db, eventsTable, teamsTable, eventGroupsTable, memberGroupMembersTable, eventRsvpsTable, playersTable, RSVP_STATUSES, type RsvpStatus, seasonsTable, playerParticipationsTable, worldCupPlayerSnapshotsTable, worldCupTeamSnapshotsTable, emailBlastsTable, emailBlastRecipientsTable } from "@workspace/db";
import { eq, asc, or, isNull, and, inArray, gt, sql } from "drizzle-orm";
import { requireAdminAccess, hasAdminAccess } from "../middleware/adminAuth";
import { sendRsvpReminderEmail, sendNewEventEmail } from "../utils/email";
import { sendPushToPlayers } from "../utils/push";
import { requirePlayerSession } from "../middleware/playerSession";
import { ObjectStorageService, ObjectNotFoundError, extractUploadObjectId } from "../lib/objectStorage";
import { cleanupOrphanedUpload } from "../lib/uploadCleanup";
import { isArchivedRotterdamTeam } from "../utils/archivedTeams";
import { getWorldCupTeamSnapshots } from "../utils/archivedTeams";
import { formatEventDateTime } from "../utils/eventTime";
import { loadEventGroups, lockEventGroups, InvalidEventGroups, type EventAudience } from "../utils/eventGroups";
import { assertStaffResource } from "../middleware/staffAccess";
import { withLeagueNumbers } from "../utils/shirtNumbers";

const router: IRouter = Router();
const CURRENT_MEMBERSHIP_SEASON_SLUG = "membership-2026-27";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// Derive the absolute origin of this API from the incoming request (works in
// dev behind the Replit proxy and in prod with x-forwarded-proto headers).
export function requestBase(req: Request): string {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto =
    (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") ||
    req.protocol ||
    "https";
  return `${proto}://${req.get("host")}`;
}

/**
 * Convention: all event photoUrl values returned to clients are ABSOLUTE URLs.
 * Relative /api/... paths stored in the DB are prefixed with the request origin
 * so they resolve correctly across domains (public site on Netlify, player app,
 * admin portal). Already-absolute values (e.g. migrated legacy URLs) pass through
 * unchanged so there is never a risk of double-prefixing.
 */
export function resolvePhotoUrl(base: string, photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http")) return photoUrl;
  return `${base}${photoUrl}`;
}

// GET /api/events accepts either an admin session OR a player session.
// - Admin callers see every event (used by the admin Events page).
// - Player callers see only events visible to them (team-scoped or all-squad).
async function requireAdminOrPlayer(req: Request, res: Response, next: NextFunction) {
  if (await hasAdminAccess(req)) {
    (req as Request & { isAdmin?: boolean }).isAdmin = true;
    return next();
  }
  return requirePlayerSession(req, res, next);
}

const ALLOWED_KINDS = ["training", "meeting", "social", "physio", "team_dinner", "dinner", "free_time", "warmup", "game"] as const;
type EventKind = typeof ALLOWED_KINDS[number];

type RsvpCounts = { yes: number; no: number; maybe: number };

function emptyCounts(): RsvpCounts {
  return { yes: 0, no: 0, maybe: 0 };
}

function serialize(
  row: typeof eventsTable.$inferSelect,
  teamName?: string | null,
  extras?: { rsvpCounts?: RsvpCounts; myRsvp?: RsvpStatus | null; myNote?: string | null; groupIds?: number[] },
  base?: string,
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
    audienceMode: row.audienceMode,
    groupIds: extras?.groupIds ?? [],
    teamName: teamName ?? null,
    isPublic: row.isPublic,
    photoUrl: base ? resolvePhotoUrl(base, row.photoUrl) : (row.photoUrl ?? null),
    createdAt: row.createdAt.toISOString(),
    rsvpCounts: extras?.rsvpCounts ?? emptyCounts(),
    myRsvp: extras?.myRsvp ?? null,
    myNote: extras?.myNote ?? null,
  };
}

type LocalEventInvitee = {
  id: number;
  name: string;
  email: string | null;
  shirtNumber: number | null;
  teamId: number | null;
  teamName: string | null;
};

async function getCurrentLeagueSquadTeamId(
  playerId: number,
): Promise<number | null | undefined> {
  const [participation] = await db
    .select({ teamId: playerParticipationsTable.teamId })
    .from(playerParticipationsTable)
    .innerJoin(
      seasonsTable,
      eq(playerParticipationsTable.seasonId, seasonsTable.id),
    )
    .where(
      and(
        eq(playerParticipationsTable.playerId, playerId),
        eq(playerParticipationsTable.participationStatus, "active"),
        eq(seasonsTable.slug, CURRENT_MEMBERSHIP_SEASON_SLUG),
      ),
    )
    .limit(1);

  return participation?.teamId;
}

async function getEffectiveEventTeamId(
  playerId: number,
  legacyTeamId: number | null,
): Promise<number | null> {
  return (await getCurrentLeagueSquadTeamId(playerId)) ?? legacyTeamId;
}

async function listLocalEventInvitees(
  eventTeamId: number | null,
  activeMembersOnly = false,
): Promise<LocalEventInvitee[]> {
  const [players, participations] = await Promise.all([
    db
      .select({
        id: playersTable.id,
        name: playersTable.name,
        email: playersTable.email,
        shirtNumber: playersTable.shirtNumber,
        teamId: playersTable.teamId,
        teamName: teamsTable.name,
      })
      .from(playersTable)
      .leftJoin(teamsTable, eq(teamsTable.id, playersTable.teamId))
      .where(activeMembersOnly ? eq(playersTable.memberStatus, "active") : undefined)
      .orderBy(asc(playersTable.name)),
    db
      .select({
        playerId: playerParticipationsTable.playerId,
        teamId: playerParticipationsTable.teamId,
        teamName: teamsTable.name,
      })
      .from(playerParticipationsTable)
      .innerJoin(
        seasonsTable,
        eq(playerParticipationsTable.seasonId, seasonsTable.id),
      )
      .leftJoin(teamsTable, eq(teamsTable.id, playerParticipationsTable.teamId))
      .where(
        and(
          eq(playerParticipationsTable.participationStatus, "active"),
          eq(seasonsTable.slug, CURRENT_MEMBERSHIP_SEASON_SLUG),
        ),
      ),
  ]);

  const currentByPlayer = new Map(
    participations.map((participation) => [
      participation.playerId,
      { teamId: participation.teamId, teamName: participation.teamName },
    ]),
  );

  return withLeagueNumbers(players
    .map((player) => {
      const current = currentByPlayer.get(player.id);
      return {
        ...player,
        teamId: current?.teamId ?? player.teamId,
        teamName: current?.teamName ?? player.teamName ?? null,
      };
    })
    .filter((player) => eventTeamId == null || player.teamId === eventTeamId));
}

async function getEventAudienceChangeImpact(
  eventId: number,
  current: EventAudience,
  proposed: EventAudience,
  newGroupIds: number[],
) {
  const responses = await db
    .select({ playerId: eventRsvpsTable.playerId })
    .from(eventRsvpsTable)
    .where(eq(eventRsvpsTable.eventId, eventId));
  const invitees = await listLocalEventInvitees(null);
  const currentGroups = await loadEventGroups([current]);
  const newMembers = newGroupIds.length ? await db.select().from(memberGroupMembersTable).where(inArray(memberGroupMembersTable.groupId, newGroupIds)) : [];
  const newMemberIds = new Set(newMembers.map((member) => member.playerId));
  const byPlayer = new Map(invitees.map((player) => [player.id, player]));

  let currentlyCounted = 0;
  let newlyCounted = 0;
  let becomeIneligible = 0;
  let becomeEligible = 0;

  for (const response of responses) {
    const player = byPlayer.get(response.playerId);
    const isCurrentlyEligible = !!player && currentGroups.includes(current, player);
    const willBeEligible = !!player && (proposed.audienceMode === "groups"
      ? newMemberIds.has(player.id) : proposed.teamId == null || player.teamId === proposed.teamId);

    if (isCurrentlyEligible) currentlyCounted++;
    if (willBeEligible) newlyCounted++;
    if (isCurrentlyEligible && !willBeEligible) becomeIneligible++;
    if (!isCurrentlyEligible && willBeEligible) becomeEligible++;
  }

  return {
    totalResponses: responses.length,
    currentlyCounted,
    newlyCounted,
    becomeIneligible,
    becomeEligible,
  };
}

function parseBody(body: unknown, existingMode = "squad"): {
  kind: EventKind;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  description: string | null;
  teamId: number | null;
  audienceMode: "squad" | "groups";
  groupIds: number[] | undefined;
  isPublic: boolean;
  sendNotify: boolean;
  // undefined = not provided by caller (PATCH: leave existing value unchanged)
  // null      = explicitly cleared
  // string    = new URL to store
  photoUrl: string | null | undefined;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const kind = String(b.kind ?? "");
  if (!ALLOWED_KINDS.includes(kind as EventKind)) {
    return { error: "kind must be training, meeting, social, physio, team_dinner, dinner, free_time, warmup or game" };
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
  const audienceMode = b.audienceMode ?? existingMode;
  if (audienceMode !== "squad" && audienceMode !== "groups") return { error: "Invalid audienceMode" };
  let groupIds: number[] | undefined;
  if ("groupIds" in b) {
    if (!Array.isArray(b.groupIds) || b.groupIds.length > 500 ||
        b.groupIds.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)) {
      return { error: "groupIds must be a list of positive integer group IDs" };
    }
    groupIds = [...new Set(b.groupIds as number[])];
  }
  if (audienceMode === "groups") {
    if (teamId !== null) return { error: "Select groups or a squad, not both" };
    if (groupIds !== undefined && groupIds.length === 0) return { error: "Select at least one group" };
    if (b.isPublic === true) return { error: "Group events are private. Turn off public website visibility." };
  } else if (groupIds?.length) {
    return { error: "Group selection requires the groups audience mode" };
  }
  // photoUrl: absent key → undefined (PATCH preserves existing); null or "" → null (clear); string → store
  let photoUrl: string | null | undefined = undefined;
  if ("photoUrl" in b) {
    const raw = b.photoUrl;
    photoUrl = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
  return {
    kind: kind as EventKind,
    title,
    startsAt,
    endsAt,
    location: typeof b.location === "string" && b.location.trim() ? b.location.trim() : null,
    description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : null,
    teamId,
    audienceMode,
    groupIds,
    isPublic: b.isPublic === true,
    sendNotify: b.sendNotify !== false && b.sendNotify !== "false",
    photoUrl,
  };
}

export async function listEventInvitees(event: EventAudience, activeMembersOnly = false) {
  const [members, groups] = await Promise.all([
    listLocalEventInvitees(null, activeMembersOnly),
    loadEventGroups([event]),
  ]);
  return members.filter((member) => groups.includes(event, member));
}

// Aggregate RSVP counts grouped by event id. Local event views can additionally
// restrict stored responses to each event's current invited squad.
async function loadRsvpCounts(
  events: EventAudience[],
  restrictToCurrentLocalAudience = false,
): Promise<Map<number, RsvpCounts>> {
  const map = new Map<number, RsvpCounts>();
  const eventIds = events.map((event) => event.id);
  if (eventIds.length === 0) return map;
  const rows = await db
    .select({
      eventId: eventRsvpsTable.eventId,
      playerId: eventRsvpsTable.playerId,
      status: eventRsvpsTable.status,
    })
    .from(eventRsvpsTable)
    .where(inArray(eventRsvpsTable.eventId, eventIds));

  let eligiblePlayerIdsByEvent: Map<number, Set<number>> | null = null;
  if (restrictToCurrentLocalAudience) {
    const [allInvitees, groups] = await Promise.all([listLocalEventInvitees(null), loadEventGroups(events)]);
    eligiblePlayerIdsByEvent = new Map(
      events.map((event) => [
        event.id,
        new Set(
          allInvitees
            .filter((player) => groups.includes(event, player))
            .map((player) => player.id),
        ),
      ]),
    );
  }

  for (const r of rows) {
    if (eligiblePlayerIdsByEvent && !eligiblePlayerIdsByEvent.get(r.eventId)?.has(r.playerId)) {
      continue;
    }
    const bucket = map.get(r.eventId) ?? emptyCounts();
    const s = r.status as RsvpStatus;
    if (s === "yes" || s === "no" || s === "maybe") {
      bucket[s]++;
    }
    map.set(r.eventId, bucket);
  }
  return map;
}

async function loadMyRsvps(playerId: number, eventIds: number[]): Promise<Map<number, { status: RsvpStatus; note: string | null }>> {
  const map = new Map<number, { status: RsvpStatus; note: string | null }>();
  if (eventIds.length === 0) return map;
  const rows = await db
    .select({ eventId: eventRsvpsTable.eventId, status: eventRsvpsTable.status, note: eventRsvpsTable.note })
    .from(eventRsvpsTable)
    .where(and(eq(eventRsvpsTable.playerId, playerId), inArray(eventRsvpsTable.eventId, eventIds)));
  for (const r of rows) {
    if (r.status === "yes" || r.status === "no" || r.status === "maybe") {
      map.set(r.eventId, { status: r.status, note: r.note ?? null });
    }
  }
  return map;
}

// Public, unauthenticated: events explicitly marked as public, for the public website.
// photoUrl is resolved to an absolute URL via resolvePhotoUrl (see convention comment above).
router.get("/public", (async (req, res) => {
  const scope = req.query.scope === "world_cup_2026" ? "world_cup_2026" : "local_2026_27";
  const rows = await db
    .select({ event: eventsTable, teamCategory: teamsTable.category })
    .from(eventsTable)
    .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
    .where(and(eq(eventsTable.isPublic, true), eq(eventsTable.audienceMode, "squad"), eq(eventsTable.operationalScope, scope)))
    .orderBy(asc(eventsTable.startsAt));
  const base = requestBase(req);
  const snapshots = scope === "world_cup_2026" ? await getWorldCupTeamSnapshots(rows.map(({ event }) => event.teamId).filter((id): id is number => id != null)) : new Map();
  res.json(rows.map(({ event: r, teamCategory }) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    location: r.location,
    description: r.description,
    teamId: r.teamId,
    teamCategory: snapshots.get(r.teamId ?? -1)?.category ?? teamCategory ?? null,
    photoUrl: resolvePhotoUrl(base, r.photoUrl),
  })));
}) as (req: Request, res: Response) => Promise<void>);

router.get("/", requireAdminOrPlayer, (async (req, res) => {
  const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin === true;
  const scope = isAdmin && req.query.scope === "world_cup_2026" ? "world_cup_2026" : "local_2026_27";
  const base = requestBase(req);
  if (isAdmin) {
    res.set("Cache-Control", "private, no-store");
    const rows = await db
      .select({ event: eventsTable, teamName: teamsTable.name })
      .from(eventsTable)
      .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
      .where(eq(eventsTable.operationalScope, scope))
      .orderBy(asc(eventsTable.startsAt));
    const counts = await loadRsvpCounts(
      rows.map(({ event }) => event),
      scope === "local_2026_27",
    );
    const snapshots = scope === "world_cup_2026" ? await getWorldCupTeamSnapshots(rows.map(({ event }) => event.teamId).filter((id): id is number => id != null)) : new Map();
    const groups = await loadEventGroups(rows.map(({ event }) => event));
    res.json(rows.map(({ event, teamName }) =>
      serialize(event, snapshots.get(event.teamId ?? -1)?.name ?? teamName, { rsvpCounts: counts.get(event.id) ?? emptyCounts(), groupIds: groups.groupIdsByEvent.get(event.id) ?? [] }, base)));
    return;
  }
  res.set("Cache-Control", "private, no-store");
  const filtered = await listEventsForPlayer(req.player?.teamId ?? null, req.player?.id ?? null, base);
  res.json(filtered);
}) as (req: Request, res: Response) => Promise<void>);

export async function createLocalEvent(req: Request, res: Response) {
  const parsed = parseBody(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  assertStaffResource(req, { ...parsed, operationalScope: "local_2026_27" });
  const parsedTeamId = "teamId" in parsed ? parsed.teamId : null;
  if (parsedTeamId != null && await isArchivedRotterdamTeam(parsedTeamId)) {
    res.status(409).json({ error: "Archived content is read-only" });
    return;
  }
  const { sendNotify, photoUrl, groupIds: requestedGroupIds, ...coreValues } = parsed;
  const groupIds = requestedGroupIds ?? [];
  if (parsed.audienceMode === "groups" && !groupIds.length) {
    res.status(400).json({ error: "Select at least one group" }); return;
  }
  // For POST, undefined photoUrl means no photo (store null); explicit value stored as-is.
  let row: typeof eventsTable.$inferSelect;
  try {
    row = await db.transaction(async (tx) => {
      await lockEventGroups(tx, groupIds);
      const [created] = await tx.insert(eventsTable).values({ ...coreValues, photoUrl: photoUrl ?? null, operationalScope: "local_2026_27" }).returning();
      if (groupIds.length) await tx.insert(eventGroupsTable).values(groupIds.map((groupId) => ({ eventId: created.id, groupId })));
      return created;
    });
  } catch (error) {
    if (error instanceof InvalidEventGroups) { res.status(400).json({ error: error.message }); return; }
    throw error;
  }
  const team = parsed.teamId
    ? (await db.select().from(teamsTable).where(eq(teamsTable.id, parsed.teamId)))[0]
    : null;
  res.status(201).json(serialize(row, team?.name, { groupIds }));

  if (sendNotify) {
    // Fire-and-forget notifications after responding to the admin.
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://www.hkmastershockey.com";
    const scheduleUrl = `${PUBLIC_URL}/schedule`;

    const startsAt = new Date(row.startsAt);
    const { eventDate, eventTime } = formatEventDateTime(startsAt);

    const kindLabel =
      row.kind === "training" ? "Training" :
      row.kind === "social" ? "Social event" :
      row.kind === "physio" ? "Physio session" :
      row.kind === "team_dinner" ? "Team dinner" :
      row.kind === "dinner" ? "Dinner" :
      row.kind === "free_time" ? "Free time" :
      "Meeting";
    const pushPayload = {
      title: `New ${kindLabel.toLowerCase()}: ${row.title}`,
      body: `${eventDate} at ${eventTime}${row.location ? ` · ${row.location}` : ""}`,
      url: "/schedule",
    };

    (async () => {
      try {
        const invitees = await listEventInvitees(row);
        await sendPushToPlayers(invitees.map((member) => member.id), pushPayload);
      } catch (err) {
        console.error("[events] Push notification failed:", err);
      }
    })();

    (async () => {
      try {
        const players = await listEventInvitees(row);

        const withEmail = players.filter((p) => !!p.email);
        let sent = 0;
        for (const player of withEmail) {
          const ok = await sendNewEventEmail({
            playerName: player.name,
            playerEmail: player.email!,
            eventKind: row.kind,
            eventTitle: row.title,
            eventDate,
            eventTime,
            location: row.location,
            scheduleUrl,
          });
          if (ok) sent++;
          if (player !== withEmail[withEmail.length - 1]) await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (sent !== withEmail.length) console.error(`[events] New-event emails: ${withEmail.length - sent} failed for event #${row.id}`);
      } catch (err) {
        console.error("[events] Email notification failed:", err);
      }
    })();
  }
  return;
}
router.post("/", requireAdminAccess, createLocalEvent);

router.get("/:id/audience-change-impact", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rawTeamId = req.query.teamId;
  const audienceMode = req.query.audienceMode ?? "squad";
  if (audienceMode !== "squad" && audienceMode !== "groups") {
    res.status(400).json({ error: "Invalid audienceMode" }); return;
  }
  const groupIds = typeof req.query.groupIds === "string" && req.query.groupIds
    ? [...new Set(req.query.groupIds.split(",").map(Number))] : [];
  if (groupIds.length > 500 || groupIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      (audienceMode === "groups" && !groupIds.length)) {
    res.status(400).json({ error: "Select valid groups" }); return;
  }
  let newTeamId: number | null = null;
  if (rawTeamId !== undefined && rawTeamId !== "") {
    const parsedTeamId = Number(rawTeamId);
    if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
      res.status(400).json({ error: "Invalid teamId" });
      return;
    }
    newTeamId = parsedTeamId;
  }

  const [event] = await db
    .select({
      id: eventsTable.id,
      teamId: eventsTable.teamId,
      audienceMode: eventsTable.audienceMode,
      operationalScope: eventsTable.operationalScope,
    })
    .from(eventsTable)
    .where(eq(eventsTable.id, id))
    .limit(1);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  if (event.operationalScope !== "local_2026_27") {
    res.status(409).json({ error: "Audience impact is only available for current local events" });
    return;
  }

  const impact = await getEventAudienceChangeImpact(id, event, { id, teamId: newTeamId, audienceMode }, groupIds);
  res.json(impact);
});

export async function updateLocalEvent(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const [existingScope] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
  if (!existingScope) return res.status(404).json({ error: "Event not found" });
  if (existingScope.operationalScope === "world_cup_2026") return res.status(409).json({ error: "Archived content is read-only" });
  if (existingScope.operationalScope == null) return res.status(409).json({ error: "Unclassified records must be classified before editing" });
  const parsed = parseBody(req.body, existingScope.audienceMode);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const updateTeamId = "teamId" in parsed ? parsed.teamId : null;
  if (updateTeamId != null && await isArchivedRotterdamTeam(updateTeamId)) {
    res.status(409).json({ error: "Archived content is read-only" });
    return;
  }
  const { sendNotify: _sendNotify, photoUrl, groupIds: requestedGroupIds, ...coreValues } = parsed;
  const existingGroups = await loadEventGroups([existingScope]);
  const groupIds = parsed.audienceMode === "groups"
    ? requestedGroupIds ?? existingGroups.groupIdsByEvent.get(id) ?? []
    : [];
  if (parsed.audienceMode === "groups" && !groupIds.length) {
    res.status(400).json({ error: "Select at least one group" }); return;
  }
  // Only update photoUrl in DB if the caller explicitly sent the key.
  // This makes bulk PATCH (e.g. toggle isPublic) safe — omitting photoUrl preserves the existing value.
  const updateValues: Record<string, unknown> = { ...coreValues };
  const preserveAudience = !Object.hasOwn(req.body, "audienceMode") && !Object.hasOwn(req.body, "groupIds");
  if (preserveAudience) {
    // Older callers (including public/private bulk edits) do not own the
    // audience. Do not replace group links from a pre-transaction read.
    delete updateValues.audienceMode;
    if (existingScope.audienceMode === "groups") delete updateValues.teamId;
  }

  // Read the old row before mutating so we can clean up an orphaned photo.
  let oldPhotoUrl: string | null = null;
  if (photoUrl !== undefined) {
    const [existing] = await db.select({ photoUrl: eventsTable.photoUrl }).from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
    if (existing) oldPhotoUrl = existing.photoUrl ?? null;
    updateValues.photoUrl = photoUrl;
  }

  let row: typeof eventsTable.$inferSelect | undefined;
  try {
    row = await db.transaction(async (tx) => {
      if (req.staffTeamId !== undefined) {
        const [locked] = await tx.select().from(eventsTable).where(eq(eventsTable.id, id)).for("update");
        if (!locked) return undefined;
        assertStaffResource(req, locked);
        assertStaffResource(req, { ...parsed, operationalScope: "local_2026_27" });
      }
      await lockEventGroups(tx, groupIds);
      const [updated] = await tx.update(eventsTable).set(updateValues)
        .where(and(eq(eventsTable.id, id), eq(eventsTable.operationalScope, "local_2026_27"))).returning();
      if (!updated) return undefined;
      if (!preserveAudience) {
        await tx.delete(eventGroupsTable).where(eq(eventGroupsTable.eventId, id));
        if (groupIds.length) await tx.insert(eventGroupsTable).values(groupIds.map((groupId) => ({ eventId: id, groupId })));
      }
      return updated;
    });
  } catch (error) {
    if (error instanceof InvalidEventGroups) { res.status(400).json({ error: error.message }); return; }
    throw error;
  }
  if (!row) return res.status(404).json({ error: "Event not found" });
  const team = parsed.teamId
    ? (await db.select().from(teamsTable).where(eq(teamsTable.id, parsed.teamId)))[0]
    : null;
  const savedGroups = await loadEventGroups([row]);
  res.json(serialize(row, team?.name, { groupIds: savedGroups.groupIdsByEvent.get(id) ?? [] }));

  // Fire-and-forget: clean up the old photo if it changed (cross-entity ref check inside).
  const oldId = extractUploadObjectId(oldPhotoUrl);
  const newId = extractUploadObjectId(photoUrl ?? null);
  if (oldId && oldId !== newId) {
    cleanupOrphanedUpload(oldId).catch(() => {});
  }
  return;
}
router.patch("/:id", requireAdminAccess, updateLocalEvent);

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const [scopeRow] = await db.select({ operationalScope: eventsTable.operationalScope }).from(eventsTable).where(eq(eventsTable.id, id));
  if (!scopeRow) return res.status(404).json({ error: "Event not found" });
  if (scopeRow.operationalScope === "world_cup_2026") return res.status(409).json({ error: "Archived content is read-only" });
  if (scopeRow.operationalScope == null) return res.status(409).json({ error: "Unclassified records must be classified before editing" });
  // Read the photo URL before deleting so we can clean up the storage object.
  const [existing] = await db.select({ photoUrl: eventsTable.photoUrl }).from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  await db.delete(eventsTable).where(and(eq(eventsTable.id, id), eq(eventsTable.operationalScope, "local_2026_27")));
  res.status(204).send();

  // Fire-and-forget: clean up the orphaned photo (cross-entity ref check inside).
  const oldId = extractUploadObjectId(existing?.photoUrl);
  if (oldId) cleanupOrphanedUpload(oldId).catch(() => {});
  return;
});

// ── Image upload / serve ────────────────────────────────────────────────────

// Admin: upload a photo for an event. Returns the relative serve path to store.
router.post(
  "/image-upload",
  requireAdminAccess,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "Image too large — max 10 MB" }); return;
        }
        res.status(400).json({ error: err.message }); return;
      }
      if (err) { next(err); return; }
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
      res.status(400).json({ error: "Only image files are allowed (JPEG, PNG, GIF, WebP)" }); return;
    }
    try {
      const storage = new ObjectStorageService();
      const objectPath = await storage.uploadObjectEntity(req.file.buffer, req.file.mimetype);
      const objectId = objectPath.replace("/objects/uploads/", "");
      // Return the relative serve path — callers store this in the DB and the
      // /public serialiser absolutises it at response time.
      const serveUrl = `/api/events/serve-image/${objectId}`;
      res.json({ url: serveUrl });
    } catch (err) {
      console.error("[events] image upload failed:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

// Public: stream event photo from object storage.
router.get("/serve-image/:objectId", async (req: Request, res: Response) => {
  const objectId = Array.isArray(req.params.objectId) ? req.params.objectId[0] : req.params.objectId;
  if (!objectId || !/^[\w-]+$/.test(objectId)) {
    res.status(400).json({ error: "Invalid objectId" }); return;
  }
  try {
    const storage = new ObjectStorageService();
    const signedUrl = await storage.getObjectEntityDownloadURL(`/objects/uploads/${objectId}`);
    res.redirect(302, signedUrl);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Image not found" }); return;
    }
    console.error("[events] serve-image failed:", err);
    res.status(502).json({ error: "Could not retrieve image" });
  }
});

// A private player snapshot, deliberately separate from the admin response roster.
// Counts and Going names come from the same eligible replies, including any
// replies entered by an administrator in event_rsvps.
router.get("/training-attendance", (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  res.vary("Authorization");
  res.vary("X-Player-Session");
  next();
}, requirePlayerSession, async (req, res): Promise<void> => {
  const player = req.player!;
  const effectiveTeamId = await getEffectiveEventTeamId(player.id, player.teamId);
  const candidateEvents = await db.select()
    .from(eventsTable)
    .where(and(
      eq(eventsTable.operationalScope, "local_2026_27"),
      eq(eventsTable.kind, "training"),
      gt(eventsTable.startsAt, new Date()),
    )).orderBy(asc(eventsTable.startsAt));
  const groups = await loadEventGroups(candidateEvents);
  const events = candidateEvents.filter((event) => groups.includes(event, { id: player.id, teamId: effectiveTeamId }));
  if (!events.length) { res.json({ events: [] }); return; }

  const invitees = await listLocalEventInvitees(null, true);
  const byPlayer = new Map(invitees.map((invitee) => [invitee.id, invitee]));
  const replies = await db.select({
    eventId: eventRsvpsTable.eventId,
    playerId: eventRsvpsTable.playerId,
    status: eventRsvpsTable.status,
  }).from(eventRsvpsTable).where(inArray(eventRsvpsTable.eventId, events.map((event) => event.id)));
  const snapshots = new Map(events.map((event) => [event.id, {
    eventId: event.id,
    rsvpCounts: emptyCounts(),
    goingPlayers: [] as Array<{ id: number; name: string }>,
    maybePlayers: [] as Array<{ id: number; name: string }>,
  }]));
  const eventById = new Map(events.map((event) => [event.id, event]));
  for (const reply of replies) {
    const invitee = byPlayer.get(reply.playerId);
    const event = eventById.get(reply.eventId)!;
    if (!invitee || !groups.includes(event, invitee)) continue;
    const snapshot = snapshots.get(event.id)!;
    if (reply.status === "yes" || reply.status === "maybe" || reply.status === "no") {
      snapshot.rsvpCounts[reply.status]++;
    }
    if (reply.status === "yes") snapshot.goingPlayers.push({ id: invitee.id, name: invitee.name });
    if (reply.status === "maybe") snapshot.maybePlayers.push({ id: invitee.id, name: invitee.name });
  }
  for (const snapshot of snapshots.values()) {
    snapshot.goingPlayers.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    snapshot.maybePlayers.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  }
  res.json({ events: [...snapshots.values()] });
});

// Admin-only: roster of who RSVP'd what for a single event.
router.get("/:id/rsvps", requireAdminAccess, (async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  if (event.operationalScope === "world_cup_2026") {
    const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable).where(eq(seasonsTable.slug, "rotterdam-2026"));
    const archived = season ? await db.select({ participation: playerParticipationsTable, playerSnapshot: worldCupPlayerSnapshotsTable.snapshot, teamSnapshot: worldCupTeamSnapshotsTable.snapshot })
      .from(playerParticipationsTable)
      .innerJoin(worldCupPlayerSnapshotsTable, eq(worldCupPlayerSnapshotsTable.playerId, playerParticipationsTable.playerId))
      .leftJoin(worldCupTeamSnapshotsTable, eq(worldCupTeamSnapshotsTable.teamId, playerParticipationsTable.teamId))
      .where(and(eq(playerParticipationsTable.seasonId, season.id), eq(playerParticipationsTable.participationStatus, "active"))) : [];
    const eligible = archived.filter(({ participation }) => event.teamId == null || participation.teamId === event.teamId);
    const ids = eligible.map(({ participation }) => participation.playerId);
    const rsvpRows = ids.length ? await db.select().from(eventRsvpsTable).where(and(eq(eventRsvpsTable.eventId, id), inArray(eventRsvpsTable.playerId, ids))) : [];
    const byId = new Map(eligible.map(({ participation, playerSnapshot, teamSnapshot }) => {
      const player = playerSnapshot as Record<string, unknown>;
      const team = teamSnapshot && typeof teamSnapshot === "object" ? teamSnapshot as Record<string, unknown> : {};
      return [participation.playerId, { name: String(player.name ?? ""), shirtNumber: player.shirt_number as number | null ?? null, teamId: participation.teamId, teamName: participation.teamId == null ? null : team.name as string | null ?? null }];
    }));
    const responses = rsvpRows.map((r) => ({ ...byId.get(r.playerId)!, playerId: r.playerId, status: r.status, note: r.note ?? null, respondedAt: r.respondedAt.toISOString() }));
    const respondedIds = new Set(responses.map((r) => r.playerId));
    const noResponse = eligible.filter(({ participation }) => !respondedIds.has(participation.playerId)).map(({ participation }) => ({ ...byId.get(participation.playerId)!, playerId: participation.playerId }));
    const counts = emptyCounts();
    for (const response of responses) if (response.status === "yes" || response.status === "no" || response.status === "maybe") counts[response.status]++;
    res.json({ event: serialize(event, null, { rsvpCounts: counts }), counts: { ...counts, noResponse: noResponse.length, invited: eligible.length }, responses, noResponse, excludedResponses: [] });
    return;
  }

  const rows = await db
    .select({
      playerId: playersTable.id,
      playerName: playersTable.name,
      shirtNumber: playersTable.shirtNumber,
      teamId: playersTable.teamId,
      teamName: teamsTable.name,
      status: eventRsvpsTable.status,
      note: eventRsvpsTable.note,
      respondedAt: eventRsvpsTable.respondedAt,
    })
    .from(eventRsvpsTable)
    .innerJoin(playersTable, eq(playersTable.id, eventRsvpsTable.playerId))
    .leftJoin(teamsTable, eq(teamsTable.id, playersTable.teamId))
    .where(eq(eventRsvpsTable.eventId, id))
    .orderBy(asc(playersTable.name));

  // Current-season squad selection is authoritative for local event audiences.
  // The legacy player team remains a fallback for members without a squad assignment.
  const invited = await listEventInvitees(event);
  const invitedById = new Map(invited.map((player) => [player.id, player]));

  const responses = rows
    .filter((r) => invitedById.has(r.playerId))
    .map((r) => ({
      playerId: r.playerId,
      playerName: r.playerName,
      shirtNumber: invitedById.get(r.playerId)!.shirtNumber,
      teamId: invitedById.get(r.playerId)!.teamId,
      teamName: invitedById.get(r.playerId)!.teamName ?? null,
      status: r.status,
      note: r.note ?? null,
      respondedAt: r.respondedAt.toISOString(),
    }));

  const excludedResponses = rows
    .filter((r) => !invitedById.has(r.playerId))
    .map((r) => ({
      playerId: r.playerId,
      playerName: r.playerName,
      shirtNumber: null,
      teamId: r.teamId,
      teamName: r.teamName ?? null,
      status: r.status,
      note: r.note ?? null,
      respondedAt: r.respondedAt.toISOString(),
      exclusionReason: "Player is no longer in this event's current audience",
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
    event: serialize(event, null, { rsvpCounts: counts, groupIds: (await loadEventGroups([event])).groupIdsByEvent.get(id) ?? [] }),
    counts: { ...counts, noResponse: noResponse.length, invited: invited.length },
    responses,
    noResponse,
    excludedResponses,
  });
}) as (req: Request, res: Response) => Promise<void>);

// Admin-only: send reminder emails to all non-responders for a single event.
export async function remindEventNonresponders(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  assertStaffResource(req, event);
  if (event.operationalScope === "world_cup_2026") { res.status(409).json({ error: "Archived content is read-only" }); return; }
  if (event.operationalScope == null) { res.status(409).json({ error: "Unclassified records must be classified before editing" }); return; }
  const operationalScope = event.operationalScope;

  // Use the same current-squad audience as listing and RSVP authorization.
  const invited = await listEventInvitees(event);

  // Find who has already responded.
  const responded = await db
    .select({ playerId: eventRsvpsTable.playerId })
    .from(eventRsvpsTable)
    .where(eq(eventRsvpsTable.eventId, id));
  const respondedIds = new Set(responded.map((r) => r.playerId));

  const allNonResponders = invited.filter((p) => !respondedIds.has(p.id));
  const nonResponders = allNonResponders.filter((p) => !!p.email);
  const skippedNoEmail = allNonResponders.length - nonResponders.length;

  // Format all event reminders in Hong Kong time.
  const PUBLIC_URL = process.env.PUBLIC_URL || "https://www.hkmastershockey.com";
  const scheduleUrl = `${PUBLIC_URL}/schedule`;

  const startsAt = new Date(event.startsAt);
  const { eventDate, eventTime } = formatEventDateTime(startsAt);

  let sent = 0;
  const recipientResults: Array<{
    playerId: number;
    playerName: string;
    playerEmail: string;
    sent: boolean;
  }> = [];
  for (let i = 0; i < nonResponders.length; i++) {
    const player = nonResponders[i];
    const ok = await sendRsvpReminderEmail({
      playerName: player.name,
      playerEmail: player.email!,
      eventTitle: event.title,
      eventDate,
      eventTime,
      scheduleUrl,
    });
    if (ok) sent++;
    recipientResults.push({
      playerId: player.id,
      playerName: player.name,
      playerEmail: player.email!,
      sent: ok,
    });
    // Throttle to stay under the email provider's rate limit (~2/sec).
    // Without this, a burst of sends gets rate-limited (429) and silently fails.
    if (i < nonResponders.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  const failed = nonResponders.length - sent;
  let historyRecorded = false;
  try {
    await db.transaction(async (tx) => {
      const [blast] = await tx.insert(emailBlastsTable).values({
        subject: `Quick reply needed: ${event.title}`,
        body: [
          "Event RSVP reminder",
          "",
          `Event: ${event.title}`,
          `Date: ${eventDate}`,
          `Time: ${eventTime}`,
          event.location ? `Location: ${event.location}` : null,
          "",
          `${sent} sent, ${failed} failed, ${skippedNoEmail} skipped because no email was on file.`,
        ].filter((line): line is string => line !== null).join("\n"),
        audienceType: "event-rsvp-reminder",
        teamIds: event.teamId == null ? null : JSON.stringify([event.teamId]),
        playerIds: JSON.stringify(nonResponders.map((player) => player.id)),
        recipientCount: nonResponders.length,
        sentCount: sent,
        failedCount: failed,
        sentByEmail: null,
        operationalScope,
      }).returning({ id: emailBlastsTable.id });

      if (recipientResults.length > 0) {
        await tx.insert(emailBlastRecipientsTable).values(
          recipientResults.map((result) => ({
            blastId: blast.id,
            playerId: result.playerId,
            playerName: result.playerName,
            playerEmail: result.playerEmail,
            sent: result.sent,
            errorMessage: result.sent ? null : "send_failed",
          })),
        );
      }
    });
    historyRecorded = true;
  } catch (error) {
    console.error(`[events] RSVP reminders were sent for event #${id}, but Email History could not be recorded`, error);
  }

  console.log(`[events] Sent ${sent} RSVP reminders for event #${id} (${nonResponders.length} eligible, ${skippedNoEmail} skipped no-email, ${failed} failed, historyRecorded=${historyRecorded})`);
  res.json({ sent, total: allNonResponders.length, skippedNoEmail, failed, historyRecorded });
}
router.post("/:id/rsvps/remind", requireAdminAccess, remindEventNonresponders);

// Player upserts their own RSVP for an event.
async function upsertOwnRsvp(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const status = String((req.body as { status?: unknown })?.status ?? "");
  if (!RSVP_STATUSES.includes(status as RsvpStatus)) {
    res.status(400).json({ error: "status must be yes, no or maybe" }); return;
  }
  const rawNote = (req.body as { note?: unknown })?.note;
  const note: string | null = typeof rawNote === "string" ? (rawNote.trim() || null) : null;
  if ((status === "maybe" || status === "no") && !note) {
    res.status(400).json({ error: `A reason is required when responding ${status}` }); return;
  }
  const player = req.player!;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.operationalScope === "world_cup_2026") { res.status(409).json({ error: "Archived content is read-only" }); return; }
  if (event.operationalScope == null) { res.status(409).json({ error: "Unclassified records must be classified before editing" }); return; }
  const effectiveTeamId = await getEffectiveEventTeamId(player.id, player.teamId);
  const groups = await loadEventGroups([event]);
  if (!groups.includes(event, { id: player.id, teamId: effectiveTeamId })) {
    res.status(403).json({ error: "You are not in this event's invited audience" }); return;
  }

  const now = new Date();
  await db.insert(eventRsvpsTable)
    .values({ eventId: id, playerId: player.id, status, note, respondedAt: now })
    .onConflictDoUpdate({
      target: [eventRsvpsTable.eventId, eventRsvpsTable.playerId],
      set: { status, note, respondedAt: now, revision: sql`${eventRsvpsTable.revision} + 1` },
    });

  res.json({ eventId: id, status, note, respondedAt: now.toISOString() });
}

export const playerRsvpHandler = upsertOwnRsvp;

export async function listEventsForPlayer(playerTeamId: number | null, playerId: number | null, base?: string) {
  const effectiveTeamId = playerId == null
    ? playerTeamId
    : await getEffectiveEventTeamId(playerId, playerTeamId);
  const candidates = await db
    .select({ event: eventsTable, teamName: teamsTable.name })
    .from(eventsTable)
    .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
    .where(
      eq(eventsTable.operationalScope, "local_2026_27"),
    )
    .orderBy(asc(eventsTable.startsAt));

  const groups = await loadEventGroups(candidates.map(({ event }) => event));
  const rows = candidates.filter(({ event }) =>
    // Anonymous callers never get group invitations, even if a legacy caller
    // supplies a squad but not a verified member ID.
    event.audienceMode === "groups" && playerId == null ? false
      : groups.includes(event, { id: playerId ?? -1, teamId: effectiveTeamId }));
  const ids = rows.map((r) => r.event.id);
  const counts = await loadRsvpCounts(
    rows.map(({ event }) => event),
    true,
  );
  const mine = playerId != null ? await loadMyRsvps(playerId, ids) : new Map<number, { status: RsvpStatus; note: string | null }>();

  return rows.map(({ event, teamName }) =>
    serialize(event, teamName, {
      rsvpCounts: counts.get(event.id) ?? emptyCounts(),
      myRsvp: mine.get(event.id)?.status ?? null,
      myNote: mine.get(event.id)?.note ?? null,
      groupIds: groups.groupIdsByEvent.get(event.id) ?? [],
    }, base),
  );
}

export default router;
