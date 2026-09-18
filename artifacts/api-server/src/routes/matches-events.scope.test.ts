import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import {
  eventRsvpsTable,
  eventsTable,
  matchesTable,
  playerParticipationsTable,
  playersTable,
  seasonsTable,
  teamsTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
  hasAdminAccess: async () => true,
}));
vi.mock("../middleware/playerSession", () => ({ requirePlayerSession: (_req: any, _res: any, next: any) => next() }));
const { default: matchesRouter } = await import("./matches");
const { default: eventsRouter, listEventsForPlayer, playerRsvpHandler } = await import("./events");
const app = express();
app.use(express.json());
app.use("/api/matches", matchesRouter);
app.use("/api/events", eventsRouter);
app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ error: err.message }));

const tag = `scope-${Date.now()}`;
let matchIds: number[] = [];
let eventIds: number[] = [];
let teamId: number;
let squadEventId: number;
let squadPlayerId: number;
let ineligiblePlayerId: number;
let legacyTeamId: number;

beforeAll(async () => {
  const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).limit(1);
  teamId = team.id;
  const [archivedMatch] = await db.insert(matchesTable).values({ teamId, opponent: `${tag}-archive`, kickoffAt: new Date("2026-07-25T10:00:00Z"), operationalScope: "world_cup_2026" }).returning({ id: matchesTable.id });
  const [localMatch] = await db.insert(matchesTable).values({ teamId, opponent: `${tag}-local`, kickoffAt: new Date("2026-09-20T10:00:00Z"), operationalScope: "local_2026_27" }).returning({ id: matchesTable.id });
  matchIds = [archivedMatch.id, localMatch.id];
  const [archivedEvent] = await db.insert(eventsTable).values({ kind: "test", title: `${tag}-archive`, startsAt: new Date("2026-07-25T10:00:00Z"), operationalScope: "world_cup_2026" }).returning({ id: eventsTable.id });
  const [localEvent] = await db.insert(eventsTable).values({ kind: "test", title: `${tag}-local`, startsAt: new Date("2026-09-20T10:00:00Z"), operationalScope: "local_2026_27" }).returning({ id: eventsTable.id });
  eventIds = [archivedEvent.id, localEvent.id];
  const [unclassifiedEvent] = await db.insert(eventsTable).values({ kind: "test", title: `${tag}-unclassified`, startsAt: new Date("2026-08-01T10:00:00Z") }).returning({ id: eventsTable.id });
  eventIds.push(unclassifiedEvent.id);

  const [[squadTeam], [legacyTeam], [currentSeason]] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.name, "Masters Div. 1")),
    db.select().from(teamsTable).where(eq(teamsTable.name, "Awaiting Selection")),
    db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27")),
  ]);
  if (!squadTeam || !legacyTeam || !currentSeason) {
    throw new Error("Current squad test fixtures are required");
  }
  legacyTeamId = legacyTeam.id;
  const [squadPlayer] = await db.insert(playersTable).values({
    teamId: legacyTeam.id,
    name: `${tag}-selected-player`,
    email: `${tag}@example.com`,
    memberStatus: "active",
    currentMembershipSection: squadTeam.membershipSection,
  }).returning({ id: playersTable.id });
  squadPlayerId = squadPlayer.id;
  await db.insert(playerParticipationsTable).values({
    playerId: squadPlayerId,
    seasonId: currentSeason.id,
    teamId: squadTeam.id,
    participationStatus: "active",
    membershipSection: squadTeam.membershipSection,
    source: "event_visibility_test",
  });
  const [squadEvent] = await db.insert(eventsTable).values({
    kind: "training",
    title: `${tag}-squad-trial`,
    startsAt: new Date("2026-09-21T10:00:00Z"),
    operationalScope: "local_2026_27",
    teamId: squadTeam.id,
  }).returning({ id: eventsTable.id });
  squadEventId = squadEvent.id;
  eventIds.push(squadEventId);

  const [ineligiblePlayer] = await db.insert(playersTable).values({
    teamId: legacyTeam.id,
    name: `${tag}-ineligible-woman`,
    email: `${tag}-ineligible@example.com`,
    memberStatus: "active",
    currentMembershipSection: "women",
  }).returning({ id: playersTable.id });
  ineligiblePlayerId = ineligiblePlayer.id;
  await db.insert(playerParticipationsTable).values({
    playerId: ineligiblePlayerId,
    seasonId: currentSeason.id,
    teamId: legacyTeam.id,
    participationStatus: "active",
    membershipSection: "women",
    source: "event_visibility_test",
  });
  await db.insert(eventRsvpsTable).values([
    {
      eventId: squadEventId,
      playerId: ineligiblePlayerId,
      status: "yes",
      respondedAt: new Date("2026-09-17T16:03:08Z"),
    },
    {
      eventId: eventIds[1],
      playerId: ineligiblePlayerId,
      status: "yes",
      respondedAt: new Date("2026-09-17T16:04:08Z"),
    },
  ]);
});
afterAll(async () => {
  const testPlayerIds = [squadPlayerId, ineligiblePlayerId].filter((id): id is number => !!id);
  if (testPlayerIds.length > 0) {
    await db.delete(eventRsvpsTable).where(inArray(eventRsvpsTable.playerId, testPlayerIds));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, testPlayerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, testPlayerIds));
  }
  await db.delete(matchesTable).where(inArray(matchesTable.id, matchIds));
  await db.delete(eventsTable).where(inArray(eventsTable.id, eventIds));
});

