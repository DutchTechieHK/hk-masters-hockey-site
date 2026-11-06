import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { db, playersTable, teamsTable, seasonsTable, shirtContextsTable, shirtAssignmentsTable, shirtAuditTable,
  playerParticipationsTable, staffTeamGrantsTable, staffSessionsTable, playerSessionsTable, worldCupPlayerSnapshotsTable,
  adminSessionsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { createSession } from "../middleware/adminSession";
import { createPlayerSession } from "../middleware/playerSession";
import { withLeagueNumbers, shirtSummaries } from "../utils/shirtNumbers";

vi.mock("../utils/email", () => ({
  sendMatchReminderEmail: vi.fn().mockResolvedValue(true),
  sendRsvpReminderEmail: vi.fn().mockResolvedValue(true),
  sendNewEventEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock("../utils/push", () => ({ sendPushToPlayers: vi.fn(async () => {}) }));
const { default: app } = await import("../app");
const tag = `shirt-test-${crypto.randomUUID()}`;
let admin: string, playerToken: string, staff: string;
let playerId: number, otherId: number, teamId: number, otherTeamId: number, league: number, tournament: number, seasonId: number;
const contextIds: number[] = [];
const call = (id: number, body: object) => request(app).post(`/api/shirt-numbers/players/${id}`).set("x-session-token", admin).send(body);
const load = () => request(app).get(`/api/shirt-numbers/players/${playerId}`).set("x-session-token", admin);
beforeAll(async () => {
  seasonId = (await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27")))[0].id;
  teamId = (await db.insert(teamsTable).values({ name: tag, category: "Test", managerName: "", managerEmail: "", managerPhone: "" }).returning())[0].id;
  otherTeamId = (await db.insert(teamsTable).values({ name: tag + "-other", category: "Test", managerName: "", managerEmail: "", managerPhone: "" }).returning())[0].id;
  for (const [index, number] of [44, 45].entries()) {
    const p = (await db.insert(playersTable).values({ name: tag + index, email: `${tag}${index}@example.invalid`, teamId, shirtNumber: number }).returning())[0];
    if (index === 0) playerId = p.id; else otherId = p.id;
  }
  admin = await createSession(tag);
  playerToken = await createPlayerSession(playerId);
  await db.insert(staffTeamGrantsTable).values({ playerId, teamId, seasonId, manageAttendance: true });
  staff = (await request(app).post("/api/staff/session").set("x-player-session", playerToken)).body.token;
  const a = await request(app).post("/api/shirt-numbers/contexts").set("x-session-token", admin).send({ name: tag + "-league", kind: "league" });
  const b = await request(app).post("/api/shirt-numbers/contexts").set("x-session-token", admin).send({ name: tag + "-cup", kind: "tournament" });
  expect(a.status).toBe(201); expect(b.status).toBe(201);
  league = a.body.id; tournament = b.body.id; contextIds.push(league, tournament);
});
afterAll(async () => {
  const ids = [playerId, otherId].filter(Boolean);
  if (ids.length) {
    await db.delete(staffSessionsTable).where(inArray(staffSessionsTable.playerId, ids));
    await db.delete(staffTeamGrantsTable).where(inArray(staffTeamGrantsTable.playerId, ids));
    await db.delete(playerSessionsTable).where(inArray(playerSessionsTable.playerId, ids));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, ids));
    await db.delete(worldCupPlayerSnapshotsTable).where(inArray(worldCupPlayerSnapshotsTable.playerId, ids));
    await db.delete(shirtAuditTable).where(inArray(shirtAuditTable.playerId, ids));
    await db.delete(shirtAssignmentsTable).where(inArray(shirtAssignmentsTable.playerId, ids));
    await db.delete(playersTable).where(inArray(playersTable.id, ids));
  }
  if (contextIds.length) await db.delete(shirtContextsTable).where(inArray(shirtContextsTable.id, contextIds));
  if (teamId) await db.delete(teamsTable).where(inArray(teamsTable.id, [teamId, otherTeamId]));
  if (admin) await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, admin));
});
describe("competition shirt numbers", () => {
  it("requires full-admin access, never accepts player or restricted staff sessions", async () => {
    expect((await request(app).get(`/api/shirt-numbers/players/${playerId}`)).status).toBe(401);
    expect((await request(app).get(`/api/shirt-numbers/players/${playerId}`).set("x-player-session", playerToken)).status).toBe(401);
    expect((await request(app).get(`/api/shirt-numbers/players/${playerId}`).set("x-session-token", staff)).status).toBe(403);
    const r = await load(); expect(r.body.legacyNumber).toBe(44); expect(r.body.assignments).toEqual([]);
    expect(r.headers["cache-control"]).toContain("no-store");
  });
  it("keeps simultaneous league/tournament numbers and preserves old assignments on change", async () => {
    let r = await call(playerId, { revision: 0, action: "assign", contextId: league, teamId, number: 27 });
    expect(r.status).toBe(200);
    r = await call(playerId, { revision: 1, action: "assign", contextId: tournament, teamId, number: 12 });
    expect(r.body.assignments.filter((a: any) => a.status === "current")).toHaveLength(2);
    const previous = r.body.assignments.find((a: any) => a.contextId === league);
    r = await call(playerId, { revision: 2, action: "change", assignmentId: previous.id, number: 28, startsOn: "2026-11-01" });
    expect(r.status).toBe(200);
    expect(r.body.assignments.find((a: any) => a.id === previous.id)).toMatchObject({ number: 27, status: "historical", endsOn: "2026-11-01" });
    expect(r.body.assignments.find((a: any) => a.contextId === tournament)).toMatchObject({ number: 12, status: "current" });
    expect(r.body.audit).toHaveLength(3);
    expect(JSON.stringify(r.body.audit)).not.toContain(admin);
  });
  it("retains unknown historic dates and explicitly attributes legacy numbers", async () => {
    const r = await call(playerId, { revision: 3, action: "history", contextId: league, teamId, number: 44, attributeLegacy: true, notes: "Confirmed by kit list" });
    expect(r.status).toBe(200); expect(r.body.legacyNumber).toBeNull();
    expect(r.body.assignments.find((a: any) => a.number === 44)).toMatchObject({ status: "historical", startsOn: null, endsOn: null });
    expect(r.body.assignments.filter((a: any) => a.status === "current")).toHaveLength(2);
  });
  it("rejects stale and concurrent edits instead of silently overwriting them", async () => {
    expect((await call(playerId, { revision: 0, action: "assign", contextId: league, teamId, number: 9 })).status).toBe(409);
    const results = await Promise.all([call(playerId, { revision: 4, action: "history", contextId: tournament, teamId, number: 2 }),
      call(playerId, { revision: 4, action: "history", contextId: tournament, teamId, number: 3 })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it("supports reasoned corrections, ending, and voiding without deletion", async () => {
    let r = await load();
    const a = r.body.assignments.find((a: any) => a.number === 28 && a.status === "current");
    expect((await call(playerId, { revision: r.body.revision, action: "correct", assignmentId: a.id, number: 29 })).status).toBe(400);
    r = await call(playerId, { revision: r.body.revision, action: "correct", assignmentId: a.id, number: 29, reason: "Typo" });
    expect(r.status).toBe(200);
    r = await call(playerId, { revision: r.body.revision, action: "end", assignmentId: a.id });
    expect(r.body.assignments.find((v: any) => v.id === a.id).status).toBe("historical");
    r = await call(playerId, { revision: r.body.revision, action: "void", assignmentId: a.id, reason: "Duplicate evidence" });
    expect(r.body.assignments.find((v: any) => v.id === a.id).status).toBe("void");
    expect(r.body.audit[0]).toMatchObject({ action: "void", reason: "Duplicate evidence" });
  });
  it("warns about same-team competition duplicates without blocking other players", async () => {
    const r = await call(otherId, { revision: 0, action: "assign", contextId: tournament, teamId, number: 12 });
    expect(r.status).toBe(200); expect(r.body.warnings.length).toBeGreaterThan(0);
    const unrelated = await call(otherId, { revision: 1, action: "assign", contextId: tournament, teamId: otherTeamId, number: 12 });
    expect(unrelated.status).toBe(200);
  });
  it("validates numbers/dates/context moves and prohibits legacy editing bypasses", async () => {
    const h = (await load()).body;
    for (const number of [0, 100, 1.5]) expect((await call(playerId, { revision: h.revision, action: "history", contextId: league, teamId, number })).status).toBe(400);
    for (const startsOn of ["not-date", "2026-02-30", "2026-99-99"]) expect((await call(playerId, { revision: h.revision, action: "history", contextId: league, teamId, number: 5, startsOn })).status).toBe(400);
    const current = h.assignments.find((a: any) => a.status === "current");
    expect((await call(playerId, { revision: h.revision, action: "correct", assignmentId: current.id, contextId: league, reason: "Move" })).status).toBe(400);
    expect((await request(app).put(`/api/players/${playerId}`).set("x-session-token", admin).send({ shirtNumber: 1 })).status).toBe(409);
    expect((await request(app).post("/api/players").set("x-session-token", admin).send({ shirtNumber: 1 })).status).toBe(409);
    expect((await request(app).patch("/api/players/self/nonexistent-token").send({ shirtNumber: 1 })).status).toBe(403);
  });
  it("keeps immutable Rotterdam evidence unchanged and exposes only current summaries", async () => {
    const snapshot = { name: "Campaign name", shirt_number: 7, team_id: otherTeamId };
    await db.insert(worldCupPlayerSnapshotsTable).values({ playerId, snapshot });
    const h = await load(); expect(h.body.archiveEvidence[0]).toContain("#7");
    const summaries = await shirtSummaries([playerId]);
    expect(summaries.get(playerId)?.current.map((a) => a.number)).toEqual([12]);
    expect(summaries.get(playerId)?.legacyNumber).toBeNull();
    expect((await db.select().from(worldCupPlayerSnapshotsTable).where(eq(worldCupPlayerSnapshotsTable.playerId, playerId)))[0].snapshot).toEqual(snapshot);
  });
  it("resolves league numbers only from the requested season/team and never legacy", async () => {
    const [testSeason] = await db.insert(seasonsTable).values({ slug: tag, name: tag, kind: "membership", status: "archived" }).returning();
    const [context] = await db.insert(shirtContextsTable).values({ name: tag + "-linked", kind: "league", seasonId: testSeason.id, seasonName: testSeason.name }).returning();
    contextIds.push(context.id);
    try {
      await db.insert(shirtAssignmentsTable).values({ playerId, teamId, contextId: context.id, number: 83, teamName: tag, status: "current" });
      const rows = [{ id: playerId, teamId, shirtNumber: 44 }, { id: playerId, teamId: otherTeamId, shirtNumber: 44 }];
      expect((await withLeagueNumbers(rows, testSeason.id)).map((p) => p.shirtNumber)).toEqual([83, null]);
      expect((await withLeagueNumbers(rows, seasonId)).map((p) => p.shirtNumber)).toEqual([null, null]);
    } finally {
      await db.delete(shirtAssignmentsTable).where(eq(shirtAssignmentsTable.contextId, context.id));
      await db.delete(shirtContextsTable).where(eq(shirtContextsTable.id, context.id));
      await db.delete(seasonsTable).where(eq(seasonsTable.id, testSeason.id));
    }
  });
});
