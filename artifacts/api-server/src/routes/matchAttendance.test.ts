import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, matchesTable, matchRsvpsTable, playerParticipationsTable,
  playerSessionsTable, playersTable, seasonsTable, teamsTable,
} from "@workspace/db";
import { createPlayerSession, requirePlayerSession } from "../middleware/playerSession";
import { adminMatchRsvps, playerMatchRsvps, submitMatchRsvp } from "./matchAttendance";

const app = express();
app.use(express.json());
app.get("/player/matches/rsvps", requirePlayerSession, playerMatchRsvps);
app.post("/player/matches/:id/rsvp", requirePlayerSession, submitMatchRsvp);
app.get("/matches/:id/rsvps", (req, res, next) => req.headers["x-session-token"] === "admin-test" ? next() : res.status(401).end(), adminMatchRsvps);
app.use((err: Error, _req: unknown, res: express.Response, _next: unknown) => res.status(500).json({ error: err.message }));

const tag = `match-attendance-${Date.now()}`;
const ids: number[] = [];
const playerIds: number[] = [];
const teamIds: number[] = [];
let token: string;
let otherToken: string;
let futureId: number;
let pastId: number;
let cancelledId: number;
let archivedId: number;
let seasonId: number;

beforeAll(async () => {
  const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(eq(seasonsTable.slug, "membership-2026-27"));
  if (!season) throw new Error("Current membership season not found");
  seasonId = season.id;
  for (let n = 0; n < 2; n++) {
    const [team] = await db.insert(teamsTable).values({
      name: `${tag}-${n}`, category: "MO35", managerName: "Test",
      managerEmail: `${tag}-${n}@example.com`, managerPhone: "000",
    }).returning({ id: teamsTable.id });
    teamIds.push(team.id);
  }
  for (let n = 0; n < 3; n++) {
    const [player] = await db.insert(playersTable).values({
      teamId: teamIds[n === 0 ? 1 : n === 1 ? 0 : 1], // legacy team differs for the RSVP player
      name: `${tag}-player-${n}`, email: `${tag}-player-${n}@example.com`,
      memberStatus: "active",
    }).returning({ id: playersTable.id });
    playerIds.push(player.id);
    await db.insert(playerParticipationsTable).values({
      playerId: player.id, seasonId, teamId: teamIds[n === 2 ? 1 : 0],
      participationStatus: "active", source: "match_attendance_test",
    });
  }
  token = await createPlayerSession(playerIds[0]);
  otherToken = await createPlayerSession(playerIds[2]);
  for (const [date, status, scope] of [
    ["2030-10-10T10:00:00.000Z", "scheduled", "local_2026_27"],
    ["2020-01-01T10:00:00.000Z", "scheduled", "local_2026_27"],
    ["2030-10-10T10:00:00.000Z", "cancelled", "local_2026_27"],
    ["2030-10-10T10:00:00.000Z", "scheduled", "world_cup_2026"],
  ]) {
    const [match] = await db.insert(matchesTable).values({
      teamId: teamIds[0], opponent: tag, kickoffAt: new Date(date),
      status, operationalScope: scope,
    }).returning({ id: matchesTable.id });
    ids.push(match.id);
  }
  [futureId, pastId, cancelledId, archivedId] = ids;
});

afterAll(async () => {
  if (ids.length) await db.delete(matchesTable).where(inArray(matchesTable.id, ids));
  if (playerIds.length) {
    await db.delete(playerSessionsTable).where(inArray(playerSessionsTable.playerId, playerIds));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
  if (teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
});

describe("match attendance", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("requires a player session and limits replies to the current squad", async () => {
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).send({ status: "yes" })).status).toBe(401);
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`)
      .set("Authorization", `Bearer ${otherToken}`).send({ status: "yes" })).status).toBe(403);
    expect((await request(app).get(`/matches/${futureId}/rsvps`)).status).toBe(401);
    const listing = await request(app).get("/player/matches/rsvps").set(auth());
    expect(listing.status).toBe(200);
    expect(listing.body.matches.map((m: { matchId: number }) => m.matchId)).toEqual([futureId]);
  });

  it("requires reasons, saves changed replies, and counts only the invited squad", async () => {
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "maybe" })).status).toBe(400);
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "yes" })).status).toBe(200);
    const changed = await request(app).post(`/player/matches/${futureId}/rsvp`)
      .set(auth()).send({ status: "maybe", note: "May be late" });
    expect(changed.body).toMatchObject({ status: "maybe", note: "May be late" });
    const listing = await request(app).get("/player/matches/rsvps").set(auth());
    expect(listing.body.matches[0]).toMatchObject({ myRsvp: "maybe", myNote: "May be late", rsvpCounts: { yes: 0, maybe: 1, no: 0 } });
    const roster = await request(app).get(`/matches/${futureId}/rsvps`).set("x-session-token", "admin-test");
    expect(roster.body.counts).toMatchObject({ invited: 2, maybe: 1, noResponse: 1 });
    expect(roster.body.responses[0]).toMatchObject({ playerId: playerIds[0], note: "May be late" });
    expect(roster.body.noResponse[0].playerId).toBe(playerIds[1]);
    const last = await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "yes" });
    expect(last.body.note).toBeNull();
    const [saved] = await db.select().from(matchRsvpsTable)
      .where(and(eq(matchRsvpsTable.matchId, futureId), eq(matchRsvpsTable.playerId, playerIds[0])));
    expect(saved.status).toBe("yes");
    expect(saved.note).toBeNull();
    await db.update(playerParticipationsTable).set({ teamId: teamIds[1] })
      .where(and(eq(playerParticipationsTable.playerId, playerIds[0]), eq(playerParticipationsTable.seasonId, seasonId)));
    const movedRoster = await request(app).get(`/matches/${futureId}/rsvps`).set("x-session-token", "admin-test");
    expect(movedRoster.body.counts).toMatchObject({ yes: 0, noResponse: 1, invited: 1 });
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "yes" })).status).toBe(403);
    await db.update(playerParticipationsTable).set({ teamId: teamIds[0] })
      .where(and(eq(playerParticipationsTable.playerId, playerIds[0]), eq(playerParticipationsTable.seasonId, seasonId)));
  });

  it("rejects old, cancelled, final, and archived matches", async () => {
    for (const id of [pastId, cancelledId, archivedId]) {
      expect((await request(app).post(`/player/matches/${id}/rsvp`).set(auth()).send({ status: "yes" })).status).toBe(409);
    }
    await db.update(matchesTable).set({ status: "final" }).where(eq(matchesTable.id, futureId));
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "yes" })).status).toBe(409);
    const roster = await request(app).get(`/matches/${archivedId}/rsvps`).set("x-session-token", "admin-test");
    expect(roster.status).toBe(409);
  });
});