describe("classified match/event API boundaries", () => {
  it("returns local rows by default and archive rows only by explicit scope", async () => {
    const current = await request(app).get("/api/matches");
    expect(current.status, JSON.stringify(current.body)).toBe(200);
    expect(current.body.map((r: any) => r.id)).toEqual(expect.arrayContaining([matchIds[1]]));
    expect(current.body.map((r: any) => r.id)).not.toContain(matchIds[0]);
    const archive = await request(app).get("/api/matches?scope=world_cup_2026");
    expect(archive.body.map((r: any) => r.id)).toEqual(expect.arrayContaining([matchIds[0]]));
    const currentEvents = await request(app).get("/api/events");
    expect(currentEvents.status, JSON.stringify(currentEvents.body)).toBe(200);
    expect(currentEvents.body.map((r: any) => r.id)).toContain(eventIds[1]);
    expect(currentEvents.body.map((r: any) => r.id)).not.toContain(eventIds[0]);
    const archiveEvents = await request(app).get("/api/events?scope=world_cup_2026");
    expect(archiveEvents.body.map((r: any) => r.id)).toContain(eventIds[0]);
  });
  it("rejects archive mutations and leaves rows unchanged", async () => {
    const beforeMatch = await db.select().from(matchesTable).where(eq(matchesTable.id, matchIds[0]));
    const beforeEvent = await db.select().from(eventsTable).where(eq(eventsTable.id, eventIds[0]));
    expect((await request(app).put(`/api/matches/${matchIds[0]}`).send({})).status).toBe(409);
    expect((await request(app).delete(`/api/events/${eventIds[0]}`)).status).toBe(409);
    expect((await db.select().from(matchesTable).where(eq(matchesTable.id, matchIds[0])))[0]).toEqual(beforeMatch[0]);
    expect((await db.select().from(eventsTable).where(eq(eventsTable.id, eventIds[0])))[0]).toEqual(beforeEvent[0]);
  });

  it("player event lists and RSVP side effects are local-only", async () => {
    const [player] = await db.select().from(playersTable).limit(1);
    const listed = await listEventsForPlayer(player.teamId, player.id);
    expect(listed.map((event) => event.id)).toContain(eventIds[1]);
    expect(listed.map((event) => event.id)).not.toContain(eventIds[0]);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    await playerRsvpHandler({ params: { id: String(eventIds[0]) }, body: { status: "yes" }, player } as any, response);
    expect(response.status).toHaveBeenCalledWith(409);
    const unclassifiedResponse = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    await playerRsvpHandler({ params: { id: String(eventIds[2]) }, body: { status: "yes" }, player } as any, unclassifiedResponse);
    expect(unclassifiedResponse.status).toHaveBeenCalledWith(409);
    expect((await request(app).post(`/api/events/${eventIds[0]}/rsvps/remind`)).status).toBe(409);
  });

  it("uses current league-squad selection for event visibility and RSVP", async () => {
    const listed = await listEventsForPlayer(legacyTeamId, squadPlayerId);
    expect(listed.map((event) => event.id)).toContain(squadEventId);

    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    await playerRsvpHandler({
      params: { id: String(squadEventId) },
      body: { status: "yes" },
      player: { id: squadPlayerId, teamId: legacyTeamId },
    } as any, response);
    expect(response.status).not.toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      eventId: squadEventId,
      status: "yes",
    }));

    const adminView = await request(app).get(`/api/events/${squadEventId}/rsvps`);
    expect(adminView.status, JSON.stringify(adminView.body)).toBe(200);
    expect(adminView.body.responses).toContainEqual(expect.objectContaining({
      playerId: squadPlayerId,
      status: "yes",
    }));
  });

  it("requires a reason for maybe and no responses", async () => {
    for (const status of ["maybe", "no"]) {
      const missingReasonResponse = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
      await playerRsvpHandler({
        params: { id: String(squadEventId) },
        body: { status, note: "   " },
        player: { id: squadPlayerId, teamId: legacyTeamId },
      } as any, missingReasonResponse);
      expect(missingReasonResponse.status).toHaveBeenCalledWith(400);
      expect(missingReasonResponse.json).toHaveBeenCalledWith({
        error: `A reason is required when responding ${status}`,
      });
    }

    const acceptedResponse = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    await playerRsvpHandler({
      params: { id: String(squadEventId) },
      body: { status: "no", note: "Working late" },
      player: { id: squadPlayerId, teamId: legacyTeamId },
    } as any, acceptedResponse);
    expect(acceptedResponse.status).not.toHaveBeenCalledWith(400);
    expect(acceptedResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "no",
      note: "Working late",
    }));

    const restoreResponse = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    await playerRsvpHandler({
      params: { id: String(squadEventId) },
      body: { status: "yes" },
      player: { id: squadPlayerId, teamId: legacyTeamId },
    } as any, restoreResponse);
  });

  it("excludes stale ineligible responses from team event attendance but keeps all-squad responses", async () => {
    const squadAdminView = await request(app).get(`/api/events/${squadEventId}/rsvps`);
    expect(squadAdminView.status, JSON.stringify(squadAdminView.body)).toBe(200);
    expect(squadAdminView.body.responses).not.toContainEqual(expect.objectContaining({
      playerId: ineligiblePlayerId,
    }));
    expect(squadAdminView.body.excludedResponses).toContainEqual(expect.objectContaining({
      playerId: ineligiblePlayerId,
      status: "yes",
      exclusionReason: "Player is no longer in this event's current audience",
    }));
    expect(squadAdminView.body.counts.yes).toBe(1);
    expect(squadAdminView.body.counts.invited).toBe(1);
    expect(squadAdminView.body.counts.noResponse).toBe(0);

    const adminEvents = await request(app).get("/api/events");
    expect(adminEvents.status, JSON.stringify(adminEvents.body)).toBe(200);
    expect(adminEvents.body.find((event: any) => event.id === squadEventId)?.rsvpCounts.yes).toBe(1);

    const allSquadAdminView = await request(app).get(`/api/events/${eventIds[1]}/rsvps`);
    expect(allSquadAdminView.status, JSON.stringify(allSquadAdminView.body)).toBe(200);
    expect(allSquadAdminView.body.responses).toContainEqual(expect.objectContaining({
      playerId: ineligiblePlayerId,
      status: "yes",
    }));
    expect(allSquadAdminView.body.excludedResponses).toEqual([]);
    expect(allSquadAdminView.body.counts.yes).toBe(1);
  });
});