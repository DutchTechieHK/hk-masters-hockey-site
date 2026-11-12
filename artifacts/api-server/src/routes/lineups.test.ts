import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, matchesTable, playersTable, teamsTable, seasonsTable, playerParticipationsTable, matchRsvpsTable,
  staffTeamGrantsTable, staffSessionsTable, staffAuditTable, adminSessionsTable, playerSessionsTable, matchLineupsTable,
} from "@workspace/db";
import { createSession } from "../middleware/adminSession";
import { createPlayerSession } from "../middleware/playerSession";
import { positionGroup, suggestLineup, validatePlacements } from "../utils/lineups";
import app from "../app";

vi.mock("../utils/email", () => ({}));
const tag = `lineup-${crypto.randomBytes(5).toString("hex")}`;
let team: number, foreignTeam: number, match: number, archived: number, seasonId: number;
let coach: number, player: number, maybe: number, outsider: number;
let staffToken: string, adminToken: string, playerToken: string, outsiderToken: string;
const players: number[] = [];
const path = () => `/api/staff/teams/${team}/matches/${match}/lineup`;
const staff = (method: "get" | "put" | "post", suffix = "") => request(app)[method](path() + suffix).set("x-session-token", staffToken);
const full = (method: "get" | "put" | "post", suffix = "") => request(app)[method](path() + suffix).set("x-session-token", adminToken);
const pub = () => request(app).get(`/api/player-auth/matches/${match}/lineup`).set("x-player-session", playerToken);
const placement = (playerId: number, area = "pitch") => ({ playerId, area, x: 50, y: 50 });
const draft = (revision: number, ids = [player]) => ({ revision, formation: "4-3-3", placements: ids.map((id) => placement(id)) });

beforeAll(async () => {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27"));
  seasonId = season.id;
  for (let i = 0; i < 2; i++) {
    const [row] = await db.insert(teamsTable).values({ name: `${tag}-${i}`, category: "Test", managerName: "", managerEmail: "", managerPhone: "" }).returning();
    if (!i) team = row.id; else foreignTeam = row.id;
  }
  for (let i = 0; i < 4; i++) {
    const [row] = await db.insert(playersTable).values({
      teamId: team, name: `${tag}-${i}`, email: `${tag}-${i}@example.invalid`, position: i === 1 ? "Defender" : "Midfield",
      notes: "PRIVATE-NOTES", passportNumber: "PRIVATE-PASSPORT",
    }).returning();
    players.push(row.id);
    await db.insert(playerParticipationsTable).values({ playerId: row.id, seasonId, teamId: i === 3 ? foreignTeam : team, participationStatus: "active", source: tag });
  }
  [coach, player, maybe, outsider] = players;
  for (let i = 0; i < 2; i++) {
    const [row] = await db.insert(matchesTable).values({
      teamId: team, opponent: tag, kickoffAt: new Date("2026-12-01T12:00:00Z"),
      operationalScope: i ? "world_cup_2026" : "local_2026_27",
    }).returning();
    if (!i) match = row.id; else archived = row.id;
  }
  await db.insert(matchRsvpsTable).values([
    { matchId: match, playerId: player, status: "yes", note: "PRIVATE-REASON" },
    { matchId: match, playerId: maybe, status: "maybe", note: "PRIVATE-REASON" },
  ]);
  await db.insert(staffTeamGrantsTable).values({ playerId: coach, teamId: team, seasonId, manageAttendance: true, manageSchedule: true });
  staffToken = crypto.randomBytes(32).toString("hex");
  await db.insert(staffSessionsTable).values({ token: staffToken, playerId: coach, expiresAt: new Date(Date.now() + 3600000) });
  adminToken = await createSession(tag);
  playerToken = await createPlayerSession(player);
  outsiderToken = await createPlayerSession(outsider);
}, 30000);

afterAll(async () => {
  if (match) await db.delete(matchesTable).where(inArray(matchesTable.id, [match, archived]));
  await db.delete(staffAuditTable).where(eq(staffAuditTable.actor, tag));
  if (coach) await db.delete(staffAuditTable).where(eq(staffAuditTable.actorPlayerId, coach));
  if (adminToken) await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, adminToken));
  if (players.length) {
    await db.delete(playerSessionsTable).where(inArray(playerSessionsTable.playerId, players));
    await db.delete(staffSessionsTable).where(inArray(staffSessionsTable.playerId, players));
    await db.delete(staffTeamGrantsTable).where(inArray(staffTeamGrantsTable.playerId, players));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, players));
    await db.delete(playersTable).where(inArray(playersTable.id, players));
  }
  if (team) await db.delete(teamsTable).where(inArray(teamsTable.id, [team, foreignTeam]));
});

