import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db, playersTable, teamsTable, playerParticipationsTable, seasonsTable, eventsTable,
  eventRsvpsTable, memberGroupsTable, memberGroupMembersTable, eventGroupsTable,
} from "@workspace/db";

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  hasAdminAccess: async () => true,
}));
const [{ default: players }, { default: groups }, { default: events },
  { default: publicSquad }, { default: staff }, { default: reports }] = await Promise.all([
  import("./players"), import("./groups"), import("./events"),
  import("./publicSquad"), import("./staff"), import("./reports"),
]);
const app = express();
app.use(express.json());
app.use("/api/players", players);
app.use("/api/groups", groups);
app.use("/api/events", events);
app.use("/api/public", publicSquad);
app.use("/api/staff", staff);
app.use("/api", reports);
app.use((err: Error, _req: unknown, res: express.Response, _next: unknown) => res.status(500).json({ error: err.message }));
const tag = `member-visibility-${Date.now()}`;
const ids: number[] = [];
let teamId: number;
let groupId: number;
let eventId: number;

beforeAll(async () => {
  const [team] = await db.insert(teamsTable).values({
    name: tag, category: "test", isInternal: false, managerName: "", managerEmail: "", managerPhone: "",
  }).returning();
  teamId = team.id;
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27"));
  for (const memberStatus of ["active", "inactive", "archived"]) {
    const [member] = await db.insert(playersTable).values({
      name: `${tag}-${memberStatus}`, email: `${tag}-${memberStatus}@example.com`, teamId, memberStatus,
    }).returning();
    ids.push(member.id);
    // Even stale active season participation must not expose an archived account.
    await db.insert(playerParticipationsTable).values({
      playerId: member.id, seasonId: season.id, teamId, participationStatus: "active", source: "test",
    });
  }
  const [group] = await db.insert(memberGroupsTable).values({ name: tag }).returning();
  groupId = group.id;
  await db.insert(memberGroupMembersTable).values(ids.map((playerId) => ({ groupId, playerId })));
  const [event] = await db.insert(eventsTable).values({
    title: tag, kind: "social", startsAt: new Date(), operationalScope: "local_2026_27",
    audienceMode: "groups", teamId: null,
  }).returning();
  eventId = event.id;
  await db.insert(eventGroupsTable).values({ eventId, groupId });
  await db.insert(eventRsvpsTable).values(ids.map((playerId) => ({ eventId, playerId, status: "yes" })));
});
afterAll(async () => {
  if (eventId) await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
  if (groupId) await db.delete(memberGroupsTable).where(eq(memberGroupsTable.id, groupId));
  if (ids.length) {
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, ids));
    await db.delete(playersTable).where(inArray(playersTable.id, ids));
  }
  if (teamId) await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
});

describe("archived member visibility", () => {
  it("hides archived members by default, including team-filtered and search-source directories", async () => {
    for (const query of ["", `?teamId=${teamId}`, "?memberStatus=active", "?memberStatus=inactive"]) {
      const response = await request(app).get(`/api/players${query}`);
      expect(response.status, response.text.slice(0, 150)).toBe(200);
      expect(response.body.some((member: { id: number }) => member.id === ids[2])).toBe(false);
    }
    const response = await request(app).get(`/api/players?teamId=${teamId}`);
    expect(response.body.map((member: { id: number }) => member.id).sort()).toEqual(ids.slice(0, 2).sort());
  });
  it("only returns archived members through the explicit restoration filter", async () => {
    const response = await request(app).get(`/api/players?memberStatus=archived&teamId=${teamId}`);
    expect(response.status).toBe(200);
    expect(response.body.map((member: { id: number }) => member.id)).toEqual([ids[2]]);
  });
  it("hides archived members from independent group, public squad, staff and report directories", async () => {
    for (const path of ["/api/groups/members", "/api/public/squad", "/api/staff/access", "/api/reports/current"]) {
      const response = await request(app).get(path);
      expect(response.status, `${path}: ${response.text.slice(0, 150)}`).toBe(200);
      expect(response.text, path).not.toContain(`${tag}-archived`);
      expect(response.text, path).toContain(`${tag}-active`);
    }
  });
  it("hides archived event responses and removes them from current attendance totals without deletion", async () => {
    const response = await request(app).get(`/api/events/${eventId}/rsvps`);
    expect(response.status).toBe(200);
    expect(response.text).not.toContain(`${tag}-archived`);
    expect(response.body.counts).toMatchObject({ yes: 2, invited: 2 });
    expect(await db.select().from(eventRsvpsTable).where(eq(eventRsvpsTable.eventId, eventId))).toHaveLength(3);
    expect(await db.select().from(memberGroupMembersTable).where(eq(memberGroupMembersTable.groupId, groupId))).toHaveLength(3);
  });
  it("makes a member visible again after explicit restoration using the existing member editor endpoint", async () => {
    const restored = await request(app).put(`/api/players/${ids[2]}`).send({
      memberStatus: "inactive", teamId, name: `${tag}-archived`, email: `${tag}-archived@example.com`,
    });
    expect(restored.status, restored.text.slice(0, 150)).toBe(200);
    const response = await request(app).get(`/api/players?teamId=${teamId}`);
    expect(response.body.some((member: { id: number }) => member.id === ids[2])).toBe(true);
    const archived = await request(app).get(`/api/players?memberStatus=archived&teamId=${teamId}`);
    expect(archived.body).toEqual([]);
  });
});
