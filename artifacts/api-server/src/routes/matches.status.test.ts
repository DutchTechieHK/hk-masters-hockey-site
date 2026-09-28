import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db, matchRsvpsTable, matchesTable, playerParticipationsTable,
  playersTable, playerSessionsTable, seasonsTable, teamsTable,
} from "@workspace/db";
import { createPlayerSession, requirePlayerSession } from "../middleware/playerSession";
import { playerMatchRsvps, submitMatchRsvp } from "./matchAttendance";

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  hasAdminAccess: async () => true,
}));

const { default: matchesRouter } = await import("./matches");
const app = express();
app.use(express.json());
app.use("/matches", matchesRouter);
app.get("/player/matches/rsvps", requirePlayerSession, playerMatchRsvps);
app.post("/player/matches/:id/rsvp", requirePlayerSession, submitMatchRsvp);
app.use((error: Error, _req: unknown, res: express.Response, _next: unknown) =>
  res.status(500).json({ error: error.message }));

const future = "2030-10-10T10:00:00.000Z";
const past = "2020-10-10T10:00:00.000Z";
const matchIds: number[] = [];
let teamId: number;
let playerId: number;
let token: string;

const fixture = (kickoffAt: string, status: string, extra: Record<string, unknown> = {}) => ({
  teamId, opponent: "Status test", kickoffAt, status, venue: "Pitch 1",
  notes: "Keep these details", ...extra,
});

beforeAll(async () => {
  const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(eq(seasonsTable.slug, "membership-2026-27"));
  if (!season) throw new Error("Current membership season not found");
  const [team] = await db.insert(teamsTable).values({
    name: `match-status-${Date.now()}`, category: "MO35",
    managerName: "Test", managerEmail: `status-${Date.now()}@example.com`, managerPhone: "000",
  }).returning({ id: teamsTable.id });
  teamId = team.id;
  const [player] = await db.insert(playersTable).values({
    teamId, name: "Status Test Player", email: `status-player-${Date.now()}@example.com`,
    memberStatus: "active",
  }).returning({ id: playersTable.id });
  playerId = player.id;
  await db.insert(playerParticipationsTable).values({
    playerId, seasonId: season.id, teamId, participationStatus: "active", source: "match_status_test",
  });
  token = await createPlayerSession(playerId);
});

afterAll(async () => {
  if (matchIds.length) {
    await db.delete(matchRsvpsTable).where(inArray(matchRsvpsTable.matchId, matchIds));
    await db.delete(matchesTable).where(inArray(matchesTable.id, matchIds));
  }
  if (playerId) {
    await db.delete(playerSessionsTable).where(eq(playerSessionsTable.playerId, playerId));
    await db.delete(playerParticipationsTable).where(eq(playerParticipationsTable.playerId, playerId));
    await db.delete(playersTable).where(eq(playersTable.id, playerId));
  }
  if (teamId) await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
});

describe("admin match status guards", () => {
  it("rejects premature status through create, import's create route, PATCH and PUT, but permits restoring Scheduled", async () => {
    for (const status of ["in_progress", "final"]) {
      const rejected = await request(app).post("/matches").send(fixture(future, status, { ourScore: 1, theirScore: 0 }));
      expect(rejected.status).toBe(409);
      expect(rejected.body.error).toMatch(/before kick-off/);
    }
    const created = await request(app).post("/matches").send(fixture(future, "scheduled"));
    expect(created.status).toBe(201);
    const id = created.body.id as number;
    matchIds.push(id);
    for (const method of ["patch", "put"] as const) {
      const rejected = await request(app)[method](`/matches/${id}`)
        .send(fixture(future, "in_progress"));
      expect(rejected.status).toBe(409);
      expect(rejected.body.error).toMatch(/before kick-off/);
    }
    expect((await request(app).get("/player/matches/rsvps")
      .set("Authorization", `Bearer ${token}`)).body.matches.some((m: { matchId: number }) => m.matchId === id)).toBe(true);

    // Reproduce an already-bad record created before the guard was deployed.
    await db.update(matchesTable).set({ status: "in_progress" }).where(eq(matchesTable.id, id));
    expect((await request(app).post(`/player/matches/${id}/rsvp`)
      .set("Authorization", `Bearer ${token}`).send({ status: "yes" })).status).toBe(409);
    const restored = await request(app).patch(`/matches/${id}`).send(fixture(future, "scheduled"));
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ status: "scheduled", venue: "Pitch 1", notes: "Keep these details" });
    expect((await request(app).post(`/player/matches/${id}/rsvp`)
      .set("Authorization", `Bearer ${token}`).send({ status: "yes" })).status).toBe(200);
  });

  it("allows Live after kickoff and requires both scores for Final without erasing them", async () => {
    const created = await request(app).post("/matches").send(fixture(past, "scheduled"));
    expect(created.status).toBe(201);
    const id = created.body.id as number;
    matchIds.push(id);
    const live = await request(app).patch(`/matches/${id}`).send(fixture(past, "in_progress", { ourScore: 2, theirScore: 0 }));
    expect(live.status).toBe(200);
    expect(live.body).toMatchObject({ status: "in_progress", ourScore: 2, theirScore: 0 });
    const incomplete = await request(app).put(`/matches/${id}`).send(fixture(past, "final", { ourScore: 2 }));
    expect(incomplete.status).toBe(409);
    expect(incomplete.body.error).toMatch(/both scores/);
    const final = await request(app).put(`/matches/${id}`)
      .send(fixture(past, "final", { ourScore: 2, theirScore: 0 }));
    expect(final.status).toBe(200);
    expect(final.body).toMatchObject({ status: "final", ourScore: 2, theirScore: 0, notes: "Keep these details" });
  });
});