import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db, playersTable, teamsTable, seasonsTable, playerParticipationsTable, playerSessionsTable,
  eventsTable, eventRsvpsTable, memberGroupsTable, eventGroupsTable, emailBlastsTable,
} from "@workspace/db";
import { createPlayerSession, requirePlayerSession } from "../middleware/playerSession";

const emails = vi.hoisted(() => ({ sendNewEventEmail: vi.fn(async (_input: { playerEmail: string }) => true), sendRsvpReminderEmail: vi.fn(async (_input: { playerEmail: string }) => true) }));
const pushes = vi.hoisted(() => ({ sendPushToPlayers: vi.fn(async (_ids: number[], _payload: unknown) => {}) }));
vi.mock("../utils/email", () => emails);
vi.mock("../utils/push", () => pushes);
vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.headers["x-test-admin"] === "yes" ? next() : res.sendStatus(401),
  hasAdminAccess: async (req: express.Request) => req.headers["x-test-admin"] === "yes",
}));

const { default: groupsRouter } = await import("./groups");
const { default: eventsRouter, playerRsvpHandler } = await import("./events");
const app = express();
app.use(express.json());
app.use("/api/groups", groupsRouter);
app.use("/api/events", eventsRouter);
app.post("/player/events/:id/rsvp", requirePlayerSession, playerRsvpHandler);
app.use((err: Error, _req: unknown, res: express.Response, _next: unknown) => res.status(500).json({ error: err.message }));

const tag = `groups-events-${Date.now()}`;
const playerIds: number[] = [], teamIds: number[] = [], groupIds: number[] = [], eventIds: number[] = [];
const tokens: string[] = [];
const admin = { "x-test-admin": "yes" };
let firstGroup: { id: number; version: number };
let secondGroup: { id: number; version: number };
let eventId: number;
const future = new Date(Date.now() + 30 * 86400_000).toISOString();
const input = () => ({ kind: "training", title: tag, startsAt: future, audienceMode: "groups", teamId: null, groupIds: [firstGroup.id, secondGroup.id], sendNotify: false, isPublic: false });

beforeAll(async () => {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27"));
  if (!season) throw new Error("Current membership season required");
  for (let n = 0; n < 2; n++) {
    const [team] = await db.insert(teamsTable).values({ name: `${tag}-${n}`, category: "test", managerName: "", managerEmail: "", managerPhone: "" }).returning();
    teamIds.push(team.id);
  }
  for (let n = 0; n < 4; n++) {
    const [player] = await db.insert(playersTable).values({
      name: `${tag}-${n}`, email: `${tag}-${n}@example.com`, teamId: n < 2 ? teamIds[0] : teamIds[1],
      memberStatus: "active", currentMembershipSection: "men",
    }).returning();
    playerIds.push(player.id);
    // These members have NO World Cup participation. One has no participation at all.
    if (n !== 2) await db.insert(playerParticipationsTable).values({
      playerId: player.id, seasonId: season.id, teamId: n === 0 ? teamIds[1] : teamIds[0],
      participationStatus: "active", source: "groups_test",
    });
    tokens.push(await createPlayerSession(player.id));
  }
});

