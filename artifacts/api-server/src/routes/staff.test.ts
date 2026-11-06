import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, playersTable, teamsTable, seasonsTable, playerParticipationsTable, staffTeamGrantsTable,
  staffSessionsTable, staffAuditTable, adminSessionsTable, playerSessionsTable, matchesTable,
  eventsTable, eventRsvpsTable, emailBlastsTable, matchRsvpAdminChangesTable,
  playerLoginCodesTable,
} from "@workspace/db";
import { createSession, validateSession } from "../middleware/adminSession";
import { createPlayerSession } from "../middleware/playerSession";
import app from "../app";

vi.mock("../utils/email", () => ({
  sendMatchReminderEmail: vi.fn().mockResolvedValue(true),
  sendRsvpReminderEmail: vi.fn().mockResolvedValue(true),
  sendNewEventEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock("../utils/push", () => ({ sendPushToPlayers: vi.fn().mockResolvedValue(undefined) }));
import { sendMatchReminderEmail, sendRsvpReminderEmail, sendNewEventEmail } from "../utils/email";

const tag = `staff-access-${crypto.randomBytes(5).toString("hex")}`;
let adminToken: string, staffToken: string, otherToken: string, ordinaryToken: string;
let seasonId: number, wrongSeasonId: number;
let a: number, b: number, c: number, coach: number, other: number, p1: number, p2: number, outsider: number;
let matchId: number, eventId: number, foreignMatch: number, groupEvent: number, publicEvent: number, archivedMatch: number;
const teamIds: number[] = [], playerIds: number[] = [], matchIds: number[] = [], eventIds: number[] = [];
const future = new Date(Date.now() + 14 * 86400000).toISOString();
const staff = (method: "get" | "post" | "put" | "patch" | "delete", path: string, token = staffToken) =>
  request(app)[method](`/api/staff${path}`).set("x-session-token", token);
const full = (method: "get" | "post" | "put" | "patch", path: string) =>
  request(app)[method](`/api/staff${path}`).set("x-session-token", adminToken);

async function grant(playerId: number, teamId: number, manageAttendance: boolean, manageSchedule: boolean, version = 0) {
  return full("put", "/access/grants").send({ playerId, teamId, seasonId, manageAttendance, manageSchedule, roleLabel: "Coach", version });
}
async function currentGrant(playerId: number, teamId: number) {
  const [row] = await db.select().from(staffTeamGrantsTable).where(and(eq(staffTeamGrantsTable.playerId, playerId), eq(staffTeamGrantsTable.teamId, teamId), eq(staffTeamGrantsTable.seasonId, seasonId)));
  return row;
}
beforeAll(async () => {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27"));
  seasonId = season.id;
  const [wrong] = await db.insert(seasonsTable).values({ slug: tag, name: tag, kind: "membership", status: "archived", isCurrent: false }).returning();
  wrongSeasonId = wrong.id;
  for (let i = 0; i < 3; i++) {
    const [team] = await db.insert(teamsTable).values({ name: `${tag}-team-${i}`, category: "Test", managerName: "", managerEmail: "", managerPhone: "", isInternal: false }).returning();
    teamIds.push(team.id);
  }
  [a, b, c] = teamIds;
  for (let i = 0; i < 5; i++) {
    const [p] = await db.insert(playersTable).values({
      name: `${tag}-person-${i}`, email: `${tag}-${i}@example.invalid`, teamId: b, position: "Midfield", memberStatus: "active",
      phone: "PRIVATE PHONE", passportNumber: "PRIVATE PASSPORT", notes: "PRIVATE NOTES",
    }).returning();
    playerIds.push(p.id);
  }
  [coach, other, p1, p2, outsider] = playerIds;
  await db.insert(playerParticipationsTable).values([
    { playerId: p1, seasonId, teamId: a, participationStatus: "active", source: tag },
    { playerId: p2, seasonId, teamId: a, participationStatus: "active", source: tag },
    { playerId: outsider, seasonId, teamId: b, participationStatus: "active", source: tag },
  ]);
  adminToken = await createSession(tag);
  ordinaryToken = await createPlayerSession(outsider);
  expect((await grant(coach, a, true, true)).status).toBe(200);
  expect((await grant(coach, b, false, false)).status).toBe(200);
  expect((await grant(other, c, false, false)).status).toBe(200);
  const playerToken = await createPlayerSession(coach);
  const secondToken = await createPlayerSession(other);
  staffToken = (await request(app).post("/api/staff/session").set("x-player-session", playerToken)).body.token;
  otherToken = (await request(app).post("/api/staff/session").set("x-player-session", secondToken)).body.token;
  expect(staffToken).toBeTypeOf("string");
  for (const teamId of [a, b, a]) {
    const [match] = await db.insert(matchesTable).values({ teamId, opponent: tag, kickoffAt: new Date(future), status: "scheduled", operationalScope: matchIds.length === 2 ? "world_cup_2026" : "local_2026_27" }).returning();
    matchIds.push(match.id);
  }
  [matchId, foreignMatch, archivedMatch] = matchIds;
  for (const values of [
    { teamId: a, audienceMode: "squad", isPublic: false },
    { teamId: null, audienceMode: "groups", isPublic: false },
    { teamId: a, audienceMode: "squad", isPublic: true },
  ]) {
    const [event] = await db.insert(eventsTable).values({ ...values, kind: "training", title: tag, startsAt: new Date(future), operationalScope: "local_2026_27" }).returning();
    eventIds.push(event.id);
  }
  [eventId, groupEvent, publicEvent] = eventIds;
}, 30000);

afterAll(async () => {
  await db.delete(staffAuditTable).where(inArray(staffAuditTable.teamId, teamIds));
  await db.delete(emailBlastsTable).where(eq(emailBlastsTable.sentByEmail, `${tag}-person-0 (staff #${coach})`));
  if (matchIds.length) await db.delete(matchesTable).where(inArray(matchesTable.id, matchIds));
  if (eventIds.length) await db.delete(eventsTable).where(inArray(eventsTable.id, eventIds));
  await db.delete(playerLoginCodesTable).where(inArray(playerLoginCodesTable.email, playerIds.map((_, index) => `${tag}-${index}@example.invalid`)));
  if (playerIds.length) await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
  if (playerIds.length) await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  if (teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
  await db.delete(seasonsTable).where(eq(seasonsTable.id, wrongSeasonId));
  await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, adminToken));
});

describe("restricted team staff access", () => {
  it("redeems the existing email code once and exchanges its player session for restricted staff access", async () => {
    const email = `${tag}-0@example.invalid`;
    const code = String(crypto.randomInt(100000, 1000000));
    await db.insert(playerLoginCodesTable).values({
      email, codeHash: crypto.createHash("sha256").update(code).digest("hex"),
      expiresAt: new Date(Date.now() + 15 * 60000),
    });
    const verified = await request(app).post("/api/player-auth/verify-code").send({ email: ` ${email.toUpperCase()} `, code });
    expect(verified.status).toBe(200);
    const exchanged = await request(app).post("/api/staff/session").set("x-player-session", verified.body.sessionToken);
    expect(exchanged.status).toBe(200);
    expect(await validateSession(exchanged.body.token)).toBe(false);
    const reused = await request(app).post("/api/player-auth/verify-code").send({ email, code });
    expect(reused.status).toBe(401);
  });

  it("uses personal sessions without ever accepting them as full-admin or ordinary player sessions", async () => {
    expect(await validateSession(staffToken)).toBe(false);
    expect((await request(app).get("/api/admin/auth").set("x-session-token", staffToken)).body.kind).toBe("staff");
    expect((await request(app).get("/api/admin/auth").set("x-session-token", adminToken)).body.kind).toBe("admin");
    expect((await request(app).post("/api/staff/session").set("x-player-session", ordinaryToken)).status).toBe(403);
    expect((await request(app).post("/api/staff/session").set("x-player-session", staffToken)).status).toBe(401);
    for (const route of ["/players", "/teams", "/dashboard", "/groups", "/matches", "/events", "/reports", "/showcase", "/site-content"]) {
      expect((await request(app).get(`/api${route}`).set("x-session-token", staffToken)).status, route).toBe(403);
    }
    expect((await staff("get", "/access")).status).toBe(401);
    expect((await request(app).get("/api/players").set("Authorization", `Bearer ${staffToken}`)).status).toBe(401);
  });

  it("shows only assigned teams and minimal roster fields, using current participation rather than historical primary team", async () => {
    const identity = await staff("get", "/me");
    expect(identity.status).toBe(200);
    expect(identity.body.grants.map((g: { teamId: number }) => g.teamId).sort()).toEqual([a, b].sort());
    const result = await staff("get", `/teams/${a}`);
    expect(result.status).toBe(200);
    expect(result.headers["cache-control"]).toBe("private, no-store");
    expect(result.body.roster.map((p: { id: number }) => p.id).sort()).toEqual([p1, p2].sort());
    for (const player of result.body.roster) expect(Object.keys(player).sort()).toEqual(["id", "name", "position", "shirtNumber"]);
    expect(JSON.stringify(result.body)).not.toContain("PRIVATE");
    expect(result.body.matches.map((m: { id: number }) => m.id)).toEqual([matchId]);
    expect(result.body.events.map((e: { id: number }) => e.id)).toEqual([eventId]);
    expect((await staff("get", `/teams/${c}`)).status).toBe(403);
    expect((await staff("get", `/teams/${a}`, otherToken)).status).toBe(403);
    expect((await staff("get", `/teams/${a}/matches/${foreignMatch}/attendance`)).status).toBe(403);
    expect((await staff("get", `/teams/${a}/matches/${archivedMatch}/attendance`)).status).toBe(403);
    expect((await staff("get", `/teams/${a}/events/${groupEvent}/attendance`)).status).toBe(403);
    expect((await staff("get", `/teams/${a}/events/${publicEvent}/attendance`)).status).toBe(403);
  });

  it("enforces per-team capabilities, including writes and recipient list overrides", async () => {
    expect((await staff("post", `/teams/${b}/matches`).send({ teamId: b, opponent: tag, kickoffAt: future, status: "scheduled" })).status).toBe(403);
    expect((await staff("post", `/teams/${b}/matches/${foreignMatch}/remind`).send({ playerIds: [p1] })).status).toBe(403);
    expect((await staff("put", `/teams/${b}/matches/${foreignMatch}/attendance/${outsider}`).send({ status: "yes", expected: null })).status).toBe(403);
    const saved = await staff("put", `/teams/${a}/matches/${matchId}/attendance/${p1}`).send({ status: "yes", expected: null });
    expect(saved.status).toBe(200);
    expect((await staff("put", `/teams/${a}/matches/${matchId}/attendance/${outsider}`).send({ status: "yes", expected: null })).status).toBe(403);
    const roster = (await staff("get", `/teams/${a}/matches/${matchId}/attendance`)).body;
    expect(roster.counts.yes).toBe(1);
    expect(roster.people.find((p: { playerId: number }) => p.playerId === p1).expected.revision).toBe(1);
    expect((await staff("put", `/teams/${a}/matches/${matchId}/attendance/${p1}`).send({ status: "no", note: "Unavailable", expected: null })).status).toBe(409);
    const [change] = await db.select().from(matchRsvpAdminChangesTable).where(eq(matchRsvpAdminChangesTable.matchId, matchId));
    expect(change.actor).toContain(`staff #${coach}`);
  });

  it("protects event replies against concurrent player edits and permits clearing only a current version", async () => {
    expect((await staff("put", `/teams/${a}/events/${eventId}/attendance/${p1}`).send({ status: "maybe", note: "Checking", expected: null })).status).toBe(200);
    const before = (await staff("get", `/teams/${a}/events/${eventId}/attendance`)).body.people.find((p: { playerId: number }) => p.playerId === p1);
    const playerToken = await createPlayerSession(p1);
    expect((await request(app).post(`/api/player-auth/events/${eventId}/rsvp`).set("x-player-session", playerToken).send({ status: "yes" })).status).toBe(200);
    expect((await staff("put", `/teams/${a}/events/${eventId}/attendance/${p1}`).send({ status: "no", note: "Old edit", expected: before.expected })).status).toBe(409);
    const current = (await staff("get", `/teams/${a}/events/${eventId}/attendance`)).body.people.find((p: { playerId: number }) => p.playerId === p1);
    expect(current.expected.revision).toBe(before.expected.revision + 1);
    expect((await staff("put", `/teams/${a}/events/${eventId}/attendance/${p1}`).send({ status: null, expected: current.expected })).status).toBe(200);
    expect((await staff("put", `/teams/${a}/events/${eventId}/attendance/${outsider}`).send({ status: "yes", expected: null })).status).toBe(403);
  });

  it("creates and edits private team schedules without allowing team changes, groups, publicity or notifications", async () => {
    const body = { teamId: a, opponent: tag, kickoffAt: future, status: "scheduled", notes: "Operational" };
    const created = await staff("post", `/teams/${a}/matches`).send(body);
    expect(created.status).toBe(201);
    matchIds.push(created.body.id);
    expect((await staff("patch", `/teams/${a}/matches/${created.body.id}`).send({ ...body, venue: "Test pitch" })).status).toBe(200);
    expect((await staff("patch", `/teams/${a}/matches/${created.body.id}`).send({ ...body, teamId: b })).status).toBe(403);
    expect((await staff("patch", `/teams/${a}/matches/${foreignMatch}`).send(body)).status).toBe(403);
    expect((await staff("delete", `/teams/${a}/matches/${created.body.id}`)).status).toBe(404);
    const event = { kind: "training", title: tag, startsAt: future, teamId: a, audienceMode: "squad", groupIds: [], isPublic: false, sendNotify: false };
    const createdEvent = await staff("post", `/teams/${a}/events`).send(event);
    expect(createdEvent.status).toBe(201);
    eventIds.push(createdEvent.body.id);
    expect((await staff("patch", `/teams/${a}/events/${createdEvent.body.id}`).send({ ...event, title: `${tag} edited` })).status).toBe(200);
    for (const override of [{ isPublic: true }, { teamId: b }, { audienceMode: "groups", groupIds: [1] }, { sendNotify: true }, { photoUrl: "bad" }]) {
      expect((await staff("post", `/teams/${a}/events`).send({ ...event, ...override })).status).toBe(403);
    }
    expect((await staff("patch", `/teams/${a}/events/${publicEvent}`).send(event)).status).toBe(403);
    expect(sendNewEventEmail).not.toHaveBeenCalled();
  });

  it("sends reminders to only eligible nonresponders and prevents duplicate or uncertain event resends", async () => {
    vi.mocked(sendMatchReminderEmail).mockClear();
    const matchReminder = await staff("post", `/teams/${a}/matches/${matchId}/remind`).send({ playerIds: [outsider], force: true });
    expect(matchReminder.status).toBe(200);
    expect(vi.mocked(sendMatchReminderEmail).mock.calls.map(([data]) => data.playerName)).toEqual([`${tag}-person-3`]);
    const matchAgain = await staff("post", `/teams/${a}/matches/${matchId}/remind`);
    expect(matchAgain.body.sent).toBe(0);
    vi.mocked(sendRsvpReminderEmail).mockClear();
    vi.mocked(sendRsvpReminderEmail).mockResolvedValueOnce(false).mockResolvedValue(true);
    const eventReminder = await staff("post", `/teams/${a}/events/${eventId}/remind`).send({ playerIds: [outsider] });
    expect(eventReminder.status).toBe(200);
    expect(eventReminder.body.sent).toBe(1);
    expect(eventReminder.body.failed).toBe(1);
    const again = await staff("post", `/teams/${a}/events/${eventId}/remind`);
    expect(again.body.sent).toBe(0);
    expect(again.body.skippedUncertain).toBe(1);
    expect(again.body.skippedAlreadySent).toBe(1);
    expect(sendRsvpReminderEmail).toHaveBeenCalledTimes(2);
  }, 10000);

  it("records attributable outcomes without credentials and rejects stale grant writes or wrong seasons", async () => {
    const directory = await full("get", "/access");
    expect(directory.status).toBe(200);
    const audit = directory.body.audit.filter((row: { teamId: number }) => teamIds.includes(row.teamId));
    expect(audit.some((row: { actorPlayerId: number; status: number }) => row.actorPlayerId === coach && row.status === 200)).toBe(true);
    expect(JSON.stringify(audit)).not.toContain(staffToken);
    expect((await grant(coach, a, true, true, 0)).status).toBe(409);
    expect((await full("put", "/access/grants").send({ playerId: coach, teamId: c, seasonId: wrongSeasonId, manageAttendance: false, manageSchedule: false, roleLabel: "Manager", version: 0 })).status).toBe(409);
    const version = (await currentGrant(coach, b)).version;
    const results = await Promise.all([grant(coach, b, true, false, version), grant(coach, b, false, true, version)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("applies permission downgrade, revocation, membership suspension and session expiry immediately", async () => {
    const row = await currentGrant(coach, a);
    expect((await grant(coach, a, false, false, row.version)).status).toBe(200);
    expect((await staff("get", `/teams/${a}`)).status).toBe(200);
    expect((await staff("post", `/teams/${a}/matches`).send({ teamId: a, opponent: tag, kickoffAt: future, status: "scheduled" })).status).toBe(403);
    const latest = await currentGrant(coach, a);
    expect((await full("post", `/access/grants/${latest.id}/revoke`).send({ version: latest.version })).status).toBe(204);
    expect((await staff("get", `/teams/${a}`)).status).toBe(403);
    expect((await staff("get", `/teams/${b}`)).status).toBe(200);
    await db.update(playersTable).set({ memberStatus: "inactive" }).where(eq(playersTable.id, coach));
    expect((await staff("get", "/me")).status).toBe(403);
    await db.update(playersTable).set({ memberStatus: "active" }).where(eq(playersTable.id, coach));
    await db.update(staffSessionsTable).set({ expiresAt: new Date(0) }).where(eq(staffSessionsTable.token, staffToken));
    expect((await staff("get", "/me")).status).toBe(403);
    expect((await request(app).get("/api/players").set("x-session-token", staffToken)).status).toBe(403);
    expect(await validateSession(adminToken)).toBe(true);
  });
});
