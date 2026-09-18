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
});
afterAll(async () => {
  if (squadPlayerId) {
    await db.delete(eventRsvpsTable).where(eq(eventRsvpsTable.playerId, squadPlayerId));
    await db.delete(playerParticipationsTable).where(eq(playerParticipationsTable.playerId, squadPlayerId));
    await db.delete(playersTable).where(eq(playersTable.id, squadPlayerId));
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
});