describe("lineup rules", () => {
  it("maps recognised positions, leaving ambiguous and missing ones unassigned", () => {
    expect(["GK", "Defender", "Midfield", "Striker"].map(positionGroup)).toEqual(["gk", "defence", "midfield", "forward"]);
    expect(positionGroup("Defender / Midfield")).toBeNull();
    expect(positionGroup(null)).toBeNull();
    const people = ["Goalkeeper", "Defender", "Midfield", "Forward", "All rounder"].map((position, i) => ({
      playerId: i + 1, name: `${i}`, position, status: "yes" as const, shirtNumber: null,
    }));
    expect(suggestLineup([...people, { ...people[0], playerId: 99, status: "maybe" }], "4-3-3").map((p) => p.playerId)).toEqual([1, 2, 3, 4]);
    expect(suggestLineup(people, "3-4-3")).toEqual(suggestLineup([...people].reverse(), "3-4-3"));
  });
  it("rejects duplicate, overfull and out-of-bounds assignments", () => {
    expect(validatePlacements([placement(1), placement(1)] as any)).toContain("once");
    expect(validatePlacements(Array.from({ length: 12 }, (_, i) => placement(i + 1)) as any)).toContain("eleven");
    expect(validatePlacements([{ ...placement(1), x: NaN }] as any)).toContain("Invalid");
  });
});

