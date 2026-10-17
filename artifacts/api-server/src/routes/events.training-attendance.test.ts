import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, eventsTable, eventRsvpsTable, playersTable, teamsTable,
  playerParticipationsTable, playerSessionsTable, seasonsTable,
} from "@workspace/db";
import { createPlayerSession, requirePlayerSession } from "../middleware/playerSession";

vi.mock("../utils/email", () => ({
  sendRsvpReminderEmail: vi.fn(), sendNewEventEmail: vi.fn(),
}));
vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: unknown, res: express.Response) => res.sendStatus(401),
  hasAdminAccess: async () => false,
}));

const { default: eventsRouter, playerRsvpHandler } = await import("./events");
const app = express();
app.use(express.json());
app.use("/api/events", eventsRouter);
app.post("/player/events/:id/rsvp", requirePlayerSession, playerRsvpHandler);
app.use((err: Error, _req: unknown, res: express.Response, _next: unknown) => res.status(500).json({ error: err.message }));

const tag = `training-attendance-${Date.now()}`;
const teamIds: number[] = [];
const playerIds: number[] = [];
const eventIds: number[] = [];
let seasonId: number;
let token: string;
let outsiderToken: string;
let inactiveToken: string;
let trainingId: number;
let allSquadsId: number;
let emptyId: number;
const path = "/api/events/training-attendance";
const future = new Date(Date.now() + 30 * 86400_000);

beforeAll(async () => {
  const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(eq(seasonsTable.slug, "membership-2026-27"));
  if (!season) throw new Error("Current membership season required");
  seasonId = season.id;
  for (let n = 0; n < 2; n++) {
    const [team] = await db.insert(teamsTable).values({
      name: `${tag}-${n}`, category: "test", managerName: "", managerEmail: "", managerPhone: "",
    }).returning({ id: teamsTable.id });
    teamIds.push(team.id);
  }
  // A large list, a legacy-team fallback, an outsider with a stale legacy
  // assignment, and an inactive member with an old Going response.
  for (let n = 0; n < 24; n++) {
    const [player] = await db.insert(playersTable).values({
      name: `${tag}-${String(24 - n).padStart(2, "0")}`,
      email: `${tag}-${n}@example.com`,
      teamId: n === 0 ? teamIds[1] : teamIds[0],
      memberStatus: n === 23 ? "inactive" : "active",
    }).returning({ id: playersTable.id });
    playerIds.push(player.id);
    if (n !== 22) await db.insert(playerParticipationsTable).values({
      playerId: player.id, seasonId, teamId: teamIds[n === 21 ? 1 : 0],
      participationStatus: "active", source: "training_attendance_test",
    });
  }
  token = await createPlayerSession(playerIds[0]);
  outsiderToken = await createPlayerSession(playerIds[21]);
  inactiveToken = await createPlayerSession(playerIds[23]);
  for (const values of [
    { kind: "training", startsAt: future, teamId: teamIds[0], operationalScope: "local_2026_27" },
    { kind: "training", startsAt: future, teamId: null, operationalScope: "local_2026_27" },
    { kind: "training", startsAt: future, teamId: teamIds[0], operationalScope: "local_2026_27" },
    { kind: "training", startsAt: new Date("2020-01-01"), teamId: teamIds[0], operationalScope: "local_2026_27" },
    { kind: "social", startsAt: future, teamId: teamIds[0], operationalScope: "local_2026_27" },
    { kind: "training", startsAt: future, teamId: teamIds[0], operationalScope: "world_cup_2026" },
    { kind: "training", startsAt: future, teamId: teamIds[0], operationalScope: null },
    { kind: "training", startsAt: future, teamId: teamIds[1], operationalScope: "local_2026_27" },
  ]) {
    const [event] = await db.insert(eventsTable).values({ ...values, title: tag, isPublic: true })
      .returning({ id: eventsTable.id });
    eventIds.push(event.id);
  }
  [trainingId, allSquadsId, emptyId] = eventIds;
  // Persisted replies share the same storage regardless of who entered them.
  await db.insert(eventRsvpsTable).values(playerIds.map((playerId, n) => ({
    eventId: trainingId, playerId,
    status: n === 19 ? "maybe" : n === 20 ? "no" : "yes",
    note: `Private absence reason ${n}`,
  })));
  await db.insert(eventRsvpsTable).values({ eventId: allSquadsId, playerId: playerIds[21], status: "yes" });
});

