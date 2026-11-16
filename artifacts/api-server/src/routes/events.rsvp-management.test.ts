import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, eventsTable, eventRsvpsTable, eventRsvpAdminChangesTable, playersTable, teamsTable,
  seasonsTable, playerParticipationsTable, memberGroupsTable, memberGroupMembersTable, eventGroupsTable,
} from "@workspace/db";

vi.mock("../utils/email", () => ({ sendNewEventEmail: vi.fn(), sendRsvpReminderEmail: vi.fn() }));
vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.headers["x-admin-key"] === "event-rsvp-test" ? next() : res.sendStatus(401),
  hasAdminAccess: async () => false,
}));
const { default: router, playerRsvpHandler } = await import("./events");
const app = express();
app.use(express.json());
app.use("/events", router);
app.post("/player/events/:id", (req, _res, next) => {
  req.player = testPlayer;
  next();
}, playerRsvpHandler);
app.use((err: Error, _req: unknown, res: express.Response, _next: unknown) => res.status(500).json({ error: err.message }));
const tag = `event-rsvp-admin-${Date.now()}`;
const playerIds: number[] = [];
const eventIds: number[] = [];
let teamId: number;
let groupId: number;
let testPlayer: typeof playersTable.$inferSelect;
const auth = { "x-admin-key": "event-rsvp-test" };
const url = (event = eventIds[0], player = playerIds[0]) => `/events/${event}/rsvps/${player}`;
const current = async () => (await db.select().from(eventRsvpsTable).where(and(
  eq(eventRsvpsTable.eventId, eventIds[0]), eq(eventRsvpsTable.playerId, playerIds[0]),
)))[0];
const version = (row: { id: number; revision: number }) => ({ id: row.id, revision: row.revision });

beforeAll(async () => {
  const [team] = await db.insert(teamsTable).values({
    name: tag, category: "test", managerName: "", managerEmail: "", managerPhone: "",
  }).returning();
  teamId = team.id;
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27"));
  for (let i = 0; i < 2; i++) {
    const [player] = await db.insert(playersTable).values({ name: `${tag}-${i}`, email: `${tag}-${i}@example.com`, teamId, memberStatus: "active" }).returning();
    if (i === 0) testPlayer = player;
    playerIds.push(player.id);
    await db.insert(playerParticipationsTable).values({
      playerId: player.id, seasonId: season.id, teamId, participationStatus: "active", source: "test",
    });
  }
  const [group] = await db.insert(memberGroupsTable).values({ name: tag }).returning();
  groupId = group.id;
  await db.insert(memberGroupMembersTable).values({ groupId, playerId: playerIds[0] });
  for (const scope of ["local_2026_27", "world_cup_2026", null]) {
    const [event] = await db.insert(eventsTable).values({
      title: tag, kind: "social", startsAt: new Date(), teamId: null, operationalScope: scope,
      audienceMode: "groups",
    }).returning();
    eventIds.push(event.id);
    await db.insert(eventGroupsTable).values({ eventId: event.id, groupId });
  }
});

afterAll(async () => {
  if (eventIds.length) await db.delete(eventsTable).where(inArray(eventsTable.id, eventIds));
  if (groupId) await db.delete(memberGroupsTable).where(eq(memberGroupsTable.id, groupId));
  if (playerIds.length) {
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
  if (teamId) await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
});

describe("event RSVP admin management", () => {
  it("requires full admin authentication", async () => {
    expect((await request(app).put(url()).send({ status: "yes", expected: null })).status).toBe(401);
  });
  it("validates status, reason and expected version", async () => {
    for (const body of [
      { status: "yes" }, { status: "other", expected: null },
      { status: "maybe", expected: null }, { status: "no", note: "  ", expected: null },
      { status: "no", note: "a".repeat(2001), expected: null },
      { status: null, expected: null }, { status: "yes", expected: { id: 1.5, revision: 1 } },
    ]) expect((await request(app).put(url()).set(auth).send(body)).status).toBe(400);
  });
  it("rejects outsiders even in the same squad, archived and unclassified events", async () => {
    expect((await request(app).put(url(eventIds[0], playerIds[1])).set(auth).send({ status: "yes", expected: null })).status).toBe(403);
    for (const id of eventIds.slice(1)) {
      expect((await request(app).put(url(id)).set(auth).send({ status: "yes", expected: null })).status).toBe(409);
    }
  });
  it("records a reply and returns the current version, counts and history", async () => {
    expect((await request(app).put(url()).set(auth).send({ status: "yes", expected: null })).status).toBe(200);
    const roster = (await request(app).get(`/events/${eventIds[0]}/rsvps`).set(auth)).body;
    expect(roster.counts).toMatchObject({ yes: 1, noResponse: 0, invited: 1 });
    expect(roster.event.canManageRsvps).toBe(true);
    expect(roster.responses[0]).toMatchObject({ ...version(await current()), status: "yes" });
    expect(roster.history).toHaveLength(1);
    expect(roster.history[0]).toMatchObject({ actor: "Admin API key", previousStatus: null, newStatus: "yes" });
  });
  it("edits a reply with a reason and prevents a stale change or clear", async () => {
    const original = version(await current());
    expect((await request(app).put(url()).set(auth).send({ status: "maybe", note: " Running late ", expected: original })).status).toBe(200);
    for (const status of ["yes", null]) {
      expect((await request(app).put(url()).set(auth).send({ status, expected: original })).status).toBe(409);
    }
    expect(await current()).toMatchObject({ status: "maybe", note: "Running late", revision: original.revision + 1 });
  });
  it("does not overwrite a newer player response", async () => {
    const original = version(await current());
    expect((await request(app).post(`/player/events/${eventIds[0]}`).send({ status: "no", note: "Injured" })).status).toBe(200);
    expect((await request(app).put(url()).set(auth).send({ status: "yes", expected: original })).status).toBe(409);
    expect(await current()).toMatchObject({ status: "no", note: "Injured" });
  });
  it("clears back to no reply and retains both before/after values in history", async () => {
    expect((await request(app).put(url()).set(auth).send({ status: null, expected: version(await current()) })).status).toBe(200);
    expect(await current()).toBeUndefined();
    const roster = (await request(app).get(`/events/${eventIds[0]}/rsvps`).set(auth)).body;
    expect(roster.counts).toMatchObject({ yes: 0, maybe: 0, no: 0, noResponse: 1 });
    expect(roster.history).toHaveLength(3);
    expect(roster.history[2]).toMatchObject({ previousStatus: "no", previousNote: "Injured", newStatus: null, newNote: null });
    expect(await db.select().from(eventRsvpAdminChangesTable).where(eq(eventRsvpAdminChangesTable.eventId, eventIds[0]))).toHaveLength(3);
  });
  it("only accepts one of two simultaneous no-reply edits", async () => {
    const responses = await Promise.all(["yes", "maybe"].map((status) => request(app).put(url()).set(auth)
      .send({ status, note: "Test", expected: null })));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});