afterAll(async () => {
  await db.delete(emailBlastsTable).where(eq(emailBlastsTable.subject, `Quick reply needed: ${tag}`));
  if (eventIds.length) await db.delete(eventsTable).where(inArray(eventsTable.id, eventIds));
  if (groupIds.length) await db.delete(memberGroupsTable).where(inArray(memberGroupsTable.id, groupIds));
  if (playerIds.length) {
    await db.delete(playerSessionsTable).where(inArray(playerSessionsTable.playerId, playerIds));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
  if (teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
});

describe("manually curated event groups", () => {
  it("protects the directory, memberships, and writes from unauthenticated/player access", async () => {
    expect((await request(app).get("/api/groups")).status).toBe(401);
    expect((await request(app).get("/api/groups/members").set("Authorization", `Bearer ${tokens[0]}`)).status).toBe(401);
    expect((await request(app).post("/api/groups").send({ name: tag, memberIds: [] })).status).toBe(401);
  });

  it("includes non-World-Cup members and creates overlapping reusable groups", async () => {
    const directory = await request(app).get("/api/groups/members").set(admin);
    expect(directory.status).toBe(200);
    expect(directory.body.filter((member: { id: number }) => playerIds.includes(member.id))).toHaveLength(4);
    expect(Object.keys(directory.body.find((member: { id: number }) => member.id === playerIds[2])).sort())
      .toEqual(["id", "memberStatus", "membershipSection", "name", "teamName"]);
    for (const members of [[playerIds[0], playerIds[1], playerIds[1]], [playerIds[1], playerIds[2]]]) {
      const result = await request(app).post("/api/groups").set(admin).send({ name: `${tag}-${groupIds.length}`, description: "Manual invitees", memberIds: members });
      expect(result.status).toBe(201);
      groupIds.push(result.body.id);
      expect(result.body.memberIds).toEqual([...new Set(members)]);
    }
    [firstGroup, secondGroup] = groupIds.map((id) => ({ id, version: 1 }));
    expect((await request(app).post("/api/groups").set(admin).send({ name: tag, memberIds: [2147483647] })).status).toBe(400);
  });

  it("validates group audiences without accidentally broadening to everyone", async () => {
    for (const body of [
      { ...input(), groupIds: [] }, { ...input(), groupIds: [2147483647] },
      { ...input(), teamId: teamIds[0] }, { ...input(), isPublic: true },
      { ...input(), groupIds: [1.2] }, { ...input(), audienceMode: "squad" },
    ]) expect((await request(app).post("/api/events").set(admin).send(body)).status).toBe(400);
    const created = await request(app).post("/api/events").set(admin).send(input());
    expect(created.status).toBe(201);
    eventId = created.body.id; eventIds.push(eventId);
    expect(created.body.audienceMode).toBe("groups");
    expect(created.body.groupIds.sort()).toEqual([...groupIds].sort());
    expect((await request(app).get("/api/groups").set(admin)).body.find((group: { id: number }) => group.id === firstGroup.id).eventCount).toBe(1);
    expect((await request(app).get("/api/events").set(admin)).body.find((event: { id: number }) => event.id === eventId).groupIds.sort()).toEqual([...groupIds].sort());
  });

  it("uses membership union for player visibility, RSVP authorization and training names", async () => {
    for (let n = 0; n < 4; n++) {
      const visible = await request(app).get("/api/events").set("Authorization", `Bearer ${tokens[n]}`);
      expect(visible.status).toBe(200);
      expect(visible.body.some((event: { id: number }) => event.id === eventId)).toBe(n < 3);
      const reply = await request(app).post(`/player/events/${eventId}/rsvp`).set("Authorization", `Bearer ${tokens[n]}`).send({ status: "yes" });
      expect(reply.status).toBe(n < 3 ? 200 : 403);
    }
    const attendance = await request(app).get("/api/events/training-attendance").set("Authorization", `Bearer ${tokens[2]}`);
    const snapshot = attendance.body.events.find((event: { eventId: number }) => event.eventId === eventId);
    expect(snapshot.rsvpCounts.yes).toBe(3);
    expect(snapshot.goingPlayers.map((member: { id: number }) => member.id).sort()).toEqual(playerIds.slice(0, 3).sort());
    expect((await request(app).get("/api/events/training-attendance").set("Authorization", `Bearer ${tokens[3]}`)).body.events.some((event: { eventId: number }) => event.eventId === eventId)).toBe(false);
    const roster = await request(app).get(`/api/events/${eventId}/rsvps`).set(admin);
    expect(roster.body.counts).toEqual({ yes: 3, maybe: 0, no: 0, noResponse: 0, invited: 3 });
  });

  it("keeps group events private and prevents malformed public flags in storage", async () => {
    await expect(db.update(eventsTable).set({ isPublic: true }).where(eq(eventsTable.id, eventId))).rejects.toThrow();
    const publicEvents = await request(app).get("/api/events/public");
    expect(publicEvents.body.some((event: { id: number }) => event.id === eventId)).toBe(false);
  });

  it("preserves group audiences in legacy edits and refuses deletion of groups used by events", async () => {
    const { audienceMode: _mode, groupIds: _ids, ...legacyBody } = input();
    const updated = await request(app).patch(`/api/events/${eventId}`).set(admin).send(legacyBody);
    expect(updated.status).toBe(200);
    expect(updated.body.audienceMode).toBe("groups");
    expect(updated.body.groupIds.sort()).toEqual([...groupIds].sort());
    expect((await request(app).delete(`/api/groups/${firstGroup.id}?version=1`).set(admin)).status).toBe(409);
  });

  it("checks impact and changing group members preserves replies but excludes removed members", async () => {
    const impact = await request(app).get(`/api/events/${eventId}/audience-change-impact?audienceMode=groups&groupIds=${secondGroup.id}`).set(admin);
    expect(impact.body).toMatchObject({ currentlyCounted: 3, newlyCounted: 2, becomeIneligible: 1 });
    const body = { name: tag, memberIds: [], version: 1 };
    const results = await Promise.all([
      request(app).patch(`/api/groups/${firstGroup.id}`).set(admin).send(body),
      request(app).patch(`/api/groups/${firstGroup.id}`).set(admin).send(body),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    firstGroup.version = 2;
    const roster = await request(app).get(`/api/events/${eventId}/rsvps`).set(admin);
    expect(roster.body.counts).toEqual({ yes: 2, maybe: 0, no: 0, noResponse: 0, invited: 2 });
    expect(roster.body.excludedResponses.map((response: { playerId: number }) => response.playerId)).toContain(playerIds[0]);
    const stored = await db.select().from(eventRsvpsTable).where(eq(eventRsvpsTable.eventId, eventId));
    expect(stored).toHaveLength(3);
    expect((await request(app).get("/api/events").set("Authorization", `Bearer ${tokens[0]}`)).body.some((event: { id: number }) => event.id === eventId)).toBe(false);
    expect((await request(app).post(`/player/events/${eventId}/rsvp`).set("Authorization", `Bearer ${tokens[0]}`).send({ status: "yes" })).status).toBe(403);
  });

  it("sends new-event notifications and reminders only to eligible unique members", async () => {
    const created = await request(app).post("/api/events").set(admin).send({ ...input(), sendNotify: true });
    expect(created.status).toBe(201);
    eventIds.push(created.body.id);
    await vi.waitFor(() => expect(emails.sendNewEventEmail).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(emails.sendNewEventEmail.mock.calls.map((call: any[]) => call[0].playerEmail).sort())
      .toEqual(playerIds.slice(1, 3).map((_id, n) => `${tag}-${n + 1}@example.com`).sort());
    expect(pushes.sendPushToPlayers.mock.calls[0][0].sort()).toEqual(playerIds.slice(1, 3).sort());
    const reminders = await request(app).post(`/api/events/${created.body.id}/rsvps/remind`).set(admin);
    expect(reminders.body).toMatchObject({ sent: 2, total: 2, failed: 0 });
    expect(emails.sendRsvpReminderEmail).toHaveBeenCalledTimes(2);
  });

  it("fails closed for missing group associations and retains legacy squad behavior", async () => {
    const [broken] = await db.insert(eventsTable).values({
      title: tag, kind: "training", startsAt: new Date(future), audienceMode: "groups", operationalScope: "local_2026_27",
    }).returning();
    eventIds.push(broken.id);
    expect((await request(app).get("/api/events").set("Authorization", `Bearer ${tokens[0]}`)).body.some((event: { id: number }) => event.id === broken.id)).toBe(false);
    const legacy = await request(app).post("/api/events").set(admin).send({
      kind: "social", title: tag, startsAt: future, teamId: teamIds[1], sendNotify: false,
    });
    expect(legacy.status).toBe(201); eventIds.push(legacy.body.id);
    // Current participation overrides the stale primary team.
    expect((await request(app).get("/api/events").set("Authorization", `Bearer ${tokens[0]}`)).body.some((event: { id: number }) => event.id === legacy.body.id)).toBe(true);
    expect((await request(app).get("/api/events").set("Authorization", `Bearer ${tokens[1]}`)).body.some((event: { id: number }) => event.id === legacy.body.id)).toBe(false);
    const [archived] = await db.insert(eventsTable).values({
      title: tag, kind: "social", startsAt: new Date(future), operationalScope: "world_cup_2026",
    }).returning();
    eventIds.push(archived.id);
    expect((await request(app).patch(`/api/events/${archived.id}`).set(admin).send(input())).status).toBe(409);
    expect(await db.select().from(eventGroupsTable).where(eq(eventGroupsTable.eventId, archived.id))).toHaveLength(0);
  });

  it("changes event audiences atomically and deletes unused groups with version checks", async () => {
    const changed = await request(app).patch(`/api/events/${eventId}`).set(admin).send({ ...input(), audienceMode: "squad", groupIds: [], teamId: null });
    expect(changed.status).toBe(200);
    expect(changed.body.groupIds).toEqual([]);
    expect(await db.select().from(eventGroupsTable).where(eq(eventGroupsTable.eventId, eventId))).toHaveLength(0);
    // Release the second event's links too, then delete without broadening it.
    for (const id of eventIds) await request(app).delete(`/api/events/${id}`).set(admin);
    expect((await request(app).delete(`/api/groups/${firstGroup.id}?version=1`).set(admin)).status).toBe(409);
    expect((await request(app).delete(`/api/groups/${firstGroup.id}?version=2`).set(admin)).status).toBe(204);
    expect((await request(app).delete(`/api/groups/${secondGroup.id}?version=1`).set(admin)).status).toBe(204);
  });
});