afterAll(async () => {
  if (eventIds.length) await db.delete(eventsTable).where(inArray(eventsTable.id, eventIds));
  if (playerIds.length) {
    await db.delete(playerSessionsTable).where(inArray(playerSessionsTable.playerId, playerIds));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
  if (teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
});

describe("private training attendance", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("requires an active member session and marks even denied responses private", async () => {
    for (const headers of [{}, { Authorization: "Bearer invalid" }, { "x-session-token": "admin-only" }]) {
      const response = await request(app).get(path).set(headers);
      expect(response.status).toBe(401);
      expect(response.headers["cache-control"]).toBe("private, no-store");
    }
    expect((await request(app).get(path).set("Authorization", `Bearer ${inactiveToken}`)).status).toBe(403);
  });

  it("returns only upcoming eligible training with synchronized, alphabetized, minimal names", async () => {
    const response = await request(app).get(path).set(auth());
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.vary).toContain("Authorization");
    expect(response.headers.vary).toContain("X-Player-Session");
    const ownEvents = response.body.events.filter((event: { eventId: number }) => eventIds.includes(event.eventId));
    expect(ownEvents.map((event: { eventId: number }) => event.eventId)).toEqual([trainingId, allSquadsId, emptyId]);
    const snapshot = ownEvents[0];
    expect(snapshot.rsvpCounts).toEqual({ yes: 20, maybe: 1, no: 1 });
    expect(snapshot.goingPlayers).toHaveLength(20);
    const names = snapshot.goingPlayers.map((player: { name: string }) => player.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(snapshot.goingPlayers.map((player: { id: number }) => player.id)).toContain(playerIds[22]);
    for (const excluded of [19, 20, 21, 23]) {
      expect(snapshot.goingPlayers.some((player: { id: number }) => player.id === playerIds[excluded])).toBe(false);
    }
    for (const player of snapshot.goingPlayers) expect(Object.keys(player).sort()).toEqual(["id", "name"]);
    expect(Object.keys(snapshot).sort()).toEqual(["eventId", "goingPlayers", "rsvpCounts"]);
    expect(JSON.stringify(response.body)).not.toContain("@example.com");
    expect(JSON.stringify(response.body)).not.toContain("Private absence reason");
    expect(ownEvents[2]).toEqual({ eventId: emptyId, goingPlayers: [], rsvpCounts: { yes: 0, maybe: 0, no: 0 } });
  });

  it("does not treat public visibility or a stale legacy squad as permission", async () => {
    const outsider = await request(app).get(path).set("Authorization", `Bearer ${outsiderToken}`);
    expect(outsider.body.events.some((event: { eventId: number }) => event.eventId === trainingId)).toBe(false);
    const allSquads = outsider.body.events.find((event: { eventId: number }) => event.eventId === allSquadsId);
    expect(allSquads.goingPlayers).toEqual([{ id: playerIds[21], name: `${tag}-03` }]);
    const publicEvents = await request(app).get("/api/events/public");
    expect(publicEvents.body.find((event: { id: number }) => event.id === trainingId)).not.toHaveProperty("goingPlayers");
    expect((await request(app).get(`/api/events/${trainingId}/rsvps`).set(auth())).status).toBe(401);
  });

  it("updates names and counts together after a reply changes and after squad changes", async () => {
    const change = await request(app).post(`/player/events/${trainingId}/rsvp`).set(auth())
      .send({ status: "no", note: "A private reason" });
    expect(change.status).toBe(200);
    const changed = await request(app).get(path).set(auth());
    const snapshot = changed.body.events.find((event: { eventId: number }) => event.eventId === trainingId);
    expect(snapshot.rsvpCounts).toEqual({ yes: 19, maybe: 1, no: 2 });
    expect(snapshot.goingPlayers).toHaveLength(19);
    expect(snapshot.goingPlayers.some((player: { id: number }) => player.id === playerIds[0])).toBe(false);
    expect(JSON.stringify(changed.body)).not.toContain("A private reason");
    const restore = await request(app).post(`/player/events/${trainingId}/rsvp`).set(auth()).send({ status: "yes" });
    expect(restore.status).toBe(200);
    const restored = await request(app).get(path).set(auth());
    const restoredSnapshot = restored.body.events.find((event: { eventId: number }) => event.eventId === trainingId);
    expect(restoredSnapshot.rsvpCounts.yes).toBe(20);
    expect(restoredSnapshot.goingPlayers).toHaveLength(20);

    await db.update(playerParticipationsTable).set({ teamId: teamIds[1] })
      .where(and(eq(playerParticipationsTable.playerId, playerIds[0]), eq(playerParticipationsTable.seasonId, seasonId)));
    const moved = await request(app).get(path).set(auth());
    expect(moved.body.events.some((event: { eventId: number }) => event.eventId === trainingId)).toBe(false);
    // Another eligible viewer must no longer count that old reply.
    const teammateToken = await createPlayerSession(playerIds[1]);
    const teammate = await request(app).get(path).set("Authorization", `Bearer ${teammateToken}`);
    const filtered = teammate.body.events.find((event: { eventId: number }) => event.eventId === trainingId);
    expect(filtered.rsvpCounts.yes).toBe(19);
    expect(filtered.goingPlayers).toHaveLength(19);
  });
});