describe("private match lineup lifecycle", () => {
  it("keeps old grants view-only, protects anonymous access and returns no private profiles", async () => {
    const denied = await request(app).get(path());
    expect(denied.status).toBe(403);
    expect(denied.headers["cache-control"]).toContain("no-store");
    const view = await staff("get");
    expect(view.status).toBe(200);
    expect(view.body.canEdit).toBe(false);
    expect(view.body.people).toHaveLength(3);
    expect(JSON.stringify(view.body)).not.toMatch(/example.invalid|PRIVATE/);
    expect((await staff("put").send(draft(0))).status).toBe(403);
    expect((await pub()).body).toEqual({ published: null, publishedAt: null });
  });
  it("explicitly grants lineup management through the existing admin grant API", async () => {
    const response = await request(app).put("/api/staff/access/grants").set("x-session-token", adminToken)
      .send({ playerId: coach, teamId: team, seasonId, roleLabel: "Coach", manageAttendance: true, manageSchedule: true, manageLineups: true, version: 1 });
    expect(response.status).toBe(200);
    expect((await staff("get")).body.canEdit).toBe(true);
  });
  it("rejects invalid placements and newly selected unavailable/ineligible players", async () => {
    expect((await staff("put").send({ ...draft(0), placements: [placement(player), placement(player)] })).status).toBe(400);
    expect((await staff("put").send({ ...draft(0), placements: [{ ...placement(player), x: 101 }] })).status).toBe(400);
    expect((await staff("put").send(draft(0, [outsider]))).status).toBe(409);
    expect((await staff("put").send(draft(0, [coach]))).status).toBe(409);
    expect((await staff("put").send(draft(0))).status).toBe(200);
  });
  it("reopens saved drafts but does not expose them to players", async () => {
    const saved = await staff("get");
    expect(saved.body.revision).toBe(1);
    expect(saved.body.draft.players[0].playerId).toBe(player);
    expect((await pub()).body).toEqual({ published: null, publishedAt: null });
  });
  it("serializes competing saves and rejects stale publication", async () => {
    const results = await Promise.all([staff("put").send(draft(1)), staff("put").send(draft(1))]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await staff("post", "/publication").send({ revision: 1, action: "publish" })).status).toBe(409);
  });
  it("publishes only the saved version, with minimal read-only player data", async () => {
    const published = await staff("post", "/publication").send({ revision: 2, action: "publish" });
    expect(published.status).toBe(200);
    const visible = await pub();
    expect(visible.status).toBe(200);
    expect(visible.body.published.players[0].name).toBe(`${tag}-1`);
    expect(Object.keys(visible.body).sort()).toEqual(["published", "publishedAt"]);
    expect(JSON.stringify(visible.body)).not.toMatch(/draft|people|issues|PRIVATE|example.invalid/);
    expect(visible.headers["cache-control"]).toContain("no-store");
  });
  it("keeps later draft changes separate from the publication and labels Maybe", async () => {
    expect((await staff("put").send(draft(3, [player, maybe]))).status).toBe(200);
    expect((await pub()).body.published.players).toHaveLength(1);
    expect((await staff("get")).body.draft.players.find((p: any) => p.playerId === maybe).status).toBe("maybe");
  });
  it("flags changed availability without altering saved placements or published selection", async () => {
    await db.update(matchRsvpsTable).set({ status: "no" }).where(and(eq(matchRsvpsTable.matchId, match), eq(matchRsvpsTable.playerId, player)));
    const flagged = await staff("get");
    expect(flagged.body.issues[0].reason).toContain("Not going");
    expect(flagged.body.draft.players).toHaveLength(2);
    expect((await staff("post", "/publication").send({ revision: 4, action: "publish" })).status).toBe(409);
    expect((await pub()).body.published.players).toHaveLength(1);
    // Stale placements can be retained in draft for review but cannot be published.
    expect((await staff("put").send(draft(4, [player, maybe]))).status).toBe(200);
    expect((await staff("put").send(draft(5, [maybe]))).status).toBe(200);
    expect((await staff("post", "/publication").send({ revision: 6, action: "publish" })).status).toBe(200);
    expect((await pub()).body.published.players[0].status).toBe("maybe");
  });
  it("requires review of Yes/Maybe transitions and refreshes their snapshot on save", async () => {
    await db.update(matchRsvpsTable).set({ status: "yes" }).where(and(eq(matchRsvpsTable.matchId, match), eq(matchRsvpsTable.playerId, maybe)));
    expect((await staff("get")).body.issues[0].reason).toContain("availability changed");
    expect((await staff("post", "/publication").send({ revision: 7, action: "publish" })).status).toBe(409);
    expect((await staff("put").send(draft(7, [maybe]))).status).toBe(200);
    expect((await staff("post", "/publication").send({ revision: 8, action: "publish" })).status).toBe(200);
  });
  it("blocks unrelated teams, historical matches and forged player writes", async () => {
    expect((await request(app).get(`/api/staff/teams/${foreignTeam}/matches/${match}/lineup`).set("x-session-token", staffToken)).status).toBe(404);
    expect((await request(app).get(`/api/staff/teams/${team}/matches/${archived}/lineup`).set("x-session-token", adminToken)).status).toBe(403);
    expect((await request(app).get(`/api/player-auth/matches/${match}/lineup`).set("x-player-session", outsiderToken)).status).toBe(403);
    expect((await request(app).put(path()).set("x-player-session", playerToken).send(draft(9))).status).toBe(403);
  });
  it("flags squad changes and denies member viewing immediately", async () => {
    await db.update(playerParticipationsTable).set({ teamId: foreignTeam }).where(and(eq(playerParticipationsTable.playerId, maybe), eq(playerParticipationsTable.seasonId, seasonId)));
    expect((await staff("get")).body.issues[0].reason).toContain("no longer");
    expect((await staff("post", "/publication").send({ revision: 9, action: "publish" })).status).toBe(409);
    await db.update(playerParticipationsTable).set({ teamId: foreignTeam }).where(and(eq(playerParticipationsTable.playerId, player), eq(playerParticipationsTable.seasonId, seasonId)));
    expect((await pub()).status).toBe(403);
    await db.update(playerParticipationsTable).set({ teamId: team }).where(and(eq(playerParticipationsTable.playerId, player), eq(playerParticipationsTable.seasonId, seasonId)));
  });
  it("withdraws a publication while preserving the private draft", async () => {
    const withdrawn = await full("post", "/publication").send({ revision: 9, action: "withdraw" });
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.draft.players).toHaveLength(1);
    expect((await pub()).body).toEqual({ published: null, publishedAt: null });
  });
  it("enforces changed permission, current-season membership and completed-match read-only rules", async () => {
    await db.update(staffTeamGrantsTable).set({ manageLineups: false }).where(eq(staffTeamGrantsTable.playerId, coach));
    expect((await staff("get")).body.canEdit).toBe(false);
    expect((await staff("post", "/publication").send({ revision: 10, action: "publish" })).status).toBe(403);
    await db.update(staffTeamGrantsTable).set({ manageLineups: true }).where(eq(staffTeamGrantsTable.playerId, coach));
    await db.update(matchesTable).set({ status: "final" }).where(eq(matchesTable.id, match));
    expect((await full("get")).body.canEdit).toBe(false);
    expect((await full("put").send(draft(10))).status).toBe(403);
    await db.update(matchesTable).set({ status: "scheduled", kickoffAt: new Date("2025-12-01T12:00:00Z") }).where(eq(matchesTable.id, match));
    expect((await full("get")).status).toBe(403);
    expect((await pub()).status).toBe(404);
    await db.update(matchesTable).set({ kickoffAt: new Date("2026-12-01T12:00:00Z") }).where(eq(matchesTable.id, match));
  });
  it("rejects empty publications and prevents moving a board to another team", async () => {
    await db.update(matchesTable).set({ teamId: foreignTeam }).where(eq(matchesTable.id, match));
    expect((await request(app).get(`/api/staff/teams/${foreignTeam}/matches/${match}/lineup`).set("x-session-token", adminToken)).status).toBe(409);
    await db.update(matchesTable).set({ teamId: team }).where(eq(matchesTable.id, match));
    const empty = await full("put").send(draft(10, []));
    expect(empty.status).toBe(200);
    expect((await full("post", "/publication").send({ revision: 11, action: "publish" })).status).toBe(409);
  });
  it("rejects revoked staff and expired-season grants, while full admins retain their explicit entry", async () => {
    await db.update(staffTeamGrantsTable).set({ revokedAt: new Date() }).where(eq(staffTeamGrantsTable.playerId, coach));
    expect((await staff("get")).status).toBe(403);
    expect((await staff("put").send(draft(10))).status).toBe(403);
    expect((await full("get")).status).toBe(200);
    const [row] = await db.select().from(matchLineupsTable).where(eq(matchLineupsTable.matchId, match));
    expect(row.revision).toBe(11);
  });
});
